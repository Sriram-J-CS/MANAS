#!/usr/bin/env python3
"""
Repair mojibake in SQLite database using ftfy (ftfy.fix_text).
Targets:
  - chat_messages (text)
  - user_memories (fact)
  - journal_entries (title, content, ai_reflection)

Supports per-user encrypted fields ('enc:v1:...') as well as plain-text rows.
Creates a timestamped backup before applying changes.
"""

import os
import sys
import shutil
import sqlite3
import argparse
from datetime import datetime

# Reconfigure stdout/stderr for Unicode output on Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Ensure backend modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.app.services.user_crypto import decrypt_user_text, encrypt_user_text

try:
    import ftfy
except ImportError:
    print("ERROR: 'ftfy' is required. Please install it with 'pip install ftfy'")
    sys.exit(1)


def is_garbled(text: str) -> bool:
    """Returns True if text contains mojibake that ftfy fixes."""
    if not text or not isinstance(text, str):
        return False
    fixed = ftfy.fix_text(text)
    return fixed != text


def process_value(val: str, user_id: str):
    """
    Decodes if encrypted, checks for mojibake via ftfy,
    returns (was_modified, original_display, fixed_display, new_val_for_db).
    """
    if not val or not isinstance(val, str):
        return False, val, val, val

    is_enc = val.startswith("enc:v1:")
    plain_text = decrypt_user_text(user_id, val) if is_enc else val

    if not is_garbled(plain_text):
        return False, plain_text, plain_text, val

    fixed_text = ftfy.fix_text(plain_text)
    # Double-check that it really changed and isn't empty
    if fixed_text == plain_text:
        return False, plain_text, plain_text, val

    if is_enc:
        new_db_val = encrypt_user_text(user_id, fixed_text)
    else:
        new_db_val = fixed_text

    return True, plain_text, fixed_text, new_db_val


def run_repair(db_path: str, apply_changes: bool = False):
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return

    print("=" * 70)
    print(f"MOJIBAKE REPAIR UTILITY - {'[APPLY MODE]' if apply_changes else '[DRY-RUN MODE]'}")
    print(f"Database: {db_path}")
    print("=" * 70)

    if apply_changes:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{db_path}.backup_{timestamp}"
        shutil.copy2(db_path, backup_path)
        print(f"[BACKUP] Created database backup at: {backup_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    total_diff_count = 0

    # 1. chat_messages
    try:
        cur.execute("SELECT id, user_id, text FROM chat_messages")
        rows = cur.fetchall()
        cm_diffs = []
        for row_id, uid, text_val in rows:
            changed, orig_d, fix_d, new_val = process_value(text_val, uid or "anonymous")
            if changed:
                cm_diffs.append((row_id, new_val, orig_d, fix_d))

        print(f"\n[chat_messages] Scanned {len(rows)} rows | Garbled rows found: {len(cm_diffs)}")
        for r_id, n_val, o_d, f_d in cm_diffs[:5]:
            print(f"  Row {r_id}:")
            print(f"    - Before: {o_d[:60]}...")
            print(f"    + After : {f_d[:60]}...")

        if apply_changes and cm_diffs:
            for r_id, n_val, _, _ in cm_diffs:
                cur.execute("UPDATE chat_messages SET text = ? WHERE id = ?", (n_val, r_id))
            conn.commit()
            print(f"  -> Applied fixes to {len(cm_diffs)} chat_messages rows.")

        total_diff_count += len(cm_diffs)
    except sqlite3.OperationalError as e:
        print(f"[chat_messages] Note: {e}")

    # 2. user_memories
    try:
        cur.execute("SELECT id, user_id, fact FROM user_memories")
        rows = cur.fetchall()
        mem_diffs = []
        for row_id, uid, fact_val in rows:
            changed, orig_d, fix_d, new_val = process_value(fact_val, uid or "anonymous")
            if changed:
                mem_diffs.append((row_id, new_val, orig_d, fix_d))

        print(f"\n[user_memories] Scanned {len(rows)} rows | Garbled rows found: {len(mem_diffs)}")
        for r_id, n_val, o_d, f_d in mem_diffs[:5]:
            print(f"  Row {r_id}:")
            print(f"    - Before: {o_d[:60]}...")
            print(f"    + After : {f_d[:60]}...")

        if apply_changes and mem_diffs:
            for r_id, n_val, _, _ in mem_diffs:
                cur.execute("UPDATE user_memories SET fact = ? WHERE id = ?", (n_val, r_id))
            conn.commit()
            print(f"  -> Applied fixes to {len(mem_diffs)} user_memories rows.")

        total_diff_count += len(mem_diffs)
    except sqlite3.OperationalError as e:
        print(f"[user_memories] Note: {e}")

    # 3. journal_entries
    try:
        cur.execute("SELECT id, user_id, title, content, ai_reflection FROM journal_entries")
        rows = cur.fetchall()
        je_diffs = []
        for row_id, uid, title, content, reflection in rows:
            uid_str = uid or "anonymous"
            c_title, orig_t, fix_t, new_t = process_value(title, uid_str)
            c_content, orig_c, fix_c, new_c = process_value(content, uid_str)
            c_refl, orig_r, fix_r, new_r = process_value(reflection, uid_str)

            if c_title or c_content or c_refl:
                je_diffs.append((row_id, new_t, new_c, new_r, (orig_t, fix_t), (orig_c, fix_c)))

        print(f"\n[journal_entries] Scanned {len(rows)} rows | Garbled rows found: {len(je_diffs)}")
        for r_id, n_t, n_c, n_r, t_diff, c_diff in je_diffs[:5]:
            print(f"  Row {r_id}:")
            if t_diff[0] != t_diff[1]:
                print(f"    Title - Before: {t_diff[0]} | After: {t_diff[1]}")
            if c_diff[0] != c_diff[1]:
                print(f"    Content - Before: {c_diff[0][:50]}... | After: {c_diff[1][:50]}...")

        if apply_changes and je_diffs:
            for r_id, n_t, n_c, n_r, _, _ in je_diffs:
                cur.execute("""
                    UPDATE journal_entries
                    SET title = ?, content = ?, ai_reflection = ?
                    WHERE id = ?
                """, (n_t, n_c, n_r, r_id))
            conn.commit()
            print(f"  -> Applied fixes to {len(je_diffs)} journal_entries rows.")

        total_diff_count += len(je_diffs)
    except sqlite3.OperationalError as e:
        print(f"[journal_entries] Note: {e}")

    conn.close()

    print("\n" + "=" * 70)
    print(f"SUMMARY: Found {total_diff_count} garbled fields/rows.")
    if apply_changes:
        print("STATUS: All repairs successfully committed to database.")
    else:
        print("STATUS: Dry-run complete. Run with --apply to commit changes.")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repair mojibake in MANAS SQLite DB")
    parser.add_argument("--db", default="backend/manas_twin.db", help="Path to SQLite DB")
    parser.add_argument("--apply", action="store_true", help="Apply changes (creates backup first)")
    args = parser.parse_args()

    run_repair(args.db, apply_changes=args.apply)
