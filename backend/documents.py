"""Local-only document extraction. No network calls; originals exist only in temp files.

Bank ledger rows are the sole cash-flow source. Supporting bills never become
additional cash transactions. Text and images are untrusted data, not instructions.
"""

import calendar
import hashlib
import io
import json
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from pypdf import PdfReader
from PIL import Image
from . import storage

PARSER_VERSION = "documents-1.0"
MONEY = r"\d[\d,]*\.\d{2}"
ROW = re.compile(
    r"^\s*(\d{2}/\d{2}/\d{2})\s+(.+?)\s+(" + MONEY + r")([+-])\s+(-?" + MONEY + r")\s*$"
)


def numeric(value):
    return Decimal(value.replace(",", ""))


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def run_local(args, timeout=40):
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError(
            "Local extraction tool is unavailable or timed out. Install Poppler and Tesseract; no cloud fallback is used."
        )
    if result.returncode:
        raise ValueError(
            "The local extractor could not read this document. Use an unlocked, valid PDF or a clearer screenshot."
        )
    return result.stdout.decode("utf-8", errors="replace")


def extract(raw, suffix):
    with tempfile.TemporaryDirectory(prefix="arus-private-") as folder:
        path = Path(folder) / ("source" + suffix)
        path.write_bytes(raw)
        path.chmod(0o600)
        if suffix == ".pdf":
            reader = PdfReader(io.BytesIO(raw))
            if reader.is_encrypted and not reader.decrypt(""):
                raise ValueError(
                    "Password-protected PDF: unlock a local copy before uploading. Passwords are not collected."
                )
            if len(reader.pages) > 30:
                raise ValueError("Maximum 30 pages per PDF.")
            text = run_local(["pdftotext", "-layout", str(path), "-"])
            method = "Local PDF text extraction"
            if len(text.strip()) < 50:
                if len(reader.pages) > 8:
                    raise ValueError("Scanned PDFs are limited to 8 pages per upload.")
                run_local(
                    [
                        "pdftoppm",
                        "-scale-to",
                        "2000",
                        "-png",
                        str(path),
                        str(Path(folder) / "page"),
                    ],
                    80,
                )
                text = "\f".join(
                    run_local(["tesseract", str(p), "stdout", "--psm", "6"])
                    for p in sorted(Path(folder).glob("page-*.png"))
                )
                method = "Local OCR — review required"
        else:
            with Image.open(path) as image:
                if image.width * image.height > 30_000_000:
                    raise ValueError("Screenshot exceeds 30 megapixels.")
                image.verify()
            text = run_local(["tesseract", str(path), "stdout", "--psm", "11"])
            method = "Local OCR — review required"
    return text, method


def bank(text, file_hash):
    rows = []
    for page, content in enumerate(text.split("\f"), 1):
        for line_no, line in enumerate(content.splitlines(), 1):
            m = ROW.match(line)
            if not m:
                continue
            when, description, amount, sign, balance = m.groups()
            value = numeric(amount) * (-1 if sign == "-" else 1)
            category = "unknown" if value > 0 else "expense"
            if "HOUSEHOLD" in description.upper() and value < 0:
                category = "household"
            if re.search(r"\b(SALARY|PAYROLL)\b", description, re.I) and value > 0:
                category = "income"
            if (
                re.search(
                    r"\b(LOAN|INSTALMENT|INSTALLMENT|HIRE PURCHASE)\b",
                    description,
                    re.I,
                )
                and value < 0
            ):
                category = "debt"
            rows.append(
                {
                    "transaction_id": f"{file_hash[:12]}-{len(rows):05}",
                    "date": datetime.strptime(when, "%d/%m/%y").date().isoformat(),
                    "amount": float(value),
                    "balance": float(numeric(balance)),
                    "description": description.strip(),
                    "category": category,
                    "page": page,
                    "line": line_no,
                }
            )
    if not rows:
        raise ValueError(
            "Bank layout recognised but no complete ledger rows parsed. Do not use this file for assessment."
        )

    def total(label):
        matches = re.findall(label + r"\s*:?\s*(" + MONEY + r")", text, re.I)
        return numeric(matches[-1]) if matches else None

    opening, closing = total("BEGINNING BALANCE"), total("ENDING BALANCE")
    credit, debit = total("TOTAL CREDIT"), total("TOTAL DEBIT")
    actual_credit = sum(
        (Decimal(str(r["amount"])) for r in rows if r["amount"] > 0), Decimal(0)
    )
    actual_debit = sum(
        (-Decimal(str(r["amount"])) for r in rows if r["amount"] < 0), Decimal(0)
    )
    running_ok = opening is not None
    running = opening
    for r in rows:
        if running is not None and abs(
            running + Decimal(str(r["amount"])) - Decimal(str(r["balance"]))
        ) > Decimal(".02"):
            running_ok = False
        running = Decimal(str(r["balance"]))
    reconciled = (
        all(v is not None for v in (opening, closing, credit, debit))
        and abs(actual_credit - credit) <= Decimal(".02")
        and abs(actual_debit - debit) <= Decimal(".02")
        and abs(opening + credit - debit - closing) <= Decimal(".02")
        and running_ok
        and abs(running - closing) <= Decimal(".02")
    )
    all_dates = [
        datetime.strptime(d, "%d/%m/%y").date()
        for d in re.findall(r"\b\d{2}/\d{2}/\d{2}\b", text)
    ]
    last = max(all_dates)
    start = date(last.year, last.month, 1)
    end = date(last.year, last.month, calendar.monthrange(last.year, last.month)[1])
    period_ok = all(start.isoformat() <= r["date"] <= end.isoformat() for r in rows)
    # Match only the account field near its printed label; never use a name as ID.
    account = re.search(r"ACCOUNT NUMBER\s*:?\s*(\d[\d-]{9,17})", text) or re.search(
        r"NOMBOR AKAUN[\s\S]{0,500}?:\s*(\d[\d-]{9,17})", text
    )
    account_key = digest(account[1].replace("-", "").encode()) if account else None
    warnings = [
        "Categories are suggestions. Review incoming transfers before recognising earned income. Coverage is inferred as the statement calendar month and must be confirmed."
    ]
    if not reconciled:
        warnings.append(
            "Ledger reconciliation failed or totals are missing. This document is blocked from assessment."
        )
    if not account_key:
        warnings.append(
            "Account identifier could not be verified. Confirm all selected statements belong to one account."
        )
    return {
        "kind": "bank_statement",
        "period_start": str(start),
        "period_end": str(end),
        "account_key": account_key,
        "reconciled": bool(reconciled and period_ok),
        "opening": float(opening) if opening is not None else None,
        "closing": float(closing) if closing is not None else None,
        "credit": float(actual_credit),
        "debit": float(actual_debit),
        "transactions": rows,
        "facts": [],
        "warnings": warnings,
    }


def supporting(text):
    facts = []
    warnings = []
    if "TNB" in text.upper() and ("TARIKH BIL" in text or "Baki Terdahulu" in text):
        kind = "utility_bill"
        for label, pattern in [
            ("Last recorded payment amount", r"Amaun\s*:\s*RM\s*(" + MONEY + r")"),
            ("Last recorded payment date", r"Tarikh\s*:\s*(\d{2}\.\d{2}\.\d{4})"),
            ("Bill date", r"TARIKH BIL[^\n]*\n[^\n]*?(\d{2}\.\d{2}\.\d{4})"),
        ]:
            m = re.search(pattern, text, re.I)
            if m:
                facts.append(
                    {
                        "label": label,
                        "value": m[1],
                        "page": text[: m.start()].count("\f") + 1,
                    }
                )
        warnings = [
            "A prior payment is evidence of a recorded payment, not proof that every bill was paid on time. No cash-flow entries are added; match against the bank statement."
        ]
    elif re.search(r"Postpaid\s+\w+\s+Bill|PayLater|SPayLater", text, re.I):
        kind = "paylater_history"
        title = re.search(r"Postpaid\s+\w+\s+Bill", text, re.I)
        if title:
            facts.append({"label": "Bill heading", "value": title[0], "page": 1})
        candidate = re.search(r"\bTransaction\b([\s\S]{0,130})", text, re.I)
        if candidate:
            amount = re.search(r"RM\s*(" + MONEY + r")", candidate[1])
            when = re.search(r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}\b", candidate[1])
            if amount:
                facts.append(
                    {
                        "label": "Transaction amount — confirm purpose",
                        "value": "RM " + amount[1],
                        "page": 1,
                    }
                )
            if when:
                facts.append(
                    {
                        "label": "Transaction date — confirm purpose",
                        "value": when[0],
                        "page": 1,
                    }
                )
        warnings = [
            "Screenshot may show only part of the bill. A generic Transaction label is not automatically a verified repayment. Due dates and on-time status are unavailable unless separately evidenced. Purchases and refunds are not added to bank cash flow."
        ]
    elif "Booking Code" in text and "Fleet Type" in text:
        kind = "grab_activity"
        currencies = sorted(set(re.findall(r"\b(?:MYR|IDR|SGD|THB|VND|PHP)\b", text)))
        facts = [
            {"label": "Currencies observed", "value": ", ".join(currencies), "page": 1}
        ]
        count = re.search(r"Total Trips\s*:\s*(\d+)", text)
        if count:
            facts.append(
                {"label": "Reported activity count", "value": count[1], "page": 1}
            )
        warnings = [
            "Passenger trip/order activity, not driver income or PayLater repayment evidence. Excluded from cash-flow totals to prevent double counting. Foreign currency amounts are not converted. Locations and merchant names are not credit-scoring features."
        ]
    else:
        raise ValueError(
            "Unsupported document layout. Nothing was added to the cash-flow calculation."
        )
    return {"kind": kind, "transactions": [], "facts": facts, "warnings": warnings}


def parse_document(raw, filename):
    suffix = Path(filename).suffix.lower()
    if suffix not in (".pdf", ".png", ".jpg", ".jpeg"):
        raise ValueError("Upload PDF, PNG or JPG files.")
    if suffix == ".pdf" and not raw.startswith(b"%PDF"):
        raise ValueError("File is not a valid PDF.")
    text, method = extract(raw, suffix)
    file_hash = digest(raw)
    result = (
        bank(text, file_hash)
        if "TRANSACTION AMOUNT" in text and "STATEMENT BALANCE" in text
        else supporting(text)
    )
    return {
        **result,
        "id": str(uuid.uuid4()),
        "filename": Path(filename).name[:200],
        "sha256": file_hash,
        "method": method,
        "parser_version": PARSER_VERSION,
        "marked_synthetic": "SYNTHETIC DEMONSTRATION" in text,
    }


def persist_batch(documents, simulated=False):
    batch = {
        "id": str(uuid.uuid4()),
        "documents": documents,
        "simulated": simulated,
        "parser_version": PARSER_VERSION,
    }
    with storage.connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS document_batches (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT INTO document_batches VALUES (?,?)",
            (batch["id"], json.dumps(batch)),
        )
    return batch


def load_batch(batch_id):
    with storage.connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS document_batches (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        row = conn.execute(
            "SELECT payload FROM document_batches WHERE id=?", (batch_id,)
        ).fetchone()
    return json.loads(row[0]) if row else None


def demo_pack():
    """Fictional examples generated independently of user files, for public demos/tests."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4

    files = []
    balance = Decimal("5000")
    for month in range(1, 7):
        stream = io.BytesIO()
        c = canvas.Canvas(stream, pagesize=A4)
        c.setFont("Courier", 8)
        end = calendar.monthrange(2026, month)[1]
        lines = [
            "SYNTHETIC DEMONSTRATION — NOT A REAL BANK STATEMENT",
            "ACCOUNT NUMBER 000000000000",
            f"STATEMENT DATE {end:02}/{month:02}/26",
            "ENTRY DATE TRANSACTION DESCRIPTION TRANSACTION AMOUNT STATEMENT BALANCE",
            f"BEGINNING BALANCE {balance:.2f}",
        ]
        for day, desc, amount in [
            (3, "SALARY / CLIENT PAYOUT", Decimal("6000")),
            (7, "OPERATING COSTS", Decimal("-900")),
            (18, "HOUSEHOLD COSTS", Decimal("-1600")),
        ]:
            balance += amount
            lines.append(
                f"{day:02}/{month:02}/26 {desc} {abs(amount):.2f}{'+' if amount > 0 else '-'} {balance:.2f}"
            )
        lines += [
            f"ENDING BALANCE : {balance:.2f}",
            "TOTAL CREDIT : 6000.00",
            "TOTAL DEBIT : 2500.00",
        ]
        for i, line in enumerate(lines):
            c.drawString(30, 800 - i * 25, line)
        c.save()
        files.append((f"synthetic-bank-{month:02}.pdf", stream.getvalue()))
    return files
