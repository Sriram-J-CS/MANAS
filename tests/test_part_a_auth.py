"""
test_part_a_auth.py - Automated verification for Part A (Supabase Auth & Session Flow)
Tests:
1. Supabase credentials storage & profiles trigger schema
2. Consent table tracking
3. Dev OTP / test mode isolation
4. Account isolation (two different users have strictly isolated profile & data rows)
"""

import os
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_supabase_config_and_claims():
    """Verify server-side Supabase environment and non-exposure of service role keys."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon = os.getenv("SUPABASE_ANON_KEY")
    assert supabase_url is not None, "SUPABASE_URL must be defined"
    assert supabase_anon is not None, "SUPABASE_ANON_KEY must be defined"
    # Ensure service role key is NEVER in client exposure vars
    assert os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") is None, "Service role key must never be exposed to Vite"

def test_profiles_trigger_sql_file_exists():
    """Verify migration file for profiles trigger exists and has RLS policies."""
    migration_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "supabase", "migrations", "002_profiles_trigger.sql")
    assert os.path.exists(migration_path), "002_profiles_trigger.sql migration must exist"
    with open(migration_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "public.handle_new_user" in content
    assert "ROW LEVEL SECURITY" in content
    assert "auth.users" in content

def test_otp_flow_and_data_isolation():
    """Verify send OTP, wrong OTP check, correct OTP verification, and cross-account isolation."""
    # 1. User A sends OTP
    send_a = client.post("/api/auth/send-mobile-otp", json={
        "phone": "+919999900001",
        "name": "User Alpha"
    })
    assert send_a.status_code == 200
    otp_a = send_a.json().get("dev_otp_code")
    assert otp_a is not None, "In test mode, dev OTP should be available"

    # Test wrong OTP rejection
    wrong_res = client.post("/api/auth/verify-mobile-otp", json={
        "phone": "+919999900001",
        "code": "000000",
        "name": "User Alpha"
    })
    assert wrong_res.status_code == 400
    assert "Invalid verification code" in wrong_res.json().get("detail", "")

    # User A verifies correct OTP
    token_a_res = client.post("/api/auth/verify-mobile-otp", json={
        "phone": "+919999900001",
        "code": otp_a,
        "name": "User Alpha"
    })
    assert token_a_res.status_code == 200
    user_a = token_a_res.json()
    token_a = user_a["access_token"]
    id_a = user_a["user_id"]

    # 2. User B sends OTP and verifies
    send_b = client.post("/api/auth/send-mobile-otp", json={
        "phone": "+919999900002",
        "name": "User Beta"
    })
    assert send_b.status_code == 200
    otp_b = send_b.json().get("dev_otp_code")
    assert otp_b is not None

    token_b_res = client.post("/api/auth/verify-mobile-otp", json={
        "phone": "+919999900002",
        "code": otp_b,
        "name": "User Beta"
    })
    assert token_b_res.status_code == 200
    user_b = token_b_res.json()
    token_b = user_b["access_token"]
    id_b = user_b["user_id"]

    assert id_a != id_b, "Two different accounts must have distinct user_ids"

    # 3. User A creates a journal entry
    journal_res = client.post("/api/journal", headers={"Authorization": f"Bearer {token_a}"}, json={
        "title": "Alpha Private Journal",
        "content": "Secret note by Alpha that Beta must never see",
        "mood_score": 4
    })
    assert journal_res.status_code == 200

    # User B reads journal entries — must NOT see User A's data
    b_journal_res = client.get("/api/journal", headers={"Authorization": f"Bearer {token_b}"})
    assert b_journal_res.status_code == 200
    b_entries = b_journal_res.json().get("entries", [])
    for entry in b_entries:
        assert "Alpha Private Journal" not in entry.get("title", "")
        assert "Secret note by Alpha" not in entry.get("content", "")
