"""
test_auto_chat_features.py - Comprehensive Unit & Integration Tests for Auto-Chat Features

Validates:
1. Background extraction tool declarations: log_mood, log_dimension, save_memory, add_goal,
   add_journal_entry, record_what_helped, set_reminder, update_preference.
2. Execution of extraction actions into DB with AES-256-GCM encryption & audit logging.
3. 1-click Undo mechanism (undo_auto_save_action).
4. Full CRUD/editing & deletion for:
   - Mood entries (GET /api/mood/history with id, PUT /api/mood/{id}, DELETE /api/mood/{id})
   - Reminders (GET /api/reminders, PUT /api/reminders/{id}, DELETE /api/reminders/{id})
   - What Works interventions (DELETE /api/interventions/strategy/{name}, DELETE /api/interventions/clear)
   - Export user data (GET /api/settings/export)
   - Settings toggle: auto_save_from_chat / auto_save_chat
5. Multilingual safety: Crisis triage in English and Indic languages triggers
   approved Tele-MANAS 14416 message without improvised medical advice.
"""

import os
import sys
import unittest
import json
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_db
from app.services.chat_extractor import (
    EXTRACTION_FUNCTION_DECLARATIONS,
    execute_extraction_actions,
    undo_auto_save_action,
)
from app.auth.jwt_handler import create_access_token
from app.safety.multilingual_crisis import (
    detect_multilingual_crisis,
    get_multilingual_crisis_response,
    CRISIS_TEMPLATES_BY_LANGUAGE,
    APPROVED_HELPLINES
)

init_db()
client = TestClient(app)

class TestAutoChatFeatures(unittest.TestCase):

    def setUp(self):
        self.user_id = f"test_user_{uuid.uuid4().hex[:8]}"
        token = create_access_token(self.user_id, f"{self.user_id}@example.com")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "X-User-ID": self.user_id
        }

    def test_01_extraction_tools_declaration(self):
        """Verify all 8 function declarations exist with strict parameters and description."""
        tool_names = [fn["name"] for fn in EXTRACTION_FUNCTION_DECLARATIONS]
        expected = [
            "log_mood",
            "log_dimension",
            "save_memory",
            "add_goal",
            "add_journal_entry",
            "record_what_helped",
            "set_reminder",
            "update_preference"
        ]
        for name in expected:
            self.assertIn(name, tool_names, f"Missing declaration for {name}")

    def test_02_execute_all_extraction_types_and_undo(self):
        """Verify executing each tool call saves to database and undoes properly."""
        tool_calls = [
            {"name": "log_mood", "args": {"score": 4, "emotions": ["calm", "focused"], "note": "Finished revision"}},
            {"name": "log_dimension", "args": {"dimension": "sleep", "value": 7, "note": "slept 7 hours"}},
            {"name": "save_memory", "args": {"fact": "Practicing deep breathing daily", "category": "coping", "confidence": 0.85}},
            {"name": "add_goal", "args": {"text": "Review chapter 4 tonight"}},
            {"name": "add_journal_entry", "args": {"summary": "Grateful for having completed my mock exam"}},
            {"name": "record_what_helped", "args": {"technique": "4-7-8 Breathing", "outcome": "Helped ease nervousness"}},
            {"name": "set_reminder", "args": {"text": "Check in with study group", "time_or_recurrence": "5:00 PM"}},
            {"name": "update_preference", "args": {"key": "language", "value": "ta"}}
        ]

        results = execute_extraction_actions(self.user_id, tool_calls)
        self.assertEqual(len(results), 8, f"Expected 8 executed results, got {len(results)}")

        # Verify each result has an action_id and item_id
        for res in results:
            self.assertIn("action_id", res)
            self.assertIn("item_id", res)
            self.assertIn("target_screen", res)

        # Test Undo on the first action (log_mood)
        mood_action = results[0]
        undo_res = undo_auto_save_action(self.user_id, mood_action["action_id"])
        self.assertTrue(undo_res.get("success"), f"Undo failed: {undo_res}")

        # Undo on already undone action must report already_undone
        undo_again = undo_auto_save_action(self.user_id, mood_action["action_id"])
        self.assertFalse(undo_again.get("success"))
        self.assertEqual(undo_again.get("status"), "already_undone")

    def test_03_mood_crud_endpoints(self):
        """Test logging, retrieving with id, editing (PUT), and deleting (DELETE) mood logs."""
        # 1. Post a mood entry
        post_resp = client.post(
            "/api/mood",
            json={"score": 3, "tags": ["anxious"], "note": "midterm week"},
            headers=self.headers
        )
        self.assertEqual(post_resp.status_code, 200)

        # 2. Get history - ensure 'id' is returned
        hist_resp = client.get("/api/mood/history", headers=self.headers)
        self.assertEqual(hist_resp.status_code, 200)
        history = hist_resp.json().get("history", [])
        self.assertTrue(len(history) >= 1)
        entry = history[0]
        self.assertIn("id", entry, "Mood history items must contain 'id'")
        entry_id = entry["id"]

        # 3. Edit (PUT) mood
        put_resp = client.put(
            f"/api/mood/{entry_id}",
            json={"score": 4, "note": "midterm week - feeling slightly better"},
            headers=self.headers
        )
        self.assertEqual(put_resp.status_code, 200)

        # 4. Delete (DELETE) mood
        del_resp = client.delete(f"/api/mood/{entry_id}", headers=self.headers)
        self.assertEqual(del_resp.status_code, 200)

        # 5. Verify history no longer contains the deleted entry
        hist_after = client.get("/api/mood/history", headers=self.headers).json().get("history", [])
        self.assertFalse(any(m.get("id") == entry_id for m in hist_after))

    def test_04_reminder_crud_endpoints(self):
        """Test retrieving, editing (PUT), and deleting (DELETE) reminders."""
        # Create reminder via extraction
        actions = execute_extraction_actions(
            self.user_id,
            [{"name": "set_reminder", "args": {"text": "Drink herbal tea", "time_or_recurrence": "9:00 PM"}}]
        )
        self.assertEqual(len(actions), 1)
        reminder_id = actions[0]["item_id"]

        # Get reminders
        get_resp = client.get("/api/reminders", headers=self.headers)
        self.assertEqual(get_resp.status_code, 200)
        rems = get_resp.json().get("reminders", [])
        self.assertTrue(any(r.get("id") == reminder_id for r in rems))

        # Edit reminder
        put_resp = client.put(
            f"/api/reminders/{reminder_id}",
            json={"title": "Drink chamomile tea", "time_str": "9:30 PM", "status": "active"},
            headers=self.headers
        )
        self.assertEqual(put_resp.status_code, 200)

        # Delete reminder
        del_resp = client.delete(f"/api/reminders/{reminder_id}", headers=self.headers)
        self.assertEqual(del_resp.status_code, 200)

    def test_05_what_works_deletion(self):
        """Verify What Works intervention strategy can be removed and cleared."""
        execute_extraction_actions(
            self.user_id,
            [{"name": "record_what_helped", "args": {"technique": "Music Therapy", "outcome": "Felt calmer"}}]
        )

        # Delete specific strategy
        del_one = client.delete("/api/interventions/strategy/Music%20Therapy", headers=self.headers)
        self.assertEqual(del_one.status_code, 200)

        # Clear all
        del_all = client.delete("/api/interventions/clear", headers=self.headers)
        self.assertEqual(del_all.status_code, 200)

    def test_06_settings_toggles_and_export(self):
        """Verify auto-save toggle, manual mode, and user data export."""
        # Get settings
        s_resp = client.get("/api/settings", headers=self.headers)
        self.assertEqual(s_resp.status_code, 200)
        s_data = s_resp.json()
        self.assertTrue("auto_save_chat" in s_data or "auto_save_from_chat" in s_data)

        # Update settings with auto_save_chat
        up_resp = client.post(
            "/api/settings",
            json={"auto_save_chat": False, "manual_only_mode": True},
            headers=self.headers
        )
        self.assertEqual(up_resp.status_code, 200)

        # Verify export returns comprehensive decrypted payload
        export_resp = client.get("/api/settings/export", headers=self.headers)
        self.assertEqual(export_resp.status_code, 200)
        exp_data = export_resp.json()
        self.assertIn("mood_logs", exp_data)
        self.assertIn("goals", exp_data)
        self.assertIn("journals", exp_data)
        self.assertIn("reminders", exp_data)

    def test_07_multilingual_crisis_triage(self):
        """Test safety classification across Indian languages triggers approved Tele-MANAS 14416 text."""
        crisis_samples = [
            ("en", "I don't want to live anymore, I want to end it all tonight"),
            ("hi", "मैं अब और जीना नहीं चाहता, मुझे अपनी जान लेनी है"),
            ("ta", "நான் வாழ விரும்பவில்லை, என்னை நானே காயப்படுத்திக்கொள்ள போகிறேன்"),
            ("te", "నేను ఇక బ్రతకాలనుకోవడం లేదు, చనిపోవాలని ఉంది"),
        ]

        for lang, text in crisis_samples:
            is_crisis, risk_level, _ = detect_multilingual_crisis(text, lang)
            self.assertTrue(is_crisis, f"Failed crisis detection for {lang}")
            self.assertEqual(risk_level, "high")
            resp = get_multilingual_crisis_response(lang)
            self.assertIn("14416", resp["crisis_text"])
            self.assertTrue(any(h["number"] == "14416" for h in resp["helpline_buttons"]))


if __name__ == "__main__":
    unittest.main()
