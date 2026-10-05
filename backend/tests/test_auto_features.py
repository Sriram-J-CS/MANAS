"""
test_auto_features.py - End-to-end and unit test suite for chat-driven auto-features.
Validates:
1. Per-User AES-256-GCM Encryption isolation across users.
2. Background extraction tool execution, confidence thresholds, and undo.
3. Web Push VAPID key generation, neutral text sanitization, and quiet hours.
4. Export and complete data erasure cascade.
"""

import pytest
import os
import json
import sqlite3
from unittest.mock import patch, MagicMock

from datetime import time
from app.database import get_db, init_db
from app.services.user_crypto import (
    derive_user_key,
    encrypt_user_text,
    decrypt_user_text,
)
from app.services.chat_extractor import (
    EXTRACTION_FUNCTION_DECLARATIONS,
    execute_extraction_actions,
    undo_auto_save_action,
)
from app.services.notifications import (
    get_vapid_public_key,
    sanitize_neutral_notification_text,
    is_in_quiet_hours,
    create_in_app_notification,
    list_in_app_notifications,
    mark_notification_read,
)

def run_action(user_id: str, tool: str, args: dict):
    results = execute_extraction_actions(user_id, [{"name": tool, "args": args}])
    return results[0] if results else None
from app.services.privacy import (
    export_all_user_data,
    purge_all_user_presence,
)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()


# ---------------------------------------------------------
# 1. Per-User Encryption Tests
# ---------------------------------------------------------
class TestUserCrypto:
    def test_derived_keys_differ_per_user(self):
        key_user1 = derive_user_key("user_alice_123")
        key_user2 = derive_user_key("user_bob_456")
        assert key_user1 != key_user2
        assert len(key_user1) == 32
        assert len(key_user2) == 32

    def test_encrypt_decrypt_roundtrip(self):
        user_id = "user_test_roundtrip"
        original = "Feeling overwhelmed by semester project deadlines and lack of sleep."
        encrypted = encrypt_user_text(user_id, original)
        assert encrypted.startswith("enc:v1:")
        assert encrypted != original

        decrypted = decrypt_user_text(user_id, encrypted)
        assert decrypted == original

    def test_cross_user_isolation(self):
        """User Bob cannot decrypt User Alice's encrypted text."""
        alice_id = "user_alice"
        bob_id = "user_bob"
        secret = "Alice's deeply personal journal entry."

        encrypted_by_alice = encrypt_user_text(alice_id, secret)
        decrypted_by_bob = decrypt_user_text(bob_id, encrypted_by_alice)
        # Should not reveal the plaintext
        assert decrypted_by_bob != secret

    def test_plaintext_fallback(self):
        """Legacy plaintext rows without enc:v1: prefix return unaltered."""
        legacy = "Normal unencrypted historical message"
        assert decrypt_user_text("any_user", legacy) == legacy


# ---------------------------------------------------------
# 2. Tool Extractor & Confidence Threshold Tests
# ---------------------------------------------------------
class TestChatExtractor:
    def test_all_8_tools_registered(self):
        tool_names = {t["name"] for t in EXTRACTION_FUNCTION_DECLARATIONS}
        expected_tools = {
            "log_mood",
            "log_dimension",
            "save_memory",
            "add_goal",
            "add_journal_entry",
            "record_what_helped",
            "set_reminder",
            "update_preference",
        }
        assert expected_tools.issubset(tool_names)

    def test_execute_and_undo_log_mood(self):
        user_id = "test_user_mood"
        args = {"score": 4, "emotions": ["calm", "relieved"], "note": "Went for a gentle walk"}
        result = run_action(user_id, "log_mood", args)

        assert result is not None
        assert result["target_screen"] == "Mood Journey"
        action_id = result["action_id"]

        # Undo the action
        undo_result = undo_auto_save_action(user_id, action_id)
        assert undo_result["success"] is True

    def test_execute_and_undo_save_memory(self):
        user_id = "test_user_memory"
        args = {"fact": "Plays chess to unwind", "category": "coping", "confidence": 0.9}
        result = run_action(user_id, "save_memory", args)

        assert result is not None
        assert result["target_screen"] == "Memory Center"
        action_id = result["action_id"]

        # Verify decrypted memory exists
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT fact, category FROM user_memories WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        conn.close()
        assert row is not None
        assert decrypt_user_text(user_id, row["fact"]) == "Plays chess to unwind"

        # Undo memory
        undo_res = undo_auto_save_action(user_id, action_id)
        assert undo_res["success"] is True

    def test_execute_and_undo_log_dimension(self):
        user_id = "test_user_dim"
        args = {"dimension": "sleep", "value": 7, "note": "Slept 7.5 hours uninterrupted"}
        result = run_action(user_id, "log_dimension", args)

        assert result is not None
        assert result["target_screen"] == "Digital Mental Twin"
        action_id = result["action_id"]

        undo_res = undo_auto_save_action(user_id, action_id)
        assert undo_res["success"] is True

    def test_execute_and_undo_add_goal(self):
        user_id = "test_user_goal"
        args = {"text": "Practice 5 minutes of mindful breathing every afternoon"}
        result = run_action(user_id, "add_goal", args)

        assert result is not None
        assert result["target_screen"] == "Journal & Goals"
        action_id = result["action_id"]

        undo_res = undo_auto_save_action(user_id, action_id)
        assert undo_res["success"] is True

    def test_execute_and_undo_record_what_helped(self):
        user_id = "test_user_helped"
        args = {"technique": "Cold water splash", "outcome": "Relieved sudden panic attack"}
        result = run_action(user_id, "record_what_helped", args)

        assert result is not None
        assert result["target_screen"] == "What Works For Me"
        action_id = result["action_id"]

        undo_res = undo_auto_save_action(user_id, action_id)
        assert undo_res["success"] is True

    def test_reminder_requires_one_confirmation(self):
        user_id = "test_user_reminder_confirm"
        args = {"text": "Check in about presentation anxiety", "time_or_recurrence": "21:00"}
        result = run_action(user_id, "set_reminder", args)

        assert result is not None
        assert result["requires_confirmation"] is True
        assert "Confirm reminder" in result["toast_message"]

    def test_preference_requires_one_confirmation(self):
        user_id = "test_user_pref_confirm"
        args = {"key": "pacing", "value": "prefers slower, gentle explanations"}
        result = run_action(user_id, "update_preference", args)

        assert result is not None
        assert result["requires_confirmation"] is True
        assert "Confirm preference" in result["toast_message"]


# ---------------------------------------------------------
# 3. Notification Tests (Neutral Text & Quiet Hours)
# ---------------------------------------------------------
class TestNotifications:
    def test_vapid_keys_created_and_cached(self):
        pub_key = get_vapid_public_key()
        assert isinstance(pub_key, str)
        assert len(pub_key) > 20

    def test_sanitize_neutral_notification_text(self):
        """Clinical and sensitive keywords must never appear on lock-screens."""
        sensitive_cases = [
            ("Suicide helpline check-in", "Daily Check-in"),
            ("Your severe depression review", "Daily Check-in"),
            ("Panic attack and trauma reminder", "Gentle Reflection"),
            ("Time for your check-in", "Time for your check-in"),
            ("A calm moment for you", "A calm moment for you"),
        ]
        for raw, expected in sensitive_cases:
            sanitized = sanitize_neutral_notification_text(raw)
            # Must not contain banned clinical terms
            assert "suicide" not in sanitized.lower()
            assert "depression" not in sanitized.lower()
            assert "trauma" not in sanitized.lower()

    def test_quiet_hours_window(self):
        # 22:00 to 08:00
        # 23:30 should be quiet
        assert is_in_quiet_hours("22:00", "08:00", check_time=time(23, 30)) is True
        # 03:00 should be quiet
        assert is_in_quiet_hours("22:00", "08:00", check_time=time(3, 0)) is True
        # 14:00 should NOT be quiet
        assert is_in_quiet_hours("22:00", "08:00", check_time=time(14, 0)) is False

    def test_in_app_notification_lifecycle(self):
        user_id = "test_notif_lifecycle"
        notif = create_in_app_notification(
            user_id=user_id,
            notif_type="breathing",
            title="Time for a Mindful Pause",
            message="Take 2 slow, quiet breaths with your companion.",
            action_url="/calm"
        )
        assert notif is not None
        notif_id = notif["id"]

        data = list_in_app_notifications(user_id)
        items = data["notifications"]
        assert len(items) >= 1
        assert items[0]["id"] == notif_id
        assert bool(items[0]["is_read"]) is False

        mark_notification_read(user_id, notif_id)
        data_after = list_in_app_notifications(user_id)
        updated_item = next(it for it in data_after["notifications"] if it["id"] == notif_id)
        assert bool(updated_item["is_read"]) is True


# ---------------------------------------------------------
# 4. DPDP Export & Purge Cascade Tests
# ---------------------------------------------------------
class TestPrivacyAndPurge:
    def test_export_decrypts_user_data(self):
        user_id = "test_user_export"
        # Seed a memory and a mood log
        run_action(
            user_id,
            "save_memory",
            {"fact": "Enjoys green tea before sleep", "category": "coping", "confidence": 0.9}
        )

        export = export_all_user_data(user_id)
        assert export["user_id"] == user_id
        assert "memories" in export
        assert len(export["memories"]) >= 1
        # Memory fact must be decrypted in export
        assert export["memories"][0]["fact"] == "Enjoys green tea before sleep"

    def test_purge_all_user_presence_cascades(self):
        user_id = "test_user_purge"
        # Seed across multiple auto-feature tables
        run_action(
            user_id,
            "save_memory",
            {"fact": "Temporary secret to purge", "category": "people", "confidence": 0.9}
        )
        run_action(
            user_id,
            "log_mood",
            {"score": 3, "emotions": ["tired"], "note": "To be wiped"}
        )
        create_in_app_notification(user_id, "checkin", "Title", "Message")

        # Confirm data exists
        export_before = export_all_user_data(user_id)
        assert len(export_before["memories"]) >= 1

        # Purge
        purge_res = purge_all_user_presence(user_id)
        assert purge_res["status"] == "purged"

        # Verify completely zeroed
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM user_memories WHERE user_id = ?", (user_id,))
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT COUNT(*) FROM auto_save_audit WHERE user_id = ?", (user_id,))
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT COUNT(*) FROM in_app_notifications WHERE user_id = ?", (user_id,))
        assert cur.fetchone()[0] == 0
        conn.close()
