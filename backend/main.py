import csv
import io
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import ValidationError
from .cashflow import assess, ENGINE_VERSION
from .schemas import AssessmentRequest, Transaction
from .demos import SCENARIOS, scenario
from . import storage

app = FastAPI(title="Arus · alternative-credit prototype", version="0.1.0")
from .document_routes import router as document_router

app.include_router(document_router)
ROOT = Path(__file__).resolve().parents[1]


@app.middleware("http")
async def local_privacy(request, call_next):
    origin = request.headers.get("origin")
    if (
        request.method not in ("GET", "HEAD", "OPTIONS")
        and origin
        and origin
        not in (
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
        )
    ):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"detail": "Cross-origin writes are disabled."}, status_code=403
        )
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok", "engine_version": ENGINE_VERSION, "mode": "local-prototype"}


@app.get("/api/scenarios")
def scenarios():
    return SCENARIOS


@app.get("/api/scenarios/{scenario_id}")
def demo(scenario_id: str, extended: bool = False):
    try:
        return scenario(scenario_id, extended)
    except KeyError:
        raise HTTPException(404, "Scenario not found")


@app.get("/api/scenarios/{scenario_id}/csv")
def demo_csv(scenario_id: str, extended: bool = False):
    request = demo(scenario_id, extended)
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=list(request.transactions[0].model_dump())
    )
    writer.writeheader()
    writer.writerows([t.model_dump(mode="json") for t in request.transactions])
    return Response(
        buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="simulated-{scenario_id}.csv"'
        },
    )


@app.post("/api/transactions/parse")
async def parse_csv(file: UploadFile = File(...)):
    raw = await file.read(5_000_001)
    if len(raw) > 5_000_000:
        raise HTTPException(413, "CSV exceeds the 5 MB limit.")
    try:
        content = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))
        required = {
            "transaction_id",
            "date",
            "amount",
            "description",
            "category",
            "balance",
        }
        if set(reader.fieldnames or []) != required:
            raise ValueError(
                "Expected exactly these columns: " + ", ".join(sorted(required))
            )
        rows = []
        for line, row in enumerate(reader, 2):
            if len(rows) >= 20000:
                raise ValueError("Maximum 20,000 transactions per assessment.")
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"Malformed CSV on line {line}.")
            row = {k: v.strip() for k, v in row.items()}
            row["balance"] = row["balance"] or None
            try:
                rows.append(Transaction.model_validate(row))
            except ValidationError:
                raise ValueError(
                    f"Invalid transaction on line {line}. Check ISO date, finite numeric amounts and allowed category."
                )
        if not rows:
            raise ValueError("CSV contains no transactions.")
        return {
            "transactions": rows,
            "count": len(rows),
            "earliest": min(t.date for t in rows),
            "latest": max(t.date for t in rows),
        }
    except (ValueError, UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(422, str(exc))


@app.post("/api/assessments")
def create_assessment(request: AssessmentRequest):
    if request.previous_assessment_id:
        previous = storage.get(request.previous_assessment_id)
        if not previous:
            raise HTTPException(404, "Previous assessment not found.")
        if (
            previous["applicant"]["name"] != request.applicant.name
            or previous["applicant"]["kind"] != request.applicant.kind
        ):
            raise HTTPException(
                422, "Reassessment must refer to the same applicant name and type."
            )
    try:
        result = assess(request)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return storage.save(request, result)


@app.get("/api/assessments")
def list_assessments():
    return storage.history()


@app.get("/api/assessments/{record_id}")
def get_assessment(record_id: str):
    result = storage.get(record_id)
    if not result:
        raise HTTPException(404, "Assessment not found.")
    return result


@app.get("/api/benchmark")
def benchmark():
    path = ROOT / "artifacts/benchmark.json"
    if not path.exists():
        return {
            "status": "not_run",
            "message": "No benchmark has been run. Results are never simulated. Run python -m benchmark.train.",
        }
    return json.loads(path.read_text())
