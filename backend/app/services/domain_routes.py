"""
services/domain_routes.py - Production Domain Router for EmotiCare AI / MANAS
Includes:
- Digital Twin & Behavioral Telemetry
- OCEAN Personality Discovery
- Granular Privacy & Consent Center
- Memory Center ("What MANAS Remembers")
- "What Works For Me" Intervention Efficacy
- Journal, Goals, Future Self & Weekly Reflections
- Safety Plan & Trusted Contacts
All endpoints derive user_id strictly from authenticated server token (P0 Security).
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import require_auth, get_current_user_id
from .twin import get_user_twin_overview, record_typing_observation, evaluate_proactive_checkin
from .personality import (
    get_personality_scenarios,
    score_personality_answers,
    get_user_personality,
    update_user_personality
)
from .privacy import (
    get_user_consents,
    set_user_consent,
    export_all_user_data,
    purge_all_user_presence
)
from .interventions import (
    get_what_works_for_user,
    record_intervention_outcome
)
from .safety_service import (
    get_safety_plan,
    save_safety_plan,
    get_trusted_contacts,
    add_trusted_contact,
    delete_trusted_contact,
    VERIFIED_PROFESSIONAL_RESOURCES
)

router = APIRouter(prefix="/api", tags=["production_domains"])

# ===========================================================================
# 1. DIGITAL TWIN & BEHAVIORAL INTELLIGENCE
# ===========================================================================

@router.get("/twin/overview")
def get_twin_overview(uid: str = Depends(require_auth)):
    """Returns longitudinal Digital Twin state, baseline, trend, and strain signal."""
    return get_user_twin_overview(uid)

class TypingTelemetryRequest(BaseModel):
    session_id: Optional[str] = None
    cps: float = 0.0
    wpm: float = 0.0
    pause_count: int = 0
    avg_pause_sec: float = 0.0
    backspace_count: int = 0
    correction_ratio: float = 0.0
    message_len: int = 0

@router.post("/twin/telemetry/typing")
def submit_typing_telemetry(req: TypingTelemetryRequest, uid: str = Depends(require_auth)):
    """Records typing behavioral telemetry without raw keystrokes and computes personal baseline."""
    return record_typing_observation(
        user_id=uid,
        session_id=req.session_id,
        cps=req.cps,
        wpm=req.wpm,
        pause_count=req.pause_count,
        avg_pause_sec=req.avg_pause_sec,
        backspace_count=req.backspace_count,
        correction_ratio=req.correction_ratio,
        message_len=req.message_len
    )

@router.get("/twin/check-in/proactive")
def check_proactive_checkin(uid: str = Depends(require_auth)):
    """Evaluates whether an evidence-based proactive check-in is justified."""
    return evaluate_proactive_checkin(uid)

class WellnessLogRequest(BaseModel):
    metric_type: str  # stress | energy | sleep | focus | workload | activity
    score: float
    note: Optional[str] = ""

@router.post("/wellness")
def log_wellness_metric(req: WellnessLogRequest, uid: str = Depends(require_auth)):
    valid_metrics = ["stress", "energy", "sleep", "focus", "workload", "activity"]
    if req.metric_type not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Allowed: {valid_metrics}")

    conn = get_db()
    cursor = conn.cursor()
    entry_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO wellness_entries (id, user_id, metric_type, score, note)
        VALUES (?, ?, ?, ?, ?)
    """, (entry_id, uid, req.metric_type, req.score, req.note or ""))
    conn.commit()
    conn.close()
    return {"status": "saved", "id": entry_id, "metric_type": req.metric_type, "score": req.score}

@router.get("/wellness/history")
def get_wellness_history(uid: str = Depends(require_auth), limit: int = 50):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, metric_type, score, note, created_at
        FROM wellness_entries
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
    """, (uid, limit))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"entries": rows}


# ===========================================================================
# 2. OCEAN / BIG FIVE PERSONALITY DISCOVERY
# ===========================================================================

@router.get("/personality/questions")
def get_personality_questions():
    """Returns gamified scenario-based questions."""
    return {"scenarios": get_personality_scenarios()}

class PersonalityAssessRequest(BaseModel):
    answers: Dict[str, int]

@router.post("/personality/assess")
def assess_personality(req: PersonalityAssessRequest, uid: str = Depends(require_auth)):
    """Scores OCEAN personality profile from user answers."""
    return score_personality_answers(uid, req.answers)

@router.get("/personality/profile")
def get_personality_profile(uid: str = Depends(require_auth)):
    """Returns user's current personality traits or empty state."""
    profile = get_user_personality(uid)
    if not profile:
        return {
            "has_profile": False,
            "message": "No personality profile established yet. Take the 2-minute scenario exploration to discover your traits."
        }
    return {"has_profile": True, **profile}

class PersonalityUpdateRequest(BaseModel):
    traits: Dict[str, float]

@router.put("/personality/profile")
def edit_personality_profile(req: PersonalityUpdateRequest, uid: str = Depends(require_auth)):
    return update_user_personality(uid, req.traits)


# ===========================================================================
# 3. PRIVACY CENTER & GRANULAR CONSENT (DPDP Act 2023)
# ===========================================================================

@router.get("/privacy/consents")
def get_consents(uid: str = Depends(require_auth)):
    return {"consents": get_user_consents(uid)}

class ConsentUpdateRequest(BaseModel):
    consent_type: str
    granted: bool

@router.post("/privacy/consents")
def update_consent(req: ConsentUpdateRequest, request: Request, uid: str = Depends(require_auth)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        return set_user_consent(uid, req.consent_type, req.granted, client_ip=client_ip)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/privacy/export")
def export_user_data(uid: str = Depends(require_auth)):
    """Exports full machine-readable JSON archive of all personal data."""
    return export_all_user_data(uid)

class DeleteAccountRequest(BaseModel):
    reason: Optional[str] = "User requested account erasure"

@router.post("/privacy/delete-account")
def delete_account(req: DeleteAccountRequest, request: Request, uid: str = Depends(require_auth)):
    """Permanently erases all user records across all relational tables."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    return purge_all_user_presence(uid, client_ip=client_ip, reason=req.reason or "user_requested")


# ===========================================================================
# 4. MEMORY CENTER ("What MANAS Remembers")
# ===========================================================================

@router.get("/memory/center")
def get_memory_center(uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, category, fact, importance, created_at
        FROM user_memories
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (uid,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    grouped: Dict[str, List[Any]] = {}
    for r in rows:
        cat = r.get("category") or "general"
        grouped.setdefault(cat, []).append(r)

    return {
        "total_memories": len(rows),
        "categories": grouped,
        "memories": rows
    }

class MemoryCreateRequest(BaseModel):
    category: Optional[str] = "preferences"
    fact: str
    importance: Optional[float] = 1.0

@router.post("/memory/item")
def add_memory_item(req: MemoryCreateRequest, uid: str = Depends(require_auth)):
    if not req.fact.strip():
        raise HTTPException(status_code=400, detail="Memory fact cannot be empty.")
    mid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_memories (id, user_id, category, fact, importance)
        VALUES (?, ?, ?, ?, ?)
    """, (mid, uid, req.category or "preferences", req.fact.strip(), req.importance or 1.0))
    conn.commit()
    conn.close()
    return {"status": "success", "id": mid, "fact": req.fact}

class MemoryEditRequest(BaseModel):
    category: Optional[str] = None
    fact: str

@router.put("/memory/item/{memory_id}")
def edit_memory_item(memory_id: str, req: MemoryEditRequest, uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE user_memories
        SET fact = ?, category = COALESCE(?, category)
        WHERE id = ? AND user_id = ?
    """, (req.fact.strip(), req.category, memory_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"status": "success", "id": memory_id, "fact": req.fact}

@router.delete("/memory/item/{memory_id}")
def remove_memory_item(memory_id: str, uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_memories WHERE id = ? AND user_id = ?", (memory_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"status": "success", "message": f"Memory {memory_id} removed."}

@router.post("/memory/clear")
def clear_all_memories(uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_memories WHERE user_id = ?", (uid,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "All memories cleared."}


# ===========================================================================
# 5. "WHAT WORKS FOR ME" (Intervention Effectiveness Tracking)
# ===========================================================================

@router.get("/interventions/what-works")
def get_what_works(uid: str = Depends(require_auth)):
    return get_what_works_for_user(uid)

class InterventionFeedbackRequest(BaseModel):
    strategy: str
    helpful: bool

@router.post("/interventions/feedback")
def submit_intervention_feedback(req: InterventionFeedbackRequest, uid: str = Depends(require_auth)):
    return record_intervention_outcome(uid, req.strategy, req.helpful)


# ===========================================================================
# 6. JOURNAL
# ===========================================================================

class JournalCreateRequest(BaseModel):
    title: Optional[str] = "Daily Reflection"
    content: str
    tags: Optional[List[str]] = []
    mood_score: Optional[int] = None
    is_private: Optional[bool] = False

@router.get("/journal")
def list_journal_entries(uid: str = Depends(require_auth), limit: int = 50):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, content, tags, mood_score, is_private, ai_reflection, created_at, updated_at
        FROM journal_entries
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
    """, (uid, limit))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for r in rows:
        try:
            r["tags"] = json.loads(r["tags"]) if r["tags"] else []
        except Exception:
            r["tags"] = []
    return {"entries": rows}

@router.post("/journal")
def create_journal_entry(req: JournalCreateRequest, uid: str = Depends(require_auth)):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Journal entry cannot be empty.")
    jid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO journal_entries (id, user_id, title, content, tags, mood_score, is_private)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (jid, uid, req.title or "Untitled", req.content.strip(), json.dumps(req.tags or []), req.mood_score, 1 if req.is_private else 0))
    conn.commit()
    conn.close()
    return {"status": "saved", "id": jid, "title": req.title}

@router.delete("/journal/{journal_id}")
def delete_journal_entry(journal_id: str, uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journal_entries WHERE id = ? AND user_id = ?", (journal_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return {"status": "success", "message": "Journal entry deleted."}


# ===========================================================================
# 7. GOALS
# ===========================================================================

class GoalCreateRequest(BaseModel):
    title: str
    category: Optional[str] = "mindfulness"
    target_date: Optional[str] = None
    habit_linked: Optional[str] = None

@router.get("/goals")
def list_goals(uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, category, target_date, status, progress_pct, habit_linked, created_at, updated_at
        FROM goals
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (uid,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"goals": rows}

@router.post("/goals")
def create_goal(req: GoalCreateRequest, uid: str = Depends(require_auth)):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Goal title cannot be empty.")
    gid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO goals (id, user_id, title, category, target_date, habit_linked)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (gid, uid, req.title.strip(), req.category or "mindfulness", req.target_date, req.habit_linked))
    conn.commit()
    conn.close()
    return {"status": "saved", "id": gid, "title": req.title}

class GoalPatchRequest(BaseModel):
    progress_pct: Optional[int] = None
    status: Optional[str] = None  # active | completed | paused

@router.patch("/goals/{goal_id}")
def update_goal_progress(goal_id: str, req: GoalPatchRequest, uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE goals
        SET progress_pct = COALESCE(?, progress_pct),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """, (req.progress_pct, req.status, goal_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return {"status": "success", "id": goal_id}

@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: str, uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (goal_id, uid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return {"status": "success", "message": "Goal removed."}


# ===========================================================================
# 8. FUTURE SELF
# ===========================================================================

class FutureSelfCreateRequest(BaseModel):
    horizon: Optional[str] = "6_months"
    aspirations: str
    habits_commitment: Optional[str] = ""
    emotional_vision: Optional[str] = ""

@router.get("/future-self")
def get_future_self(uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, horizon, aspirations, habits_commitment, emotional_vision, reflection_notes, created_at, updated_at
        FROM future_self_entries
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 10
    """, (uid,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"entries": rows}

@router.post("/future-self")
def save_future_self(req: FutureSelfCreateRequest, uid: str = Depends(require_auth)):
    if not req.aspirations.strip():
        raise HTTPException(status_code=400, detail="Aspirations cannot be empty.")
    fid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO future_self_entries (id, user_id, horizon, aspirations, habits_commitment, emotional_vision)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (fid, uid, req.horizon or "6_months", req.aspirations.strip(), req.habits_commitment or "", req.emotional_vision or ""))
    conn.commit()
    conn.close()
    return {"status": "saved", "id": fid}


# ===========================================================================
# 9. WEEKLY REFLECTION
# ===========================================================================

@router.get("/reflections/weekly")
def get_weekly_reflection(uid: str = Depends(require_auth)):
    conn = get_db()
    cursor = conn.cursor()

    # Fetch latest stored reflection
    cursor.execute("""
        SELECT id, week_start, summary_text, wins, challenges, next_intentions, data_evidence_json, created_at
        FROM weekly_reflections
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 1
    """, (uid,))
    row = cursor.fetchone()

    # Also compute 7-day stats
    cursor.execute("""
        SELECT score FROM mood_entries
        WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    """, (uid,))
    moods_7d = [r["score"] for r in cursor.fetchall()]

    conn.close()

    if not row and not moods_7d:
        return {
            "has_reflection": False,
            "message": "Not enough data for a weekly reflection yet. Continue checking in daily to synthesize your week."
        }

    avg_mood = round(sum(moods_7d) / len(moods_7d), 2) if moods_7d else None

    if row:
        return {
            "has_reflection": True,
            "id": row["id"],
            "week_start": row["week_start"],
            "summary_text": row["summary_text"],
            "wins": json.loads(row["wins"] or "[]"),
            "challenges": json.loads(row["challenges"] or "[]"),
            "next_intentions": json.loads(row["next_intentions"] or "[]"),
            "average_mood_7d": avg_mood,
            "created_at": row["created_at"]
        }

    # Generate from recent logs
    summary = f"Over the past 7 days, you logged {len(moods_7d)} mood check-in(s) with an average self-rating of {avg_mood}/5."
    return {
        "has_reflection": True,
        "week_start": (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
        "summary_text": summary,
        "wins": ["Took time to pause and reflect"],
        "challenges": ["Balancing commitments"],
        "next_intentions": ["Keep a gentle, consistent morning routine"],
        "average_mood_7d": avg_mood
    }


# ===========================================================================
# 10. SAFETY PLAN & TRUSTED CONTACTS
# ===========================================================================

@router.get("/safety/plan")
def get_user_safety_plan(uid: str = Depends(require_auth)):
    return get_safety_plan(uid)

class SafetyPlanSaveRequest(BaseModel):
    warning_signs: Optional[List[str]] = []
    internal_coping: Optional[List[str]] = []
    distraction_places: Optional[List[str]] = []
    trusted_people: Optional[List[str]] = []
    professional_contacts: Optional[List[str]] = []
    safe_environment_steps: Optional[List[str]] = []
    emergency_hotlines: Optional[List[str]] = []

@router.post("/safety/plan")
def save_user_safety_plan(req: SafetyPlanSaveRequest, uid: str = Depends(require_auth)):
    return save_safety_plan(uid, req.dict())

@router.get("/safety/trusted-contacts")
def list_trusted_contacts(uid: str = Depends(require_auth)):
    return {"contacts": get_trusted_contacts(uid)}

class TrustedContactCreateRequest(BaseModel):
    name: str
    relationship: Optional[str] = "friend"
    email: Optional[str] = ""
    phone: Optional[str] = ""
    consent_to_alert: Optional[bool] = False

@router.post("/safety/trusted-contacts")
def create_trusted_contact(req: TrustedContactCreateRequest, uid: str = Depends(require_auth)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Contact name is required.")
    return add_trusted_contact(
        user_id=uid,
        name=req.name.strip(),
        relationship=req.relationship or "friend",
        email=req.email,
        phone=req.phone,
        consent_to_alert=bool(req.consent_to_alert)
    )

@router.delete("/safety/trusted-contacts/{contact_id}")
def remove_trusted_contact(contact_id: str, uid: str = Depends(require_auth)):
    success = delete_trusted_contact(uid, contact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found.")
    return {"status": "success", "message": "Contact removed."}

@router.get("/safety/professional-directory")
def get_professional_directory():
    """Official, verified emergency hotlines and psychiatric support across India."""
    return {"resources": VERIFIED_PROFESSIONAL_RESOURCES}
