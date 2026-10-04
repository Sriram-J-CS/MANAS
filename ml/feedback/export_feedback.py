#!/usr/bin/env python3
"""
export_feedback.py - De-Identified Feedback Batch Exporter for Clinical Review

Clinical Safety & Privacy Rules:
1. ONLY processes records where user explicitly checked 'Allow anonymous review' (user_consent == 1).
2. Scrubs PII using regex patterns (phone numbers, emails, Aadhaar, URLs, personal names).
3. Hashes user_id to an irreversible pseudonym.
4. Exports de-identified turns to CSV/JSON for human-in-the-loop review by licensed counselors.
5. Strictly offline: NOTHING is learned automatically or pushed to model weights online.
"""

import csv
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "backend" / "manas_twin.db"
OUTPUT_DIR = BASE_DIR / "ml" / "feedback" / "batches"

# Regex PII Scrubbing Rules
RE_PHONE = re.compile(r"(?:\+91[-\s]?)?[6-9]\d{9}\b")
RE_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
RE_AADHAAR = re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")
RE_URL = re.compile(r"https?://\S+|www\.\S+")
RE_NAMES_PROMPTS = re.compile(r"\b(?:my name is|i am|this is|call me)\s+([A-Z][a-z]+)", re.I)


def scrub_pii(text: Optional[str]) -> str:
    """Scrub sensitive personal identifiers from text."""
    if not text:
        return ""
    clean = text
    clean = RE_PHONE.sub("[PHONE_REDACTED]", clean)
    clean = RE_EMAIL.sub("[EMAIL_REDACTED]", clean)
    clean = RE_AADHAAR.sub("[AADHAAR_REDACTED]", clean)
    clean = RE_URL.sub("[URL_REDACTED]", clean)
    clean = RE_NAMES_PROMPTS.sub(r"my name is [NAME_REDACTED]", clean)
    return clean.strip()


def hash_pseudonym(user_id: Optional[str], salt: str = "MANAS_CLINICAL_SALT_2026") -> str:
    """Creates a deterministic one-way pseudonym for tracking multi-turn context without deanonymization."""
    if not user_id:
        return "anon_user"
    return "user_" + hashlib.sha256((user_id + salt).encode("utf-8")).hexdigest()[:12]


def export_consented_feedback(
    db_path: Path = DB_PATH,
    output_dir: Path = OUTPUT_DIR,
    only_negative: bool = False
) -> Path:
    """
    Queries SQLite database for consented feedback and writes de-identified review batch.
    """
    if not db_path.exists():
        print(f"[!] Database file not found at {db_path}")
        return Path("")

    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = output_dir / f"clinical_review_batch_{timestamp}.csv"
    out_json = output_dir / f"clinical_review_batch_{timestamp}.json"

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
        SELECT id, message_id, user_id, rating, felt_understood, comment, user_consent, user_message, bot_reply, created_at
        FROM message_feedback
        WHERE user_consent = 1 AND user_message IS NOT NULL AND user_message != ''
    """
    if only_negative:
        query += " AND (rating < 0 OR felt_understood = 0)"
    query += " ORDER BY created_at DESC"

    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    print(f"[*] Found {len(rows)} consented feedback records.")
    if len(rows) == 0:
        print("[-] No records to export.")
        return out_csv

    cleaned_records = []
    for r in rows:
        scrubbed_user_msg = scrub_pii(r["user_message"])
        scrubbed_bot_reply = scrub_pii(r["bot_reply"])
        pseudonym = hash_pseudonym(r["user_id"])

        cleaned_records.append({
            "feedback_id": r["id"],
            "message_id": r["message_id"],
            "pseudonym_user_id": pseudonym,
            "rating": r["rating"],
            "felt_understood": bool(r["felt_understood"]),
            "user_comment": scrub_pii(r["comment"]),
            "scrubbed_user_message": scrubbed_user_msg,
            "scrubbed_bot_reply": scrubbed_bot_reply,
            "timestamp": r["created_at"],
            "counselor_reviewer": "",
            "clinical_diagnosis_of_failure": "",
            "suggested_rewritten_reply": "",
            "approved_for_golden_dataset": "NO"
        })

    # 1. Export CSV for Counselors
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(cleaned_records[0].keys()))
        writer.writeheader()
        writer.writerows(cleaned_records)

    # 2. Export JSON for ML pipeline ingestion
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(cleaned_records, f, indent=2, ensure_ascii=False)

    print(f"[+] Successfully exported {len(cleaned_records)} de-identified cases to:")
    print(f"    CSV:  {out_csv}")
    print(f"    JSON: {out_json}")
    return out_csv


if __name__ == "__main__":
    only_neg = "--negative-only" in sys.argv
    export_consented_feedback(only_negative=only_neg)
