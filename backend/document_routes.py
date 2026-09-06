import io
import zipfile
from typing import Literal
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from pydantic import Field
from .schemas import StrictModel, Applicant, Policy, AssessmentRequest
from .cashflow import assess
from . import documents, storage
from . import evidence, evidence_demo
from copy import deepcopy

router = APIRouter(prefix="/api/documents")


@router.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    if not 1 <= len(files) <= 16:
        raise HTTPException(422, "Upload between 1 and 16 files.")
    results = []
    seen = set()
    total = 0
    for file in files:
        raw = await file.read(10_000_001)
        total += len(raw)
        if len(raw) > 10_000_000 or total > 50_000_000:
            raise HTTPException(413, "Maximum 10 MB per file, 50 MB per batch.")
        key = documents.digest(raw)
        if key in seen:
            continue
        seen.add(key)
        try:
            result = await run_in_threadpool(
                documents.parse_document, raw, file.filename or "document"
            )
        except Exception:
            # No document text, filesystem paths or parser traces in error responses.
            result = {
                "id": key[:24],
                "filename": (file.filename or "document").split("/")[-1][:200],
                "sha256": key,
                "kind": "unsupported",
                "transactions": [],
                "facts": [],
                "warnings": [
                    "Unable to safely parse this file. It may be locked, damaged, unsupported, oversized in page count, or require local extraction tools. Exclude it or supply a supported unlocked document."
                ],
            }
        results.append(result)
    return documents.persist_batch(
        results, simulated=any(d.get("marked_synthetic", False) for d in results)
    )


@router.get("/demo-pack.zip")
def download_demo():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as z:
        for name, raw in documents.demo_pack():
            z.writestr(name, raw)
    return Response(
        stream.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="arus-synthetic-statements.zip"'
        },
    )


@router.post("/demo")
def demo():
    return documents.persist_batch(
        [documents.parse_document(raw, name) for name, raw in documents.demo_pack()],
        simulated=True,
    )


class Review(StrictModel):
    applicant: Applicant
    policy: Policy = Field(default_factory=Policy)
    selected_document_ids: list[str] = Field(min_length=1, max_length=16)
    categories: dict[
        str, Literal["income", "expense", "household", "debt", "transfer", "unknown"]
    ] = Field(default_factory=dict)
    acknowledged: bool = False
    single_account_confirmed: bool = False
    period_confirmed: bool = False
    additional_obligations_confirmed: bool = False
    confirmed_matches: dict[str, str] = Field(default_factory=dict)
    confirmed_debt_ids: list[str] = Field(default_factory=list, max_length=500)


@router.post('/alternative-demo')
def alternative_demo():
    return documents.persist_batch([documents.parse_document(raw,name) for name,raw in evidence_demo.pack()],simulated=True)


@router.get('/alternative-demo.zip')
def alternative_download():
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w') as archive:
        for name,raw in evidence_demo.pack(): archive.writestr(name,raw)
    return Response(stream.getvalue(),media_type='application/zip',headers={'Content-Disposition':'attachment; filename="aina-fictional-evidence.zip"'})


class Selection(StrictModel):
    selected_document_ids: list[str] = Field(min_length=1,max_length=16)


@router.post('/{batch_id}/matches')
def matches(batch_id:str, selection:Selection):
    batch=documents.load_batch(batch_id)
    if not batch: raise HTTPException(404,'Document batch not found.')
    chosen=set(selection.selected_document_ids)
    if not chosen.issubset({d['id'] for d in batch['documents']}): raise HTTPException(422,'Unknown document selection.')
    return {'items':evidence.propose([d for d in batch['documents'] if d['id'] in chosen])}


@router.post("/{batch_id}/assess")
def assessed_document_batch(batch_id: str, review: Review, preview: bool = False):
    batch = documents.load_batch(batch_id)
    if not batch:
        raise HTTPException(404, "Document batch not found.")
    if not all(
        [
            review.acknowledged,
            review.single_account_confirmed,
            review.period_confirmed,
            review.additional_obligations_confirmed,
        ]
    ):
        raise HTTPException(
            422,
            "Confirm extraction review, one account, full-month statement coverage and household/debt obligations before assessment.",
        )
    chosen = set(review.selected_document_ids)
    if not chosen.issubset({d["id"] for d in batch["documents"]}):
        raise HTTPException(422, "Unknown document selection.")
    docs = [d for d in batch["documents"] if d["id"] in chosen]
    if any(d["kind"] == "unsupported" for d in docs):
        raise HTTPException(422, "Exclude unsupported documents before assessment.")
    bank = sorted(
        [d for d in docs if d["kind"] == "bank_statement"],
        key=lambda d: d["period_start"],
    )
    if not bank:
        raise HTTPException(
            422,
            "At least one reconciled bank statement is required. Bills alone do not evidence income.",
        )
    if any(not d["reconciled"] for d in bank):
        raise HTTPException(
            422, "A selected bank statement failed ledger reconciliation."
        )
    if len({d["account_key"] for d in bank if d["account_key"]}) > 1:
        raise HTTPException(
            422,
            "Different bank accounts detected. This version supports one bank account per assessment.",
        )
    for a, b in zip(bank, bank[1:]):
        if a["period_end"] >= b["period_start"]:
            raise HTTPException(
                422, "Overlapping statement periods. Keep one copy of each month."
            )
        from datetime import date, timedelta

        if date.fromisoformat(a["period_end"]) + timedelta(days=1) < date.fromisoformat(
            b["period_start"]
        ):
            raise HTTPException(
                422,
                "Missing statement months. Upload the intervening statements or select a consecutive period; missing records are not treated as inactive months.",
            )
        if (
            date.fromisoformat(a["period_end"]) + timedelta(days=1)
            == date.fromisoformat(b["period_start"])
            and abs(a["closing"] - b["opening"]) > 0.02
        ):
            raise HTTPException(
                422,
                "Consecutive statement closing/opening balances do not match. Resolve the account or statement mismatch.",
            )
    tx = [
        {k: v for k, v in t.items() if k not in ("page", "line")}
        for d in bank
        for t in d["transactions"]
    ]
    if not set(review.categories).issubset({t["transaction_id"] for t in tx}):
        raise HTTPException(422, "Category edits refer to unselected transactions.")
    edits = []
    for t in tx:
        if t["transaction_id"] in review.categories:
            old = t["category"]
            t["category"] = review.categories[t["transaction_id"]]
            if old != t["category"]:
                edits.append(
                    {
                        "transaction_id": t["transaction_id"],
                        "before": old,
                        "after": t["category"],
                    }
                )
    try:
        request = AssessmentRequest(
            applicant=review.applicant,
            policy=review.policy,
            transactions=tx,
            period_start=bank[0]["period_start"],
            period_end=bank[-1]["period_end"],
            simulated=batch["simulated"],
        )
        result = assess(request)
        baseline = deepcopy(result)
        base_request = request.model_dump(mode='json')
        items = evidence.propose(docs)
        matched_tx = deepcopy(tx)
        evidence_changes = evidence.apply_matches(matched_tx,items,review.confirmed_matches)
        matched_request = request.model_copy(update={'transactions': [type(request.transactions[0]).model_validate(t) for t in matched_tx]})
        matched_result = assess(matched_request)
        debt = evidence.debt_summary(items,review.confirmed_debt_ids)
        effective_debt = max(review.applicant.monthly_obligations,debt['suggested_monthly_floor'])
        request = matched_request.model_copy(update={'applicant':review.applicant.model_copy(update={'monthly_obligations':effective_debt})})
        result = assess(request)
    except ValueError as exc:
        raise HTTPException(
            422,
            "Evidence or application review failed: " + str(exc),
        )
    def snapshot(label,r):
        return {'label':label,'status':r['status'],'metrics':r['metrics'],'input_hash':r['input_hash'],'flags':r['flags']}
    result['evidence_comparison'] = {
        'stages':[snapshot('Bank categories + declared obligations',baseline),snapshot('Confirmed bank matches',matched_result),snapshot('Confirmed matches + schedule floor',result)],
        'category_changes':evidence_changes,'debt_review':debt,
        'declared_monthly_obligations':review.applicant.monthly_obligations,'effective_monthly_obligations':effective_debt,
        'baseline_inputs':base_request,
        'note':'Same bank rows, applicant financing and stress policy. Stage 2 changes only analyst-confirmed categories. Stage 3 raises the debt floor if confirmed schedules exceed declared debt. This is an affordability sensitivity comparison, not predictive uplift.'}
    result["document_evidence"] = {
        "batch_id": batch_id,
        "parser_version": documents.PARSER_VERSION,
        "documents": docs,
        "category_edits": edits,
        "review_confirmations": review.model_dump(
            exclude={"applicant", "policy", "categories"}
        ),
        "supporting_documents_added_to_cashflow": False,
    }
    result["reasons"].append(
        {
            "code": "DOCUMENT_REVIEW",
            "text": "Only reviewed bank ledger rows feed cash flow. Supporting bill and screenshot evidence is retained separately. Analyst-confirmed household and debt floors must cover obligations not visible in the bank account. Document authenticity and repayment punctuality are not verified.",
        }
    )
    if review.confirmed_debt_ids:
        result['reasons'].append({'code':'SCHEDULE_FLOOR','text':f'Confirmed schedule peak RM {debt["suggested_monthly_floor"]:,.2f}; declared debt RM {review.applicant.monthly_obligations:,.2f}; effective monthly floor RM {effective_debt:,.2f}. Uses the greater of this floor and bank debt payments, not their sum.'})
    if preview:
        return result
    return storage.save(request, result)


@router.delete("/{batch_id}")
def discard(batch_id: str):
    with storage.connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS document_batches (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        conn.execute("DELETE FROM document_batches WHERE id=?", (batch_id,))
    return {
        "discarded": True,
        "note": "Review batch removed. Previously saved assessments retain their evidence.",
    }
