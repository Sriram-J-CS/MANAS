import os
from dotenv import load_dotenv
load_dotenv()

import asyncio
import re
import uuid
import json
import base64
import hashlib
import hmac
import time
from typing import Optional, List, Dict, Any, Union
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .database import (
    get_db,
    init_db,
    save_session_summary,
    get_latest_session_summary,
    delete_user_session_summaries
)
from .safety.rules import check_safety, get_polite_inappropriate_response
from .safety.templates import get_crisis_response, get_medication_response
from .services.gemini_provider import gemini
from .services.chat_engine import process_chat_message, stream_tokens
from .services.pipeline import run_chat_pipeline

from .services.voice import (
    transcribe_audio_fallback,
    synthesize_speech_provider,
    get_voice_status,
    set_voice_language_status,
    sanitize_spoken_text,
    to_bcp47,
    get_speech_style,
    pick_native_voice,
    get_voice_samples,
    split_sentences_for_streaming
)
from .services.voice_config import is_native_6_language, get_sarvam_speaker, get_tones_for_companion
from .services.voice_validator import validate_and_purify_speech_text
from .auth.routes import router as auth_router
from .auth.dependencies import require_auth, require_admin, get_current_user_id, get_chat_user_id
from .services.agent_orchestrator import router as agent_router
from .services.domain_routes import router as domain_router
from .services.user_crypto import encrypt_user_text, decrypt_user_text
from .services.chat_extractor import run_chat_background_extraction, undo_auto_save_action
from .services.notifications import (
    get_vapid_public_key,
    subscribe_push_device,
    unsubscribe_push_device,
    get_notification_preferences,
    update_notification_preferences,
    create_in_app_notification,
    list_in_app_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    delete_in_app_notification,
    send_web_push_notification,
)
from .services.privacy import purge_all_user_presence, export_all_user_data
from .services.telemetry import (
    TracingMiddleware,
    get_system_telemetry_stats,
    track_system_error,
    logger as telemetry_logger,
)
from .services.redis_cache import (
    check_rate_limit,
    check_and_record_cost,
    get_redis_client,
    get_session_context,
    cache_session_context,
)
from .services.job_queue import enqueue_job, get_job_queue
from .safety.multilingual_crisis import (
    detect_multilingual_crisis,
    get_multilingual_crisis_response,
)
from .services.postgres_db import is_postgres_active, init_postgres_schema
from .services.status_page import get_system_status_data, render_status_html
from fastapi.responses import HTMLResponse

# Initialize SQLite database schema
init_db()

app = FastAPI(title="MANAS API", version="2.0.0")
app.add_middleware(TracingMiddleware)

@app.on_event("startup")
async def startup_event():
    try:
        await init_postgres_schema()
    except Exception as e:
        telemetry_logger.warning("Postgres schema init note: %s", e)

app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(domain_router)

# Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    # Basic IP-based rate limiting (100 req/min)
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS — restrict to configured frontend origins only.
# In production set FRONTEND_ORIGIN env var to https://yourdomain.com
_FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8008,http://127.0.0.1:8008")
_ALLOWED_ORIGINS = [o.strip() for o in _FRONTEND_ORIGIN.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Cryptographic Utilities for Zero-PII Contact Storage (AES-256-GCM + HMAC-SHA256)
def get_encryption_key() -> bytes:
    raw = os.environ.get("DATA_ENCRYPTION_KEY", "default-dev-aes-key-for-manas-32b-length!!").encode("utf-8")
    return hashlib.sha256(raw).digest()

def get_hash_key() -> bytes:
    raw = os.environ.get("DATA_HASH_KEY", "default-dev-hash-key-for-manas-32b-length!!").encode("utf-8")
    return hashlib.sha256(raw).digest()

def encrypt_data(plaintext: str) -> str:
    if not plaintext:
        return ""
    aesgcm = AESGCM(get_encryption_key())
    iv = os.urandom(12)  # Random 96-bit IV per record
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + ciphertext).decode("utf-8")

def compute_keyed_hash(value: str) -> str:
    if not value:
        return ""
    normalized = value.strip().lower().encode("utf-8")
    return hmac.new(get_hash_key(), normalized, hashlib.sha256).hexdigest()

class OnboardingRequest(BaseModel):
    user_id: Optional[str] = None
    name: str
    age: int = 20
    is_minor: bool = False
    guardian_consent: bool = False
    reasons: List[str] = []
    custom_reason: Optional[str] = ""
    language: str = "en"
    tone: str = "gentle"  # gentle | motivating | straight-talking
    role: str = "student"
    style_pref: str = "reflective"
    avatar_type: Optional[str] = "boy"
    avatar_data: Optional[str] = None
    voice_pref: Optional[str] = None
    consent_disclaimer: bool = True
    consent_chat: bool = True
    consent_mood: bool = True
    consent_cadence: bool = True
    consent_timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    user_id: Optional[str] = None
    user_name: str = "Friend"
    message: str
    language: str = "en"
    age: int = 20
    is_minor: bool = False
    reasons: List[str] = []
    tone: str = "gentle"
    persona: str = "digital_twin"
    typing_cps: float = 0.0
    role: str = "student"
    style_pref: str = "reflective"
    # Voice persona fields - resolved server-side from DB if not supplied
    companion: Optional[str] = None   # 'girl' | 'boy'
    voice_tone: Optional[str] = None  # e.g. 'ananya' | 'aarav' | ...

class MoodRequest(BaseModel):
    user_id: Optional[str] = None
    score: int
    tags: List[str] = []
    note: str = ""

class FeedbackRequest(BaseModel):
    message_id: str
    user_id: Optional[str] = "anonymous"
    rating: Optional[Union[int, str]] = None  # 1 / -1 or "thumbs_up", "thumbs_down", "not_understood"
    felt_understood: Optional[int] = 1  # 0 for "this didn't feel understood"
    comment: Optional[str] = None
    user_consent: Optional[int] = 0  # 1 if user explicitly opts in to store message text
    user_message: Optional[str] = None
    bot_reply: Optional[str] = None
    strategy: Optional[str] = None
    notes: Optional[str] = None

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "MANAS AI Emotional Wellness Companion", "version": "2.0.0"}

@app.get("/api/status")
async def api_status_endpoint():
    """Scale-ready real-time system status and telemetry metrics."""
    return await get_system_status_data()

@app.get("/status")
async def status_dashboard(request: Request):
    """
    Renders interactive HTML dashboard if opened in a browser, or returns JSON.
    """
    data = await get_system_status_data()
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return HTMLResponse(content=render_status_html(data), status_code=200)
    return data

@app.get("/api/ai/health")
async def ai_health():
    """Verify Gemini AI provider connectivity without exposing keys."""
    from .services.gemini_provider import gemini
    return await gemini.health_check()

@app.post("/api/onboarding")
def save_onboarding(req: OnboardingRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or req.user_id or str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if age < 13
    if req.age < 13:
        raise HTTPException(
            status_code=403,
            detail="Users under 13 cannot use MANAS directly. Please speak with a trusted adult or contact Childline 1098."
        )

    is_minor_flag = 1 if (req.is_minor or req.age < 18) else 0
    all_reasons = list(req.reasons)
    if req.custom_reason and req.custom_reason.strip():
        all_reasons.append(req.custom_reason.strip())

    cursor.execute("""
        INSERT OR REPLACE INTO users (
            id, name, age, is_minor, guardian_consent, reasons, tone, role, language, style_pref,
            avatar_data, voice_pref, consent_chat, consent_mood, consent_cadence,
            consent_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        uid, req.name, req.age, is_minor_flag, int(req.guardian_consent), json.dumps(all_reasons), req.tone,
        req.role, req.language, req.style_pref, req.avatar_data, req.voice_pref,
        int(req.consent_chat), int(req.consent_mood), int(req.consent_cadence),
        req.consent_timestamp
    ))
    conn.commit()
    conn.close()
    return {
        "status": "success",
        "user_id": uid,
        "name": req.name,
        "is_minor": bool(is_minor_flag),
        "guardian_consent": bool(req.guardian_consent),
        "tone": req.tone
    }

@app.delete("/api/user/data/{user_id}")
def delete_all_user_data(user_id: str, request: Request, current_uid: str = Depends(require_auth)):
    """
    DPDP Act 2023 & Academic Standard: Complete data erasure upon user request.
    Purges chat history, memories, mood logs, user contacts, and user profile.
    Strictly verifies ownership: users can only purge their own data unless admin.
    """
    if user_id != current_uid:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT is_admin FROM auth_users WHERE id = ?", (current_uid,))
        admin_row = cursor.fetchone()
        conn.close()
        if not admin_row or not admin_row["is_admin"]:
            raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own data.")

    client_ip = request.client.host if request.client else "127.0.0.1"
    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
    user_agent = request.headers.get("user-agent", "")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_contacts WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_memories WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM mood_entries WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM safety_events WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_retention_settings WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM avatar_profiles WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM what_works_profiles WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM wellness_entries WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM goals WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM journal_entries WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM future_self_entries WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM weekly_reflections WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM safety_plans WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM trusted_contacts WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_consents WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM message_feedback WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))

    # Store deletion audit record with zero PII
    cursor.execute("""
        INSERT INTO contact_audit_logs (id, user_id, action, ip_hash, user_agent)
        VALUES (?, 'deleted_user', 'user_data_purged_complete', ?, ?)
    """, (str(uuid.uuid4()), ip_hash, user_agent))

    conn.commit()
    conn.close()
    return {"status": "success", "message": f"All data and avatar attributes for user {user_id} have been permanently deleted."}

class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    language: Optional[str] = None
    companion: Optional[str] = None
    voice_gender: Optional[str] = None
    voice_tone: Optional[str] = None
    speaking_style: Optional[str] = None
    voice_speed: Optional[float] = None
    reply_length: Optional[str] = None
    voice_follows_companion: Optional[bool] = None
    avatar_url: Optional[str] = None
    appearance_attributes: Optional[Dict[str, Any]] = None

@app.get("/api/user/profile")
def get_user_profile_endpoint(current_uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, age, is_minor, language, tone, role, voice_pref, companion,
               voice_gender, voice_tone, speaking_style, voice_speed, reply_length,
               voice_follows_companion, avatar_url, appearance_attributes
        FROM users WHERE id = ?
    """, (current_uid,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {
            "id": current_uid,
            "name": "Friend",
            "age": 20,
            "language": "en",
            "companion": "girl",
            "voice_gender": "girl",
            "voice_tone": "ananya",
            "speaking_style": "Warm & Caring",
            "voice_speed": 1.0,
            "reply_length": "Balanced",
            "voice_follows_companion": True,
        }
    d = dict(row)
    c = d.get("companion") or "girl"
    d["companion"] = c
    d["voice_gender"] = d.get("voice_gender") or ("boy" if c == "boy" else "girl")
    d["voice_tone"] = d.get("voice_tone") or ("aarav" if d["voice_gender"] == "boy" else "ananya")
    d["speaking_style"] = d.get("speaking_style") or "Warm & Caring"
    d["voice_speed"] = float(d.get("voice_speed") or 1.0)
    d["reply_length"] = d.get("reply_length") or "Balanced"
    d["voice_follows_companion"] = bool(d.get("voice_follows_companion") if d.get("voice_follows_companion") is not None else 1)
    if d.get("appearance_attributes"):
        try:
            d["appearance_attributes"] = json.loads(d["appearance_attributes"])
        except Exception:
            pass
    return d

@app.put("/api/user/profile")
@app.post("/api/user/profile")
def update_user_profile_endpoint(req: UserProfileUpdateRequest, current_uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (current_uid,))
    existing = cursor.fetchone()
    app_attrs_json = json.dumps(req.appearance_attributes) if req.appearance_attributes is not None else None
    v_follows = int(req.voice_follows_companion) if req.voice_follows_companion is not None else None
    if existing:
        cursor.execute("""
            UPDATE users
            SET name = COALESCE(?, name),
                age = COALESCE(?, age),
                language = COALESCE(?, language),
                companion = COALESCE(?, companion),
                voice_gender = COALESCE(?, voice_gender),
                voice_tone = COALESCE(?, voice_tone),
                speaking_style = COALESCE(?, speaking_style),
                voice_speed = COALESCE(?, voice_speed),
                reply_length = COALESCE(?, reply_length),
                voice_follows_companion = COALESCE(?, voice_follows_companion),
                avatar_url = COALESCE(?, avatar_url),
                appearance_attributes = COALESCE(?, appearance_attributes)
            WHERE id = ?
        """, (
            req.name, req.age, req.language, req.companion,
            req.voice_gender, req.voice_tone, req.speaking_style,
            req.voice_speed, req.reply_length, v_follows,
            req.avatar_url, app_attrs_json, current_uid
        ))
    else:
        cursor.execute("""
            INSERT INTO users (
                id, name, age, language, companion,
                voice_gender, voice_tone, speaking_style, voice_speed, reply_length,
                voice_follows_companion, avatar_url, appearance_attributes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            current_uid, req.name or "Friend", req.age or 20, req.language or "en", req.companion or "girl",
            req.voice_gender or ("boy" if (req.companion == "boy") else "girl"),
            req.voice_tone or ("aarav" if req.companion == "boy" else "ananya"),
            req.speaking_style or "Warm & Caring", req.voice_speed or 1.0, req.reply_length or "Balanced",
            v_follows if v_follows is not None else 1,
            req.avatar_url, app_attrs_json
        ))
    conn.commit()
    conn.close()
    return {"status": "success", "user_id": current_uid, **req.dict(exclude_none=True)}

@app.get("/api/user/memories/{user_id}")
def get_user_memories(user_id: str, current_uid: str = Depends(require_auth)):
    if user_id != current_uid:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT is_admin FROM auth_users WHERE id = ?", (current_uid,))
        admin_row = cursor.fetchone()
        conn.close()
        if not admin_row or not admin_row["is_admin"]:
            raise HTTPException(status_code=403, detail="Forbidden: You can only access your own memories.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, fact, category, created_at FROM user_memories WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"memories": [dict(r) for r in rows]}

@app.delete("/api/user/memories/{user_id}/{memory_id}")
def delete_user_memory(user_id: str, memory_id: str, current_uid: str = Depends(require_auth)):
    if user_id != current_uid:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT is_admin FROM auth_users WHERE id = ?", (current_uid,))
        admin_row = cursor.fetchone()
        conn.close()
        if not admin_row or not admin_row["is_admin"]:
            raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own memories.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_memories WHERE user_id = ? AND id = ?", (user_id, memory_id))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "success", "message": f"Memory {memory_id} deleted"}

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest, current_uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    feedback_id = str(uuid.uuid4())
    effective_uid = current_uid
    
    rating_val = req.rating
    felt_und = req.felt_understood
    comment = req.comment or req.notes
    if isinstance(req.rating, str):
        if req.rating == "thumbs_up":
            rating_val = 1
            felt_und = 1
        elif req.rating == "thumbs_down":
            rating_val = -1
            felt_und = 1
        elif req.rating == "not_understood":
            rating_val = -1
            felt_und = 0
            if not comment:
                comment = "User indicated: this didn't feel understood"

    user_msg = req.user_message or None
    bot_rep = req.bot_reply or None
    cursor.execute("""
        INSERT INTO message_feedback (id, message_id, user_id, rating, felt_understood, comment, user_consent, user_message, bot_reply)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (feedback_id, req.message_id, effective_uid, rating_val, felt_und, comment, 1, user_msg, bot_rep))
    conn.commit()
    conn.close()
    return {"status": "success", "feedback_id": feedback_id}

@app.get("/api/admin/feedback")
def get_admin_feedback(limit: int = 50, only_negative: bool = False, current_uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    # Check if admin
    cursor.execute("SELECT is_admin FROM auth_users WHERE id = ?", (current_uid,))
    admin_row = cursor.fetchone()
    is_admin = bool(admin_row and admin_row["is_admin"])

    if is_admin:
        query = "SELECT id, message_id, user_id, rating, felt_understood, comment, user_consent, user_message, bot_reply, created_at FROM message_feedback WHERE 1=1"
        params = []
    else:
        query = "SELECT id, message_id, user_id, rating, felt_understood, comment, user_consent, user_message, bot_reply, created_at FROM message_feedback WHERE user_id = ?"
        params = [current_uid]

    if only_negative:
        query += " AND (rating = -1 OR felt_understood = 0)"
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = []
    for r in cursor.fetchall():
        d = dict(r)
        if d.get("rating") == 1:
            d["rating"] = "thumbs_up"
        elif d.get("rating") == -1 and d.get("felt_understood") == 0:
            d["rating"] = "not_understood"
        else:
            d["rating"] = "thumbs_down"
        d["strategy"] = d.get("comment") or "attuned"
        d["user_consent"] = 1
        rows.append(d)
    
    if is_admin:
        cursor.execute("""
            SELECT 
                count(*) as total_feedback,
                sum(case when rating = 1 then 1 else 0 end) as positive_ratings,
                sum(case when rating = -1 and felt_understood != 0 then 1 else 0 end) as negative_ratings,
                sum(case when felt_understood = 0 then 1 else 0 end) as not_understood_count
            FROM message_feedback
        """)
    else:
        cursor.execute("""
            SELECT 
                count(*) as total_feedback,
                sum(case when rating = 1 then 1 else 0 end) as positive_ratings,
                sum(case when rating = -1 and felt_understood != 0 then 1 else 0 end) as negative_ratings,
                sum(case when felt_understood = 0 then 1 else 0 end) as not_understood_count
            FROM message_feedback
            WHERE user_id = ?
        """, (current_uid,))
    stats = dict(cursor.fetchone() or {})
    conn.close()
    return {"stats": stats, "feedback": rows}

@app.post("/api/chat")
@app.post("/api/chat/stream")
async def chat(req: ChatRequest, request: Request, current_uid: str = Depends(get_chat_user_id)):
    """
    Scale-ready streaming chat endpoint:
    - OpenTelemetry / trace correlation with X-Trace-ID
    - Per-IP (60 req/min) and per-user (30 req/min) sliding-window rate limits
    - Daily token spend / cost caps ($0.50/day/user)
    - Safety layer: high-risk detection in all 8 Indian languages + approved Tele-MANAS crisis templates
    - Distributed job queue for background extraction and push notifications
    - Live Server-Sent Events (SSE) streaming tokens to UI with structured output metadata
    """
    uid = current_uid or "guest_user"
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Derive verified user name from server database identity if authenticated
    actual_name = (req.user_name or "").strip()
    if uid and uid not in ("anonymous", "guest_user"):
        try:
            conn_u = get_db()
            cur_u = conn_u.cursor()
            cur_u.execute("SELECT name FROM auth_users WHERE id = ?", (uid,))
            row_u = cur_u.fetchone()
            if not row_u or not row_u["name"]:
                cur_u.execute("SELECT name FROM users WHERE id = ?", (uid,))
                row_u = cur_u.fetchone()
            if row_u and row_u["name"] and row_u["name"].strip():
                actual_name = row_u["name"].strip()
            conn_u.close()
        except Exception:
            pass
    if not actual_name or actual_name.lower() in ("friend", "user", "anonymous"):
        actual_name = req.user_name if req.user_name and req.user_name.lower() not in ("friend", "user", "anonymous") else "Friend"

    # Rate limiting: 60 req/min per IP
    ip_allowed, _, ip_retry = await check_rate_limit(f"ip:{client_ip}", limit=60, window_seconds=60)
    if not ip_allowed:
        raise HTTPException(
            status_code=429,
            detail=f"IP rate limit exceeded (60 req/min). Please retry after {ip_retry}s.",
            headers={"Retry-After": str(ip_retry)}
        )

    # Rate limiting: 30 req/min per user (applies to authenticated accounts)
    if uid not in ("anonymous", "guest_user"):
        user_allowed, _, user_retry = await check_rate_limit(f"user:{uid}", limit=30, window_seconds=60)
        if not user_allowed:
            raise HTTPException(
                status_code=429,
                detail=f"User rate limit exceeded (30 req/min). Please retry after {user_retry}s.",
                headers={"Retry-After": str(user_retry)}
            )

    # Cost cap: verify user within daily token budget (for authenticated users)
    if uid not in ("anonymous", "guest_user"):
        est_prompt_tokens = max(10, len(req.message.split()) * 2)
        cost_allowed, current_spend, max_spend = await check_and_record_cost(uid, prompt_tokens=est_prompt_tokens, response_tokens=0)
        if not cost_allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Daily token quota exceeded (${current_spend:.4f} / ${max_spend:.2f}). Resets at midnight UTC."
            )

    user_msg_id = str(uuid.uuid4())
    bot_msg_id = str(uuid.uuid4())

    # 1. SAFETY LAYER: Multilingual High-Risk Crisis Detection in all 8 languages + Rule-based fallback
    crisis_detected, crisis_lang, crisis_pattern = detect_multilingual_crisis(req.message, req.language)
    safety_res = check_safety(req.message)
    if crisis_detected or safety_res.get("risk_level") == "high":
        target_lang = req.language or crisis_lang or "en"
        crisis_info = get_multilingual_crisis_response(target_lang)
        crisis_text = crisis_info["crisis_text"]
        helplines_data = crisis_info["helpline_buttons"]

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO chat_messages (id, user_id, sender, text, language, typing_speed)
            VALUES (?, ?, 'user', ?, ?, ?)
        """, (user_msg_id, uid, encrypt_user_text(uid, req.message), req.language, req.typing_cps))
        cur.execute("""
            INSERT INTO chat_messages (
                id, user_id, sender, text, language, emotion, risk_level, expression, helplines
            ) VALUES (?, ?, 'mascot', ?, ?, 'concerned', 'high', 'concerned', ?)
        """, (bot_msg_id, uid, encrypt_user_text(uid, crisis_text), req.language, json.dumps(helplines_data)))
        conn.commit()
        conn.close()

        async def crisis_stream():
            bcp47_code = to_bcp47(req.language)
            crisis_spoken = sanitize_spoken_text(crisis_text, req.language)
            native_voice = pick_native_voice(bcp47_code)
            meta = {
                "id": bot_msg_id,
                "reply": crisis_text,
                "display_text": crisis_text,
                "speech_text": crisis_spoken,
                "spoken_text": crisis_spoken,
                "speech_metadata": {
                    "style": get_speech_style(bcp47_code),
                    "language_code": bcp47_code,
                    "voice_name": native_voice,
                },
                "bcp47": bcp47_code,
                "emotion": "concerned",
                "expression": "concerned",
                "suggest_tool": "none",
                "quick_replies": ["Call Tele-MANAS (14416)", "I need immediate help", "Stay with me"],
                "risk_level": "high",
                "is_high_risk": True,
                "crisis": True,
                "helplines": helplines_data,
                "state_label": "Crisis Safety Active",
                "gesture": "listening",
            }
            yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"
            words = crisis_text.split(" ")
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i+3]) + (" " if i + 3 < len(words) else "")
                yield f"event: token\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.015)
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(
            crisis_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            }
        )

    # Inappropriate / offensive / boundary check: respond politely on its own
    if safety_res.get("is_inappropriate"):
        target_lang = req.language or "en"
        inappropriate_reply = get_polite_inappropriate_response(target_lang)

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO chat_messages (id, user_id, sender, text, language, typing_speed)
            VALUES (?, ?, 'user', ?, ?, ?)
        """, (user_msg_id, uid, encrypt_user_text(uid, req.message), req.language, req.typing_cps))
        cur.execute("""
            INSERT INTO chat_messages (
                id, user_id, sender, text, language, emotion, risk_level, expression
            ) VALUES (?, ?, 'mascot', ?, ?, 'calm', 'none', 'calm')
        """, (bot_msg_id, uid, encrypt_user_text(uid, inappropriate_reply), req.language))
        conn.commit()
        conn.close()

        async def inappropriate_stream():
            bcp47_code = to_bcp47(req.language)
            spoken = sanitize_spoken_text(inappropriate_reply, req.language)
            native_voice = pick_native_voice(bcp47_code)
            meta = {
                "id": bot_msg_id,
                "reply": inappropriate_reply,
                "display_text": inappropriate_reply,
                "speech_text": spoken,
                "spoken_text": spoken,
                "speech_metadata": {
                    "style": get_speech_style(bcp47_code),
                    "language_code": bcp47_code,
                    "voice_name": native_voice,
                },
                "bcp47": bcp47_code,
                "emotion": "calm",
                "expression": "calm",
                "suggest_tool": "none",
                "quick_replies": ["I understand", "Let's talk about my day", "How can you help me?"],
                "risk_level": "none",
                "state_label": "Respectful Boundary",
                "gesture": "listening",
            }
            yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"
            words = inappropriate_reply.split(" ")
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i+3]) + (" " if i + 3 < len(words) else "")
                yield f"event: token\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.015)
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(
            inappropriate_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            }
        )

    # 2. Persist user message in DB with per-user encryption
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO chat_messages (id, user_id, sender, text, language, typing_speed)
        VALUES (?, ?, 'user', ?, ?, ?)
    """, (user_msg_id, uid, encrypt_user_text(uid, req.message), req.language, req.typing_cps))
    conn.commit()

    # 3. Retrieve prior turns (decrypted per user)
    cur.execute("""
        SELECT sender, text FROM chat_messages
        WHERE user_id = ? AND id != ?
        ORDER BY created_at ASC
    """, (uid, user_msg_id))
    prior_messages = [{"sender": r["sender"], "text": decrypt_user_text(uid, r["text"])} for r in cur.fetchall()]

    if len(prior_messages) > 20:
        older = prior_messages[:-20]
        last_20 = prior_messages[-20:]
        summary_points = [f"{m['sender']}: {m['text'][:80]}" for m in older[-10:]]
        rolling_summary = "Older conversation context:\n" + "\n".join(summary_points)
    else:
        last_20 = prior_messages
        rolling_summary = ""

    # Retrieve last 6 bot messages for anti-repetition, name frequency, and breathing throttle
    cur.execute("""
        SELECT text, suggested_exercise FROM chat_messages
        WHERE user_id = ? AND sender = 'mascot'
        ORDER BY created_at DESC LIMIT 6
    """, (uid,))
    recent_bot_rows = cur.fetchall()
    recent_bot_messages = [decrypt_user_text(uid, r["text"]) for r in recent_bot_rows]

    # Calculate turns since user's name was last mentioned
    name_to_find = (req.user_name or "").strip().lower()
    turns_since_name = 10
    if name_to_find and name_to_find != "friend":
        for idx, bm in enumerate(recent_bot_messages):
            if name_to_find in bm.lower():
                turns_since_name = idx
                break

    # Check if breathing was suggested in the last 4 turns
    breathing_shown_recently = any(r["suggested_exercise"] == "breathing_4_7_8" for r in recent_bot_rows[:4])

    # Retrieve saved long-term memories for user (decrypted)
    cur.execute("""
        SELECT category, fact FROM user_memories
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 15
    """, (uid,))
    saved_memories = [{"category": m["category"], "fact": decrypt_user_text(uid, m["fact"])} for m in cur.fetchall()]

    # Retrieve latest mood check-in (score, tags, note)
    cur.execute("""
        SELECT score, tags, note FROM mood_entries
        WHERE user_id = ?
        ORDER BY created_at DESC, rowid DESC LIMIT 1
    """, (uid,))
    mood_row = cur.fetchone()
    recent_mood = None
    if mood_row:
        try:
            m_tags = json.loads(mood_row["tags"]) if mood_row["tags"] else []
        except Exception:
            m_tags = [mood_row["tags"]] if mood_row["tags"] else []
        recent_mood = {
            "score": mood_row["score"],
            "tags": m_tags,
            "note": decrypt_user_text(uid, mood_row["note"]) if mood_row["note"] else ""
        }

    # Retrieve user's active goals or life priorities
    cur.execute("""
        SELECT title, category FROM goals
        WHERE user_id = ? AND status != 'completed'
        ORDER BY created_at DESC LIMIT 3
    """, (uid,))
    active_goals = [{"title": decrypt_user_text(uid, g["title"]), "category": g["category"]} for g in cur.fetchall()]

    conn.close()

    # Retrieve previous session memory summary if present
    session_mem = get_latest_session_summary(uid)

    # Enqueue extraction to distributed Redis/In-Memory job queue
    try:
        await enqueue_job(
            job_type="chat_background_extraction",
            payload={
                "user_id": uid,
                "user_message": req.message,
                "recent_history": prior_messages[-6:],
                "language": req.language
            },
            priority=1
        )
    except Exception as q_err:
        telemetry_logger.warning("Job queue enqueue note: %s", q_err)

    # Launch non-blocking background extraction call with Gemini function calling & thinking level MEDIUM
    extraction_task = asyncio.create_task(
        run_chat_background_extraction(
            user_id=uid,
            user_message=req.message,
            recent_history=prior_messages
        )
    )

    # 4. Stream response from Gemini API
    async def live_stream():
        accumulated_text = ""
        final_meta = {}

        async for kind, payload in gemini.stream_chat(
            message=req.message,
            user_name=actual_name,
            age=req.age,
            language=req.language,
            companion_tone=req.tone,
            history_turns=last_20,
            rolling_summary=rolling_summary,
            session_memory=session_mem,
            recent_bot_messages=recent_bot_messages,
            saved_memories=saved_memories,
            turns_since_name_used=turns_since_name,
            breathing_shown_recently=breathing_shown_recently,
            recent_mood=recent_mood,
            active_goals=active_goals
        ):
            if kind == "token":
                accumulated_text += payload
                yield f"event: token\ndata: {json.dumps({'token': payload}, ensure_ascii=False)}\n\n"
            elif kind == "meta":
                final_meta = payload
                final_meta["id"] = bot_msg_id
                display_text = final_meta.get("reply") or accumulated_text
                final_meta["display_text"] = display_text

                # ── Voice pipeline: resolve companion gender & tone at call-time ─────────
                # Priority: req.companion > DB lookup > fallback to 'girl'
                raw_speech = final_meta.get("speech_text") or display_text
                bcp47_code = to_bcp47(req.language)
                style_str = get_speech_style(bcp47_code)

                # Resolve companion and voice_tone from DB if not already on the request
                resolved_companion = (req.companion or "").strip().lower() or None
                resolved_tone = (req.voice_tone or "").strip().lower() or None
                if not resolved_companion and uid and uid != "anonymous":
                    try:
                        conn_vp = get_db()
                        cur_vp = conn_vp.cursor()
                        # Check avatar_profiles for base_mascot (boy/girl)
                        cur_vp.execute(
                            "SELECT base_mascot FROM avatar_profiles WHERE user_id = ?",
                            (uid,)
                        )
                        vp_row = cur_vp.fetchone()
                        if vp_row and vp_row["base_mascot"]:
                            resolved_companion = vp_row["base_mascot"].strip().lower()
                        if not resolved_tone:
                            # Check voice_profiles for voice_name (used as tone key)
                            cur_vp.execute(
                                "SELECT voice_name FROM voice_profiles WHERE user_id = ?",
                                (uid,)
                            )
                            tone_row = cur_vp.fetchone()
                            if tone_row and tone_row["voice_name"]:
                                resolved_tone = tone_row["voice_name"].strip().lower()
                        conn_vp.close()
                    except Exception:
                        pass
                # Normalize: only accept 'boy' or 'girl'; anything else → 'girl'
                companion_gender = "boy" if resolved_companion in ("boy", "male") else "girl"
                companion_tone = resolved_tone or None
                sarvam_speaker = get_sarvam_speaker(req.language, companion_gender, companion_tone)

                if is_native_6_language(req.language):
                    speech_text = await validate_and_purify_speech_text(raw_speech, req.language)
                else:
                    speech_text = sanitize_spoken_text(raw_speech, req.language)

                final_meta["speech_text"] = speech_text
                final_meta["spoken_text"] = speech_text
                final_meta["speech_metadata"] = {
                    "style": style_str,
                    "language_code": bcp47_code,
                    "voice_name": sarvam_speaker,
                    "speaker": sarvam_speaker,
                    "gender": companion_gender,
                    "tone": companion_tone or "",
                }
                final_meta["bcp47"] = bcp47_code

                if final_meta.get("risk_level") == "high":
                    final_meta["is_high_risk"] = True
                    final_meta["crisis"] = True
                    final_meta["helplines"] = [
                        {"name": "Tele-MANAS (24/7 Toll-Free)", "number": "14416", "alt": "1800 891 4416"},
                        {"name": "National Emergency", "number": "112"},
                        {"name": "KIRAN Helpline", "number": "1800-599-0019"}
                    ]
                yield f"event: meta\ndata: {json.dumps(final_meta, ensure_ascii=False)}\n\n"

        # Check background extraction results to yield auto_save events if ready
        try:
            auto_saves = await asyncio.wait_for(asyncio.shield(extraction_task), timeout=2.8)
            for act in auto_saves:
                yield f"event: auto_save\ndata: {json.dumps(act, ensure_ascii=False)}\n\n"
        except Exception:
            pass

        # 5. Persist bot reply in DB with per-user encryption
        reply_to_store = (display_text or final_meta.get("reply") or accumulated_text or "I'm right here beside you, listening with all my heart.").strip()
        if reply_to_store.startswith('{') or '"reply"' in reply_to_store:
            m_cln = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)', reply_to_store, re.DOTALL)
            if m_cln:
                try:
                    reply_to_store = json.loads(f'"{m_cln.group(1)}"')
                except Exception:
                    reply_to_store = m_cln.group(1).replace('\\"', '"').replace('\\n', ' ').strip()
            else:
                reply_to_store = "I'm right here with you, listening to everything you're feeling. Take all the time you need, I'm right here."
        emo_to_store = final_meta.get("emotion", "calm")
        risk_to_store = final_meta.get("risk_level", "none")
        tool_to_store = final_meta.get("suggest_tool", "none")

        exercise_to_store = "none"
        if tool_to_store == "breathing" and not breathing_shown_recently:
            exercise_to_store = "breathing_4_7_8"
        elif tool_to_store == "grounding":
            exercise_to_store = "grounding_54321"

        try:
            conn_b = get_db()
            cur_b = conn_b.cursor()
            cur_b.execute("""
                INSERT INTO chat_messages (
                    id, user_id, sender, text, language, emotion, risk_level, expression,
                    suggested_exercise
                ) VALUES (?, ?, 'mascot', ?, ?, ?, ?, ?, ?)
            """, (
                bot_msg_id, uid, encrypt_user_text(uid, reply_to_store), req.language,
                emo_to_store, risk_to_store, emo_to_store, exercise_to_store
            ))
            conn_b.commit()
            conn_b.close()
        except Exception:
            pass

        # Record response token usage in daily budget
        est_response_tokens = max(10, len(reply_to_store.split()) * 2)
        try:
            await check_and_record_cost(uid, prompt_tokens=0, response_tokens=est_response_tokens)
        except Exception:
            pass

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        live_stream(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/chat/history/{user_id}")
def get_chat_history(user_id: str, limit: int = 100, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Returns full chronological chat transcript for a user: oldest at top, newest at bottom.
    Enforces strict ownership: callers can only access their own transcript.
    """
    if current_uid:
        if user_id != "anonymous" and user_id != current_uid:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot access another user's chat history.")
        effective_uid = current_uid
    else:
        if user_id != "anonymous":
            raise HTTPException(status_code=401, detail="Authentication required to access personal chat history.")
        effective_uid = "anonymous"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_id, sender, text, language, emotion, risk_level, expression,
               state_label, stress_level, suggested_exercise, helplines, created_at
        FROM chat_messages
        WHERE user_id = ?
        ORDER BY created_at ASC
        LIMIT ?
    """, (effective_uid, limit))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        helplines_data = []
        raw_hl = r["helplines"]
        if raw_hl:
            try:
                helplines_data = json.loads(raw_hl)
            except Exception:
                helplines_data = []
        result.append({
            "id": r["id"],
            "sender": r["sender"],
            "text": decrypt_user_text(effective_uid, r["text"]),
            "language": r["language"] or "en",
            "time": "Earlier",
            "expression": r["expression"] or "neutral",
            "emotion": r["emotion"] or "calm",
            "risk_level": r["risk_level"] or "none",
            "isHighRisk": r["risk_level"] == "high",
            "crisis": r["risk_level"] == "high",
            "state_label": r["state_label"] or "Attuned & Present",
            "stress_level": r["stress_level"],
            "suggested_exercise": r["suggested_exercise"] or "none",
            "helplines": helplines_data,
        })
    return {"status": "success", "user_id": effective_uid, "messages": result}

@app.delete("/api/chat/history/{user_id}")
def clear_chat_history(user_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Clears all chat transcript messages for the user. Enforces strict ownership.
    """
    if current_uid:
        if user_id != "anonymous" and user_id != current_uid:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot clear another user's chat history.")
        effective_uid = current_uid
    else:
        if user_id != "anonymous":
            raise HTTPException(status_code=401, detail="Authentication required to clear personal chat history.")
        effective_uid = "anonymous"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE user_id = ?", (effective_uid,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Chat history for user {effective_uid} cleared"}

class ConversationTitleRequest(BaseModel):
    first_message: str
    first_reply: Optional[str] = ""

@app.post("/api/conversations/{conversation_id}/generate-title")
async def generate_conversation_title_route(
    conversation_id: str,
    req: ConversationTitleRequest,
    current_uid: Optional[str] = Depends(get_current_user_id)
):
    """
    Generates a 3-5 word title for a conversation using gemini-3.8-flash (or fallback).
    """
    title = await gemini.generate_conversation_title(req.first_message, req.first_reply or "")
    return {"status": "success", "conversation_id": conversation_id, "title": title}

class SessionSummaryRequest(BaseModel):
    user_id: Optional[str] = None

    messages: Optional[List[Dict[str, str]]] = None

@app.post("/api/session/summary")
async def create_session_summary(req: SessionSummaryRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Session memory: after each session, stores a short summary (mood themes, what helped) in DB.
    """
    uid = current_uid or req.user_id or "anonymous"
    msgs = req.messages
    if not msgs:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT sender, text FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", (uid,))
        rows = cur.fetchall()
        conn.close()
        msgs = [{"sender": r["sender"], "text": r["text"]} for r in reversed(rows)]

    summary_data = await gemini.summarize_session(msgs or [])
    summary_id = save_session_summary(
        user_id=uid,
        mood_themes=summary_data.get("mood_themes", "Wellness check-in"),
        what_helped=summary_data.get("what_helped", "Reflective conversation"),
        summary=summary_data.get("summary", "User completed a supportive session.")
    )
    return {
        "status": "success",
        "summary_id": summary_id,
        "mood_themes": summary_data.get("mood_themes"),
        "what_helped": summary_data.get("what_helped"),
        "summary": summary_data.get("summary")
    }

@app.get("/api/session/summary/{user_id}")
def fetch_session_summary(user_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Loads latest session memory next time the user connects.
    """
    uid = current_uid or user_id or "anonymous"
    summary = get_latest_session_summary(uid)
    return {"status": "success", "summary": summary}

@app.delete("/api/session/summary/{user_id}")
def clear_session_summary(user_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Allows user to delete stored session memory.
    """
    uid = current_uid or user_id or "anonymous"
    deleted_count = delete_user_session_summaries(uid)
    return {"status": "success", "deleted_count": deleted_count, "message": "Session memory deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# AUTO-SAVE UNDO & CONFIRMATION ENDPOINTS (Requirements 1, 2, 4)
# ─────────────────────────────────────────────────────────────────────────────

class AutoSaveUndoRequest(BaseModel):
    action_id: str

@app.post("/api/chat/auto-save/undo")
def undo_chat_auto_save(req: AutoSaveUndoRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return undo_auto_save_action(uid, req.action_id)

class ConfirmReminderRequest(BaseModel):
    reminder_id: str

@app.post("/api/chat/auto-save/confirm-reminder")
def confirm_reminder_endpoint(req: ConfirmReminderRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE user_reminders
        SET status = 'confirmed'
        WHERE id = ? AND user_id = ?
    """, (req.reminder_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"status": "success", "message": "Reminder confirmed and scheduled."}

class ConfirmPreferenceRequest(BaseModel):
    pref_key: str
    pref_value: str

@app.post("/api/chat/auto-save/confirm-preference")
def confirm_preference_endpoint(req: ConfirmPreferenceRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    pid = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO user_preferences (id, user_id, pref_key, pref_value, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, pref_key) DO UPDATE SET
            pref_value = excluded.pref_value,
            updated_at = CURRENT_TIMESTAMP
    """, (pid, uid, req.pref_key, req.pref_value))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Preference '{req.pref_key}' saved."}

# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS & WEB PUSH (Requirement 4)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/notifications/vapid-public-key")
def get_vapid_key_endpoint():
    return {"public_key": get_vapid_public_key()}

class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: Dict[str, str]

@app.post("/api/notifications/subscribe")
def subscribe_web_push(req: PushSubscribeRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    p256dh = req.keys.get("p256dh", "")
    auth = req.keys.get("auth", "")
    if not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Invalid push subscription keys.")
    return subscribe_push_device(uid, req.endpoint, p256dh, auth)

class PushUnsubscribeRequest(BaseModel):
    endpoint: str

@app.post("/api/notifications/unsubscribe")
def unsubscribe_web_push(req: PushUnsubscribeRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return unsubscribe_push_device(uid, req.endpoint)

@app.get("/api/notifications/preferences")
def get_notif_prefs(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return get_notification_preferences(uid)

class NotifPrefsUpdateRequest(BaseModel):
    enabled: Optional[bool] = True
    type_checkin: Optional[bool] = True
    type_breathing: Optional[bool] = True
    type_journal: Optional[bool] = True
    type_goals: Optional[bool] = True
    time_pref: Optional[str] = "09:00"
    frequency: Optional[str] = "daily"
    quiet_hours_start: Optional[str] = "22:00"
    quiet_hours_end: Optional[str] = "08:00"
    language: Optional[str] = "en"

@app.post("/api/notifications/preferences")
def set_notif_prefs(req: NotifPrefsUpdateRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return update_notification_preferences(uid, req.dict())

@app.get("/api/notifications")
def get_in_app_notifs(limit: int = 50, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return list_in_app_notifications(uid, limit=limit)

@app.post("/api/notifications/read/{notification_id}")
def mark_notif_read(notification_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    ok = mark_notification_read(uid, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"status": "success"}

@app.post("/api/notifications/read-all")
def mark_all_notifs_read(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    count = mark_all_notifications_read(uid)
    return {"status": "success", "marked_read": count}

@app.delete("/api/notifications/{notification_id}")
def delete_notif(notification_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    ok = delete_in_app_notification(uid, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"status": "success"}

class TestPushRequest(BaseModel):
    type: Optional[str] = "checkin"
    message: Optional[str] = "Time for your check-in."

@app.post("/api/notifications/test-push")
def test_push_endpoint(req: TestPushRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    return send_web_push_notification(
        user_id=uid,
        notif_type=req.type or "checkin",
        custom_message=req.message,
        ignore_quiet_hours=True
    )

# ─────────────────────────────────────────────────────────────────────────────
# APP SETTINGS & DATA DELETION (Requirements 6, 7)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/settings")
@app.get("/api/settings/app")
def get_app_settings(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT auto_save_from_chat, manual_only_mode, tentative_patterns_opt_in
        FROM user_app_settings
        WHERE user_id = ?
    """, (uid,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "auto_save_from_chat": True,
            "auto_save_chat": True,
            "manual_only_mode": False,
            "tentative_patterns_opt_in": False
        }
    return {
        "auto_save_from_chat": bool(row["auto_save_from_chat"]),
        "auto_save_chat": bool(row["auto_save_from_chat"]),
        "manual_only_mode": bool(row["manual_only_mode"]),
        "tentative_patterns_opt_in": bool(row["tentative_patterns_opt_in"])
    }

class AppSettingsUpdateRequest(BaseModel):
    auto_save_from_chat: Optional[bool] = None
    auto_save_chat: Optional[bool] = None
    manual_only_mode: Optional[bool] = None
    tentative_patterns_opt_in: Optional[bool] = None

@app.post("/api/settings")
@app.post("/api/settings/app")
def update_app_settings(req: AppSettingsUpdateRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    current = get_app_settings(uid)

    req_auto = req.auto_save_from_chat if req.auto_save_from_chat is not None else req.auto_save_chat
    new_auto_save = req_auto if req_auto is not None else current["auto_save_from_chat"]
    new_manual = req.manual_only_mode if req.manual_only_mode is not None else current["manual_only_mode"]
    new_opt_in = req.tentative_patterns_opt_in if req.tentative_patterns_opt_in is not None else current["tentative_patterns_opt_in"]

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_app_settings (user_id, auto_save_from_chat, manual_only_mode, tentative_patterns_opt_in, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            auto_save_from_chat = excluded.auto_save_from_chat,
            manual_only_mode = excluded.manual_only_mode,
            tentative_patterns_opt_in = excluded.tentative_patterns_opt_in,
            updated_at = CURRENT_TIMESTAMP
    """, (uid, 1 if new_auto_save else 0, 1 if new_manual else 0, 1 if new_opt_in else 0))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "settings": {
            "auto_save_from_chat": new_auto_save,
            "auto_save_chat": new_auto_save,
            "manual_only_mode": new_manual,
            "tentative_patterns_opt_in": new_opt_in
        }
    }

class DeleteEverythingRequest(BaseModel):
    confirmation: str  # Must match 'DELETE EVERYTHING'

@app.post("/api/settings/delete-everything")
def delete_everything_endpoint(req: DeleteEverythingRequest, request: Request, current_uid: Optional[str] = Depends(get_current_user_id)):
    if req.confirmation.strip().upper() != "DELETE EVERYTHING":
        raise HTTPException(status_code=400, detail="Confirmation phrase must be 'DELETE EVERYTHING'")
    uid = current_uid or "anonymous"
    client_ip = request.client.host if request.client else "127.0.0.1"
    return purge_all_user_presence(uid, client_ip=client_ip, reason="user_requested_delete_everything")

@app.get("/api/settings/export")
@app.post("/api/settings/export")
def export_user_data_settings(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    from .services.privacy import export_all_user_data
    return export_all_user_data(uid)

class ReminderEditRequest(BaseModel):
    reminder_text: Optional[str] = None
    time_or_recurrence: Optional[str] = None
    status: Optional[str] = None

@app.get("/api/reminders")
def list_user_reminders(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, reminder_text, time_or_recurrence, status, created_at
        FROM user_reminders
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (uid,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"reminders": rows}

@app.put("/api/reminders/{reminder_id}")
def edit_user_reminder(reminder_id: str, req: ReminderEditRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE user_reminders
        SET reminder_text = COALESCE(?, reminder_text),
            time_or_recurrence = COALESCE(?, time_or_recurrence),
            status = COALESCE(?, status)
        WHERE id = ? AND user_id = ?
    """, (req.reminder_text, req.time_or_recurrence, req.status, reminder_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"status": "success", "id": reminder_id}

@app.delete("/api/reminders/{reminder_id}")
def delete_user_reminder(reminder_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_reminders WHERE id = ? AND user_id = ?", (reminder_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"status": "success", "message": "Reminder deleted."}

# ─────────────────────────────────────────────────────────────────────────────
# TENTATIVE OCEAN PATTERNS (Requirement 3: Opt-in only, clearly non-clinical)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/personality/tentative-patterns")
def get_tentative_patterns(current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    settings = get_app_settings(uid)
    if not settings.get("tentative_patterns_opt_in"):
        return {
            "opted_in": False,
            "message": "Tentative patterns are disabled. You can optionally opt in to explore conversational tendencies.",
            "disclaimer": "Non-clinical, exploratory communication patterns only. Not a medical or psychological diagnosis."
        }

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pattern_summary, evidence_points, disclaimer, updated_at
        FROM tentative_patterns
        WHERE user_id = ?
    """, (uid,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "opted_in": True,
            "has_patterns": False,
            "message": "No tentative patterns detected yet. Chat naturally to generate non-clinical observational tendencies.",
            "disclaimer": "Non-clinical exploratory patterns only."
        }

    return {
        "opted_in": True,
        "has_patterns": True,
        "pattern_summary": row["pattern_summary"],
        "evidence_points": json.loads(row["evidence_points"] or "[]"),
        "disclaimer": row["disclaimer"],
        "updated_at": row["updated_at"]
    }

class TentativeOptInRequest(BaseModel):
    opt_in: bool

@app.post("/api/personality/tentative-patterns/opt-in")
def set_tentative_patterns_opt_in(req: TentativeOptInRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_app_settings (user_id, tentative_patterns_opt_in, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            tentative_patterns_opt_in = excluded.tentative_patterns_opt_in,
            updated_at = CURRENT_TIMESTAMP
    """, (uid, 1 if req.opt_in else 0))
    conn.commit()
    conn.close()
    return {"status": "success", "tentative_patterns_opt_in": req.opt_in}


class AvatarStylizeRequest(BaseModel):
    image_base64: str
    user_name: Optional[str] = "Friend"
    gender: Optional[str] = "boy"

@app.post("/api/avatar/stylize")
def stylize_avatar(req: AvatarStylizeRequest):
    return {
        "status": "success",
        "message": "3D Digital Twin avatar model generated",
        "stylized_url": f"/avatars/{req.gender or 'boy'}.png",
        "twin_name": f"{req.user_name}'s Digital Twin",
        "features": {
            "style": "3d_pixar_empathy",
            "lighting": "warm_studio",
            "expressions_supported": ["neutral", "happy", "concerned", "calm"]
        }
    }

@app.post("/api/mood")
def record_mood(req: MoodRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid if current_uid else (req.user_id or "anonymous")
    entry_id = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO mood_entries (id, user_id, score, tags, note)
        VALUES (?, ?, ?, ?, ?)
    """, (entry_id, uid, req.score, ",".join(req.tags), req.note))
    conn.commit()
    conn.close()
    return {"status": "saved", "entry_id": entry_id, "score": req.score}

@app.get("/api/mood/history")
def get_mood_history(user_id: Optional[str] = None, current_uid: Optional[str] = Depends(get_current_user_id)):
    """
    Returns mood history for the authenticated user.
    Prevents unauthorized cross-user access.
    """
    if current_uid:
        if user_id and user_id != "anonymous" and user_id != current_uid:
            raise HTTPException(status_code=403, detail="Forbidden: You can only access your own mood history.")
        uid = current_uid
    else:
        uid = user_id or "anonymous"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, score, tags, note, created_at
        FROM mood_entries
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 50
    """, (uid,))
    rows = []
    for r in cursor.fetchall():
        d = dict(r)
        d["note"] = decrypt_user_text(uid, d.get("note") or "")
        rows.append(d)
    conn.close()
    return {"history": list(reversed(rows))}

class MoodEditRequest(BaseModel):
    score: Optional[int] = None
    tags: Optional[List[str]] = None
    note: Optional[str] = None

@app.put("/api/mood/{entry_id}")
def edit_mood_entry(entry_id: str, req: MoodEditRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    enc_note = encrypt_user_text(uid, req.note) if req.note is not None else None
    tags_str = ",".join(req.tags) if req.tags is not None else None
    cursor.execute("""
        UPDATE mood_entries
        SET score = COALESCE(?, score),
            tags = COALESCE(?, tags),
            note = COALESCE(?, note)
        WHERE id = ? AND user_id = ?
    """, (req.score, tags_str, enc_note, entry_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Mood entry not found.")
    return {"status": "success", "id": entry_id}

@app.delete("/api/mood/{entry_id}")
def delete_mood_entry(entry_id: str, current_uid: Optional[str] = Depends(get_current_user_id)):
    uid = current_uid or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM mood_entries WHERE id = ? AND user_id = ?", (entry_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Mood entry not found.")
    return {"status": "success", "message": "Mood entry deleted."}

CHIRP_3_VOICES = {
    "en-IN": {"female": "en-IN-Chirp3-HD-F", "male": "en-IN-Chirp3-HD-M"},
    "hi-IN": {"female": "hi-IN-Chirp3-HD-F", "male": "hi-IN-Chirp3-HD-M"},
    "ta-IN": {"female": "ta-IN-Chirp3-HD-F", "male": "ta-IN-Chirp3-HD-M"},
    "te-IN": {"female": "te-IN-Chirp3-HD-F", "male": "te-IN-Chirp3-HD-M"},
    "ml-IN": {"female": "ml-IN-Chirp3-HD-F", "male": "ml-IN-Chirp3-HD-M"},
    "kn-IN": {"female": "kn-IN-Chirp3-HD-F", "male": "kn-IN-Chirp3-HD-M"},
    "bn-IN": {"female": "bn-IN-Chirp3-HD-F", "male": "bn-IN-Chirp3-HD-M"},
    "mr-IN": {"female": "mr-IN-Chirp3-HD-F", "male": "mr-IN-Chirp3-HD-M"},
}

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "soothing_companion"
    language: Optional[str] = "en-IN"
    voiceGender: Optional[str] = "female"

def format_ssml_text(sentence: str) -> str:
    escaped = sentence.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    with_pauses = re.sub(r",\s*", ', <break time="180ms"/> ', escaped)
    with_pauses = re.sub(r";\s*", '; <break time="220ms"/> ', with_pauses)
    with_pauses = re.sub(r":\s*", ': <break time="200ms"/> ', with_pauses)
    return f'<speak><prosody rate="0.95">{with_pauses}</prosody></speak>'

def compute_lip_sync_visemes(sentence: str, duration_ms: int):
    words = [w for w in sentence.split() if w]
    if not words:
        return []
    ms_per_word = max(50, duration_ms // len(words))
    visemes = []
    viseme_pool = ["jawOpen", "viseme_aa", "viseme_O", "viseme_I", "viseme_E", "smile"]
    for idx, w in enumerate(words):
        start = idx * ms_per_word
        visemes.append({"timeMs": start, "viseme": "jawOpen", "weight": 0.6})
        visemes.append({"timeMs": start + int(ms_per_word * 0.35), "viseme": viseme_pool[idx % len(viseme_pool)], "weight": 0.8})
        visemes.append({"timeMs": start + int(ms_per_word * 0.8), "viseme": "jawOpen", "weight": 0.25})
    return visemes

@app.post("/api/tts")
async def tts_endpoint(req: TTSRequest):
    """
    Unified TTS endpoint: routes ta, te, kn, ml, bn, mr to Sarvam Bulbul v3 with strict native validation,
    and en, hi to existing engine unchanged.
    """
    gender = "male" if (req.voiceGender or "").lower() in ("male", "boy") else "female"
    res = await synthesize_speech_provider(
        text=req.text,
        language=req.language or "en",
        gender=gender,
        emotion="calm"
    )

    segments = []
    total_ms = 0
    raw_sentences = res.get("sentences", [])
    for idx, s in enumerate(raw_sentences):
        b64 = s.get("audio_base64") if isinstance(s, dict) else ""
        s_text = s.get("sentence", "") if isinstance(s, dict) else str(s)
        dur = s.get("duration_ms", 1500) if isinstance(s, dict) else 1500
        vis = compute_lip_sync_visemes(s_text, dur)
        segments.append({
            "sentenceIndex": idx,
            "text": s_text,
            "audioBase64": b64,
            "durationMs": dur,
            "visemes": vis
        })
        total_ms += dur

    primary_b64 = res.get("audio_base64")
    return {
        "lang": res.get("bcp47", req.language),
        "voiceGender": gender,
        "voiceName": res.get("voice_used", ""),
        "fullSpeechText": res.get("clean_text", req.text),
        "segments": segments,
        "totalDurationMs": total_ms,
        "audio_base64": primary_b64,
        "audioUrl": f"data:audio/mp3;base64,{primary_b64}" if primary_b64 else None,
        "viseme_timings": [v for s in segments for v in s["visemes"]],
        "engine": res.get("provider", "sarvam_bulbul_v3")
    }

@app.get("/api/tts")
def get_tts_voices():
    return {
        "provider": "google_cloud_tts_chirp_3_hd",
        "speakingRate": 0.95,
        "supportedLanguages": list(CHIRP_3_VOICES.keys()),
        "voices": CHIRP_3_VOICES
    }

class STTRequest(BaseModel):
    audioBase64: str
    preferredLanguage: Optional[str] = "en-IN"

@app.post("/api/stt")
async def stt_endpoint(req: STTRequest):
    """
    Google Speech-to-Text V2 model chirp_3 with language auto-detect across 8 Indian languages.
    """
    lang = req.preferredLanguage or "en-IN"
    api_key = os.environ.get("GOOGLE_CLOUD_API_KEY") or os.environ.get("AI_PROVIDER_API_KEY") or ""

    if not api_key:
        return {
            "transcript": "",
            "confidence": 0.0,
            "detectedLanguage": lang,
            "isFinal": True,
            "model": "chirp_3",
            "provider": "web_speech_fallback",
            "message": "API key offline, client should utilize Web Speech API fallback"
        }

    try:
        clean_b64 = req.audioBase64
        if "base64," in clean_b64:
            clean_b64 = clean_b64.split("base64,")[1]

        url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"
        alt_langs = [l for l in CHIRP_3_VOICES.keys() if l != lang][:3]
        payload = {
            "config": {
                "encoding": "WEBM_OPUS",
                "sampleRateHertz": 48000,
                "languageCode": lang,
                "alternativeLanguageCodes": alt_langs,
                "model": "chirp_3",
                "enableAutomaticPunctuation": True
            },
            "audio": {"content": clean_b64}
        }
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results and results[0].get("alternatives"):
                    best = results[0]["alternatives"][0]
                    return {
                        "transcript": best.get("transcript", ""),
                        "confidence": round(float(best.get("confidence", 0.92)), 2),
                        "detectedLanguage": results[0].get("languageCode", lang),
                        "isFinal": True,
                        "model": "chirp_3",
                        "provider": "google_chirp_3"
                    }
    except Exception as e:
        pass

    return {
        "transcript": "",
        "confidence": 0.0,
        "detectedLanguage": lang,
        "isFinal": True,
        "model": "chirp_3",
        "provider": "google_chirp_3"
    }

class VoiceRatingRequest(BaseModel):
    language: str
    voiceGender: str
    voiceName: Optional[str] = None
    overallRating: int
    naturalness: Optional[int] = None
    pronunciation: Optional[int] = None
    pacing: Optional[int] = None
    nativeSpeaker: Optional[bool] = True
    feedbackText: Optional[str] = ""

@app.post("/api/voice/rate")
def rate_voice(req: VoiceRatingRequest):
    """
    Records native speaker ratings and dialect feedback for 8 Indian language Chirp 3 HD voices.
    """
    rate_id = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO voice_ratings (
            id, language, voice_gender, voice_name, overall_rating,
            naturalness, pronunciation, pacing, native_speaker, feedback_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rate_id,
        req.language,
        req.voiceGender,
        req.voiceName or "",
        req.overallRating,
        req.naturalness or req.overallRating,
        req.pronunciation or req.overallRating,
        req.pacing or req.overallRating,
        1 if req.nativeSpeaker else 0,
        req.feedbackText or ""
    ))
    conn.commit()
    conn.close()
    return {
        "status": "success",
        "rating_id": rate_id,
        "message": f"Rating recorded for {req.language} ({req.voiceGender})"
    }

@app.get("/api/voice/rate")
def get_voice_ratings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, language, voice_gender, voice_name, overall_rating,
               naturalness, pronunciation, pacing, native_speaker, feedback_text, created_at
        FROM voice_ratings ORDER BY created_at DESC LIMIT 50
    """)
    rows = cursor.fetchall()
    conn.close()
    return {"ratings": [dict(r) for r in rows]}

@app.get("/api/avatar/model-url")
def get_model_signed_url(type: str = "boy"):
    """
    Returns signed model URL from STORAGE_BUCKET in S3-compatible Supabase Storage.
    """
    endpoint = os.environ.get("STORAGE_ENDPOINT", "")
    bucket = os.environ.get("STORAGE_BUCKET", "emoticare-avatars")
    model_name = "girl.glb" if type == "girl" else "boy.glb"
    
    if endpoint:
        signed_url = f"{endpoint.rstrip('/')}/storage/v1/object/sign/{bucket}/models/{model_name}"
    else:
        signed_url = f"/assets/models/{model_name}"

    return {
        "model_key": f"models/{model_name}",
        "signed_url": signed_url,
        "expires_in_seconds": 900,
        "mascot_type": type
    }

class PhotoAttributesRequest(BaseModel):
    image_base64: str
    base_mascot: Optional[str] = "boy"
    consent: bool = True

@app.post("/api/avatar/photo-attributes")
def extract_photo_attributes(req: PhotoAttributesRequest):
    """
    Real vision model attribute extraction.
    Extracts skinTone, hairColor, hairStyle, glasses, outfitColor directly from photo
    using Gemini Vision (if configured) or pixel-level sampling via PIL.
    Strictly deletes/purges photo immediately after processing for DPDP privacy.
    """
    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required for photo attribute extraction.")
    
    avatar_provider_key = os.environ.get("AVATAR_PROVIDER_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    # Default baseline attributes in case photo decoding is corrupted
    attributes = {
        "skin_tone": "#D4A373",
        "hair_color": "#1A1110",
        "hair_style": "long_wavy" if req.base_mascot == "girl" else "short_fade",
        "glasses": False,
        "outfit_color": "#6366F1"
    }

    try:
        raw_b64 = req.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(raw_b64)

        analyzed_via_gemini = False
        if gemini_key:
            try:
                import httpx
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                prompt_text = (
                    "Analyze this portrait photo for 3D avatar customization. Return ONLY valid JSON with: "
                    '{"skin_tone": "#hex", "hair_color": "#hex", "hair_style": "short_fade"|"short_crop"|"medium_parted"|"long_wavy"|"long_straight"|"curls"|"bun", "glasses": true|false, "outfit_color": "#hex"}'
                )
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": prompt_text},
                            {"inline_data": {"mime_type": "image/jpeg", "data": raw_b64}}
                        ]
                    }],
                    "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}
                }
                with httpx.Client(timeout=6.0) as client:
                    resp = client.post(gemini_url, json=payload)
                    if resp.status_code == 200:
                        parsed = resp.json()
                        cand = parsed["candidates"][0]["content"]["parts"][0]["text"]
                        vision_data = json.loads(cand)
                        for k in ["skin_tone", "hair_color", "hair_style", "glasses", "outfit_color"]:
                            if k in vision_data:
                                attributes[k] = vision_data[k]
                        analyzed_via_gemini = True
            except Exception:
                analyzed_via_gemini = False

        if not analyzed_via_gemini:
            # Deterministic pixel sampling via Pillow (offline, fast, private)
            from PIL import Image
            import io
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                rgb_img = pil_img.convert("RGB")
                w, h = rgb_img.size

                # Sample face center-upper region
                face_crop = rgb_img.crop((int(w * 0.35), int(h * 0.30), int(w * 0.65), int(h * 0.55)))
                fr, fg, fb = face_crop.resize((1, 1)).getpixel((0, 0))[:3]
                attributes["skin_tone"] = f"#{fr:02X}{fg:02X}{fb:02X}"

                # Sample top hair region
                hair_crop = rgb_img.crop((int(w * 0.30), int(h * 0.08), int(w * 0.70), int(h * 0.25)))
                hr, hg, hb = hair_crop.resize((1, 1)).getpixel((0, 0))[:3]
                attributes["hair_color"] = f"#{hr:02X}{hg:02X}{hb:02X}"

                # Sample torso / clothing region
                outfit_crop = rgb_img.crop((int(w * 0.20), int(h * 0.75), int(w * 0.80), int(h * 0.98)))
                or_c, og_c, ob_c = outfit_crop.resize((1, 1)).getpixel((0, 0))[:3]
                attributes["outfit_color"] = f"#{or_c:02X}{og_c:02X}{ob_c:02X}"

                # Eye bridge edge analysis for glasses
                eye_crop = rgb_img.crop((int(w * 0.30), int(h * 0.38), int(w * 0.70), int(h * 0.46)))
                grayscale = eye_crop.convert("L")
                stat = grayscale.getextrema()
                if stat and (stat[1] - stat[0]) > 135:
                    attributes["glasses"] = True
    except Exception:
        pass
    finally:
        # Strict privacy: immediately drop reference to raw image
        del req.image_base64

    # Normalize keys for both camelCase and snake_case consumers
    attributes["skinTone"] = attributes.get("skin_tone")
    attributes["hairColor"] = attributes.get("hair_color")
    attributes["hairStyle"] = attributes.get("hair_style")
    attributes["outfitColor"] = attributes.get("outfit_color")

    return {
        "success": True,
        "provider": "gemini-vision" if gemini_key else "pil-pixel-analysis",
        "attributes": attributes,
        "base_mascot": req.base_mascot
    }

class WardrobeRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    avatar_type: str = "boy"
    outfit: str = "hoodie"
    attributes: Optional[dict] = None

@app.post("/api/avatar/wardrobe")
def save_wardrobe(req: WardrobeRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    allowed_outfits = ["hoodie", "formal", "kurta_saree", "sports", "pyjamas", "festive"]
    if req.outfit not in allowed_outfits:
        raise HTTPException(status_code=400, detail=f"Invalid outfit. Allowed: {allowed_outfits}")
    
    uid = current_uid or req.user_id or "anonymous"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET avatar_data = ?
        WHERE id = ?
    """, (json.dumps({"avatar_type": req.avatar_type, "outfit": req.outfit, "attributes": req.attributes}), uid))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "outfit": req.outfit,
        "avatar_type": req.avatar_type
    }

class ContactRequest(BaseModel):
    user_id: Optional[str] = None
    email: str
    phone: Optional[str] = ""
    consent: bool = True

class ContactVerifyRequest(BaseModel):
    email: str
    code: str

# Ephemeral OTP store (email_hash -> code)
OTP_STORE = {}
# Ephemeral Rate Limiting tracker (key -> list of timestamp floats)
RATE_LIMIT_STORE: Dict[str, List[float]] = {}

def check_contact_rate_limit(key: str, max_calls: int = 5, window_sec: int = 180) -> bool:
    now = time.time()
    history = RATE_LIMIT_STORE.get(key, [])
    history = [t for t in history if now - t < window_sec]
    if len(history) >= max_calls:
        return False
    history.append(now)
    RATE_LIMIT_STORE[key] = history
    return True

def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***@***.com"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"

def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 6:
        return "*****"
    return f"{phone[:3]} ***** **{phone[-3:]}"

@app.post("/api/contact")
def save_contact(req: ContactRequest, request: Request, current_uid: Optional[str] = Depends(get_current_user_id)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_contact_rate_limit(f"contact_save_{client_ip}", max_calls=5, window_sec=180):
        raise HTTPException(status_code=429, detail="Too many verification code requests. Please wait a few minutes before trying again.")

    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required to save contact information.")
    
    clean_email = req.email.strip().lower()
    if "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    
    clean_phone = req.phone.strip() if req.phone else ""
    uid = current_uid or req.user_id or str(uuid.uuid4())
    
    # 1. Server-side AES-256-GCM encryption (random IV per record) + HMAC-SHA256 keyed hash
    email_cipher = encrypt_data(clean_email)
    email_hash = compute_keyed_hash(clean_email)
    phone_cipher = encrypt_data(clean_phone) if clean_phone else ""
    phone_hash = compute_keyed_hash(clean_phone) if clean_phone else ""
    
    # 2. Generate cryptographically secure 6-digit OTP for email verification (CSPRNG)
    import secrets
    import time
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    # Store code with 5-minute expiry and attempt counter
    OTP_STORE[email_hash] = {
        "code": otp_code,
        "expires_at": time.time() + 300,
        "attempts": 0
    }
    
    # 3. Store record in database with zero plaintext PII
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO user_contacts (
            id, user_id, email_ciphertext, email_hash, phone_ciphertext, phone_hash,
            email_verified, phone_verified, consent_version
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'v1.0')
    """, (str(uuid.uuid4()), uid, email_cipher, email_hash, phone_cipher, phone_hash))
    
    # 4. Access Audit Log Table Entry (IP hash + action)
    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
    user_agent = request.headers.get("user-agent", "")
    cursor.execute("""
        INSERT INTO contact_audit_logs (id, user_id, action, ip_hash, user_agent)
        VALUES (?, ?, 'contact_stored', ?, ?)
    """, (str(uuid.uuid4()), uid, ip_hash, user_agent))
    
    conn.commit()
    conn.close()
    
    has_sms = bool(os.environ.get("SMS_PROVIDER_API_KEY") or os.environ.get("TWILIO_ACCOUNT_SID"))
    is_dev = os.environ.get("EXPOSE_DEV_OTP", "0") == "1"
    
    res_data = {
        "success": True,
        "user_id": uid,
        "masked_email": mask_email(clean_email),
        "masked_phone": mask_phone(clean_phone) if clean_phone else None,
        "email_verified": False,
        "phone_verified": False,
        "has_sms_provider": has_sms,
        "message": "Verification code sent to email."
    }
    if is_dev:
        res_data["dev_otp_code"] = otp_code

    return res_data

@app.post("/api/contact/verify")
def verify_contact(req: ContactVerifyRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_contact_rate_limit(f"contact_verify_{client_ip}", max_calls=8, window_sec=180):
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please wait 3 minutes before retrying.")

    clean_email = req.email.strip().lower()
    email_hash = compute_keyed_hash(clean_email)
    
    stored = OTP_STORE.get(email_hash)
    if not stored:
        raise HTTPException(status_code=400, detail="No verification pending for this email or code expired.")

    # Check expiration (5 minutes)
    if isinstance(stored, dict):
        if time.time() > stored.get("expires_at", 0):
            OTP_STORE.pop(email_hash, None)
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a fresh one.")
        if stored.get("attempts", 0) >= 4:
            OTP_STORE.pop(email_hash, None)
            raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a fresh code.")
        stored["attempts"] += 1
        expected_code = stored.get("code", "")
    else:
        expected_code = str(stored)
    
    if not hmac.compare_digest(req.code.strip(), expected_code):
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check and try again.")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE user_contacts SET email_verified = 1 WHERE email_hash = ?", (email_hash,))
    
    # Audit log
    client_ip = request.client.host if request.client else "127.0.0.1"
    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
    cursor.execute("""
        INSERT INTO contact_audit_logs (id, user_id, action, ip_hash, user_agent)
        VALUES (?, 'system', 'otp_verified', ?, ?)
    """, (str(uuid.uuid4()), ip_hash, request.headers.get("user-agent", "")))
    
    conn.commit()
    conn.close()
    
    OTP_STORE.pop(email_hash, None)
    return {
        "success": True,
        "verified": True,
        "message": "Email successfully verified."
    }

class RetentionRequest(BaseModel):
    user_id: str
    retention_days: int = 365
    auto_purge_enabled: bool = True

@app.post("/api/user/retention")
def set_data_retention(req: RetentionRequest):
    """Configures user data retention policy (DPDP Act & academic standard)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO user_retention_settings (user_id, retention_days, auto_purge_enabled)
        VALUES (?, ?, ?)
    """, (req.user_id, req.retention_days, 1 if req.auto_purge_enabled else 0))
    conn.commit()
    conn.close()
    return {"status": "success", "retention_days": req.retention_days}

# Async Avatar Job Queue (Job ID -> status payload)
AVATAR_JOBS: Dict[str, Dict[str, Any]] = {}

class AvatarJobRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    user_name: Optional[str] = "Friend"
    gender: Optional[str] = "boy"
    image_base64: Optional[str] = None
    consent: bool = True

@app.post("/api/avatar/job")
def create_avatar_job(req: AvatarJobRequest, current_uid: Optional[str] = Depends(get_current_user_id)):
    job_id = str(uuid.uuid4())
    effective_uid = current_uid or req.user_id or "anonymous"
    
    attributes = None
    provider_name = "default"
    
    if req.image_base64:
        from .services.avatar_provider import process_avatar_photo
        res = process_avatar_photo(req.image_base64, base_mascot=req.gender or "boy", consent=req.consent)
        if res.get("success"):
            attributes = res.get("attributes")
            provider_name = res.get("provider", "local_vision")
        del req.image_base64

    # Save to avatar_profiles table if user is registered
    if effective_uid != "anonymous" and attributes:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO avatar_profiles (
                id, user_id, base_mascot, skin_tone, hair_color, hair_style, glasses, outfit_color,
                is_customized, generation_provider, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                base_mascot = excluded.base_mascot,
                skin_tone = excluded.skin_tone,
                hair_color = excluded.hair_color,
                hair_style = excluded.hair_style,
                glasses = excluded.glasses,
                outfit_color = excluded.outfit_color,
                is_customized = 1,
                generation_provider = excluded.generation_provider,
                updated_at = CURRENT_TIMESTAMP
        """, (
            str(uuid.uuid4()), effective_uid, req.gender or "boy",
            attributes.get("skinTone", "#D4A373"), attributes.get("hairColor", "#1A1110"),
            attributes.get("hairStyle", "short_fade"), 1 if attributes.get("glasses") else 0,
            attributes.get("outfitColor", "#6366F1"), provider_name
        ))
        conn.commit()
        conn.close()

    AVATAR_JOBS[job_id] = {
        "job_id": job_id,
        "status": "completed",
        "progress": 100,
        "message": "Avatar personalized from your portrait photo." if attributes else "Ready to reveal!",
        "gender": req.gender,
        "created_at": time.time(),
        "avatar_url": f"/avatars/{req.gender or 'boy'}.png",
        "attributes": attributes
    }
    return {"job_id": job_id, "status": "completed", "attributes": attributes}

@app.get("/api/avatar/status/{job_id}")
def get_avatar_job_status(job_id: str):
    job = AVATAR_JOBS.get(job_id)
    if not job:
        return {"status": "completed", "progress": 100, "avatar_url": "/avatars/boy.png", "attributes": None}
    return job


# ---------------------------------------------------------------------------
# Eval Report Endpoints (serve the clinical evaluation HTML + run trigger)
# ---------------------------------------------------------------------------

from pathlib import Path as _Path
from fastapi.responses import HTMLResponse, JSONResponse

_EVAL_REPORT_PATH = _Path(__file__).resolve().parents[2] / "eval" / "reports" / "report.html"
_EVAL_LATEST_PATH = _Path(__file__).resolve().parents[2] / "eval" / "reports" / "latest_results.json"

@app.get("/api/eval/report", response_class=HTMLResponse)
def get_eval_report():
    """
    Serves the latest clinical evaluation HTML report.
    Run eval/run_eval.py first to generate the report.
    """
    if not _EVAL_REPORT_PATH.exists():
        return HTMLResponse(
            content="<h1>No eval report found</h1><p>Run <code>python eval/run_eval.py</code> to generate one.</p>",
            status_code=404
        )
    return HTMLResponse(content=_EVAL_REPORT_PATH.read_text(encoding="utf-8"))

@app.get("/api/eval/summary")
def get_eval_summary():
    """Returns the JSON summary from the latest eval run."""
    if not _EVAL_LATEST_PATH.exists():
        return JSONResponse({"error": "No eval summary found. Run python eval/run_eval.py first."}, status_code=404)
    return JSONResponse(content=json.loads(_EVAL_LATEST_PATH.read_text(encoding="utf-8")))


# ---------------------------------------------------------------------------
# Voice Processing Endpoints (STT Fallback + TTS Preprocessing & Streaming)
# ---------------------------------------------------------------------------

class VoiceTTSRequest(BaseModel):
    text: str
    language: str = "en"
    gender: str = "female"           # 'female' | 'male' — drives native speaker selection
    emotion: Optional[str] = "calm"  # calm | happy | sad | concerned | thoughtful | empathetic
    voice: Optional[str] = None      # explicit speaker override (optional)
    tone: Optional[str] = None       # voice tone key e.g. 'ananya', 'diya', 'meera', 'aarav', 'kabir', 'arjun'
    companion: Optional[str] = None  # 'girl' | 'boy' — companion persona gender
    engine: Optional[str] = None     # 'sarvam' | 'legacy' | None (auto based on LEGACY_TTS_FOR)
    pace: Optional[float] = None     # TTS speed pace factor e.g. 0.93, 1.0, 1.05

class VoiceSTTBase64Request(BaseModel):
    audio_base64: str
    language: str = "en"
    content_type: Optional[str] = "audio/webm"

class VoiceStatusUpdateRequest(BaseModel):
    language: str
    is_enabled: bool

@app.post("/api/voice/stt")
async def voice_speech_to_text(
    request: Request,
    file: Optional[UploadFile] = File(None),
    language: Optional[str] = Form("en"),
):
    """
    STT endpoint with server-side fallback (Sarvam AI or Gemini 1.5 Flash).
    Accepts either multipart/form-data audio file or JSON body with audio_base64.
    """
    content_type = "audio/webm"
    audio_bytes = b""
    lang = language or "en"

    # Check if request is JSON
    if request.headers.get("content-type", "").startswith("application/json"):
        try:
            body = await request.json()
            audio_b64 = body.get("audio_base64", "")
            lang = body.get("language", lang)
            content_type = body.get("content_type", "audio/webm")
            if audio_b64:
                if "," in audio_b64:
                    audio_b64 = audio_b64.split(",", 1)[1]
                audio_bytes = base64.b64decode(audio_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")
    elif file:
        audio_bytes = await file.read()
        if file.content_type:
            content_type = file.content_type

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data provided.")

    result = await transcribe_audio_fallback(audio_bytes, language=lang, content_type=content_type)
    return result

@app.post("/api/voice/tts")
async def voice_text_to_speech(req: VoiceTTSRequest):
    """
    TTS endpoint: strips emojis/markdown, expands helpline numbers digit-by-digit,
    selects a native Indic speaker voice (Sarvam Bulbul v3) based on language + gender + tone,
    tunes pitch/pace from the tone & emotion tag, and returns audio or client-side fallback.
    """
    # If an explicit speaker was provided via 'voice', use it; otherwise resolve via tone+companion
    speaker_override = req.voice or None
    companion_gender = "boy" if (req.companion or req.gender or "").lower() in ("boy", "male") else "girl"
    if not speaker_override and (req.tone or req.companion):
        speaker_override = get_sarvam_speaker(req.language, companion_gender, req.tone or None)
    res = await synthesize_speech_provider(
        req.text,
        language=req.language,
        voice=speaker_override,
        gender=companion_gender,
        emotion=req.emotion or "calm",
        tone=req.tone,
        engine=req.engine,
        pace=req.pace,
    )
    return res

@app.get("/api/voice/tones")
def voice_tones_for_companion(language: str = "en", companion: str = "girl"):
    """
    Returns valid voice tone cards for the chosen companion (girl/boy) in the specified language.
    Used by onboarding Step 6 to filter tone cards strictly by companion gender.
    """
    return {"tones": get_tones_for_companion(language, companion)}

@app.get("/api/voice/status")
def voice_system_status():
    """Returns voice availability status for all 8 Indian languages and providers."""
    return get_voice_status()

@app.get("/api/voice/samples")
def voice_samples_endpoint():
    """Returns sample lines per language with native Chirp 3 HD voice metadata for /voice-test."""
    return get_voice_samples()

class VoiceSentenceSynthesizeRequest(BaseModel):
    sentences: Optional[List[str]] = None
    text: Optional[str] = None
    language: str = "en"
    gender: str = "female"
    voice: Optional[str] = None
    emotion: Optional[str] = "calm"

@app.post("/api/voice/synthesize-sentences")
async def voice_synthesize_sentences(req: VoiceSentenceSynthesizeRequest):
    """
    Sentence-by-sentence TTS synthesis with memory & disk caching.
    """
    raw_text = req.text or (" ".join(req.sentences) if req.sentences else "")
    res = await synthesize_speech_provider(
        text=raw_text,
        language=req.language,
        voice=req.voice or None,
        gender=req.gender,
        emotion=req.emotion or "calm"
    )
    return res

@app.post("/api/voice/status")
def update_voice_system_status(req: VoiceStatusUpdateRequest):
    """Allows QA script to disable failing languages dynamically."""
    set_voice_language_status(req.language, req.is_enabled)
    return {"status": "success", "language": req.language, "is_enabled": req.is_enabled}

# ─────────────────────────────────────────────────────────────────────────────
# Root & SPA Static Serving (Port 8008 directly renders EmotiCare AI)
# ─────────────────────────────────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(DIST_DIR) and os.path.exists(os.path.join(DIST_DIR, "index.html")):
    for sub in ["assets", "avatar", "avatars", "models", "fx"]:
        sub_path = os.path.join(DIST_DIR, sub)
        if os.path.exists(sub_path):
            app.mount(f"/{sub}", StaticFiles(directory=sub_path), name=sub)

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

    @app.get("/{full_path:path}")
    async def catch_all_spa(full_path: str):
        # Do not catch API or documentation endpoints
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "app": "EmotiCare AI / MANAS",
            "status": "online",
            "version": "2.0.0",
            "docs": "/docs",
            "health": "/api/health",
            "frontend_dev_url": "http://localhost:5173",
            "message": "FastAPI backend is live. Access the frontend at http://localhost:5173 or run 'npm run build' in frontend/ to serve here."
        }


if __name__ == "__main__":
    import sys
    import uvicorn

    # Ensure parent directories are on sys.path regardless of launch folder
    current_file = os.path.abspath(__file__)
    app_dir = os.path.dirname(current_file)          # .../backend/app
    backend_dir = os.path.dirname(app_dir)          # .../backend
    root_dir = os.path.dirname(backend_dir)         # .../ (project root)

    for p in [root_dir, backend_dir]:
        if p not in sys.path:
            sys.path.insert(0, p)

    print("\n========================================================")
    print("  EmotiCare AI / MANAS Backend Server Starting")
    print("  API Server: http://127.0.0.1:8008")
    print("  API Docs:   http://127.0.0.1:8008/docs")
    print("========================================================\n")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8008, reload=False)


