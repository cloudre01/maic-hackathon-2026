import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def connect():
    path = Path(os.getenv("ARUS_DB", str(ROOT / "data/arus.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, request TEXT NOT NULL, result TEXT NOT NULL)")
    return conn


def save(request, result):
    record = {**result, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), "previous_assessment_id": request.previous_assessment_id}
    with connect() as conn:
        conn.execute("INSERT INTO assessments VALUES (?,?,?,?)", (record["id"], record["created_at"], request.model_dump_json(), json.dumps(record)))
    return record


def get(record_id):
    with connect() as conn:
        row = conn.execute("SELECT result FROM assessments WHERE id=?", (record_id,)).fetchone()
    return json.loads(row[0]) if row else None


def history():
    with connect() as conn:
        rows = conn.execute("SELECT result FROM assessments ORDER BY created_at DESC LIMIT 100").fetchall()
    return [{k: json.loads(r[0])[k] for k in ("id", "created_at", "applicant", "status", "simulated", "previous_assessment_id", "input_hash")} for r in rows]
