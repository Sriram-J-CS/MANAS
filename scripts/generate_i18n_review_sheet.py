#!/usr/bin/env python3
"""
generate_i18n_review_sheet.py
Extracts all translation strings across the 8 Indian languages (en, ta, hi, te, kn, ml, bn, mr)
and compiles a human review sheet with status 'needs native review'.
"""

import csv
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
LOCALES_DIR = BASE_DIR / "frontend" / "src" / "i18n" / "locales"
OUT_CSV_FRONTEND = BASE_DIR / "frontend" / "src" / "i18n" / "review_sheet.csv"
OUT_CSV_EVAL = BASE_DIR / "eval" / "i18n_translation_review_sheet.csv"

LANGS = ["ta", "hi", "te", "kn", "ml", "bn", "mr"]
LANG_NAMES = {
    "ta": "Tamil (தமிழ்)",
    "hi": "Hindi (हिन्दी)",
    "te": "Telugu (తెలుగు)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)"
}

# Regex string extractor for typescript locale objects
RE_KV = re.compile(r"(\w+):\s*['\"]([^'\"]+)['\"]")

def parse_ts_locale(file_path: Path):
    content = file_path.read_text(encoding="utf-8")
    items = []
    current_section = "general"
    for line in content.splitlines():
        line_s = line.strip()
        if line_s.endswith(":{"):
            current_section = line_s[:-2].strip()
        m = RE_KV.search(line_s)
        if m:
            key, val = m.group(1), m.group(2)
            if key not in ("title", "description") or len(val) > 1:
                items.append((f"{current_section}.{key}", val))
    return items

def main():
    en_path = LOCALES_DIR / "en.ts"
    en_items = parse_ts_locale(en_path)
    en_map = {k: v for k, v in en_items}

    records = []
    for l_code in LANGS:
        l_path = LOCALES_DIR / f"{l_code}.ts"
        if not l_path.exists():
            continue
        l_items = parse_ts_locale(l_path)
        for key, trans_val in l_items:
            source_en = en_map.get(key, "")
            domain = "clinical_exercise" if "exercise" in key else ("crisis_helpline" if "crisis" in key else ("onboarding_step" if "step" in key else "ui_common"))
            records.append({
                "language_code": l_code,
                "language_name": LANG_NAMES.get(l_code, l_code),
                "key_path": key,
                "domain_context": domain,
                "source_english": source_en,
                "translated_string": trans_val,
                "review_status": "needs native review",
                "native_reviewer_name": "",
                "vernacular_naturalness_1_5": "",
                "clinical_accuracy_approved": "",
                "reviewer_notes": ""
            })

    OUT_CSV_FRONTEND.parent.mkdir(parents=True, exist_ok=True)
    OUT_CSV_EVAL.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "language_code", "language_name", "key_path", "domain_context",
        "source_english", "translated_string", "review_status",
        "native_reviewer_name", "vernacular_naturalness_1_5",
        "clinical_accuracy_approved", "reviewer_notes"
    ]

    for p in [OUT_CSV_FRONTEND, OUT_CSV_EVAL]:
        with open(p, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)

    print(f"Generated {len(records)} translation review items into:")
    print(f"  - {OUT_CSV_FRONTEND}")
    print(f"  - {OUT_CSV_EVAL}")

if __name__ == "__main__":
    main()
