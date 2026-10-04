"""
services/safety_service.py - Structured Safety Plan, Trusted Contacts & Verified Professional Support Directory
Zero invented providers: strictly official, verified national mental health resources.
"""
import uuid
import json
from typing import Dict, List, Any, Optional
from ..database import get_db

VERIFIED_PROFESSIONAL_RESOURCES = [
    {
        "name": "Tele-MANAS (Govt. of India)",
        "helpline": "14416 / 1800-891-4416",
        "availability": "24/7, Toll-Free, 20+ Languages",
        "description": "National Tele Mental Health Programme of India offering free, round-the-clock psychiatric and counseling support.",
        "category": "government_crisis",
        "verified": True
    },
    {
        "name": "National Emergency Services",
        "helpline": "112",
        "availability": "24/7, Immediate Emergency",
        "description": "All-in-one emergency service across India for police, medical, and rescue assistance.",
        "category": "emergency",
        "verified": True
    },
    {
        "name": "KIRAN Mental Health Helpline",
        "helpline": "1800-599-0019",
        "availability": "24/7, Toll-Free, 13 Languages",
        "description": "Ministry of Social Justice & Empowerment helpline providing psychological support and mental health referral.",
        "category": "government_counseling",
        "verified": True
    },
    {
        "name": "NIMHANS Centre for Well-Being",
        "helpline": "080-46110007 / 080-26995000",
        "availability": "Mon-Sat 9:00 AM - 5:00 PM IST",
        "description": "Apex premier neuroscience and psychiatric research institute in Bengaluru offering outpatient psychological care.",
        "category": "premier_institute",
        "verified": True
    },
    {
        "name": "Vandrevala Foundation Helpline",
        "helpline": "+91 9999 666 555",
        "availability": "24/7, Free & Confidential",
        "description": "Experienced clinical counselors and crisis intervention specialists assisting distressed individuals.",
        "category": "crisis_counseling",
        "verified": True
    },
    {
        "name": "AASRA Crisis Prevention",
        "helpline": "+91 98204 66726",
        "availability": "24/7, Multilingual",
        "description": "Voluntary, non-profit crisis intervention center providing compassionate emotional listening.",
        "category": "crisis_listening",
        "verified": True
    },
    {
        "name": "CHILDLINE India",
        "helpline": "1098",
        "availability": "24/7, For Children & Adolescents (<18)",
        "description": "Nationwide emergency telephone helpline for minors and young people in need of care and protection.",
        "category": "youth_support",
        "verified": True
    }
]

DEFAULT_SAFETY_PLAN = {
    "warning_signs": [
        "Withdrawing from friends and leaving messages unanswered",
        "Trouble sleeping or staying awake past 3 AM with racing thoughts",
        "Feeling like an exhausting burden to everyone around me"
    ],
    "internal_coping": [
        "Take 5 rounds of slow 4-7-8 breathing sitting by a window",
        "Splash cold water on face or hold an ice cube (TIPP skill)",
        "Step outside for a 10-minute walk with instrumental music"
    ],
    "distraction_places": [
        "Campus library reading room",
        "Quiet local park or terrace in the early morning",
        "A neighborhood tea shop or open cafe"
    ],
    "trusted_people": [
        "A close friend or roommate who listens without judgment",
        "An understanding family member or mentor"
    ],
    "professional_contacts": [
        "Campus Student Counselor",
        "Tele-MANAS free counselor (14416)"
    ],
    "safe_environment_steps": [
        "Step away from high balconies or rooftops when agitated",
        "Place all medications and sharp objects in a separate locked cupboard",
        "Call or sit in the same room with someone I trust until calm returns"
    ],
    "emergency_hotlines": [
        "Tele-MANAS: 14416 (24/7, Free)",
        "Emergency: 112",
        "Vandrevala Foundation: +91 9999 666 555"
    ]
}

def get_safety_plan(user_id: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT warning_signs, internal_coping, distraction_places, trusted_people,
               professional_contacts, safe_environment_steps, emergency_hotlines, updated_at
        FROM safety_plans
        WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "has_plan": False,
            "plan": DEFAULT_SAFETY_PLAN,
            "message": "No customized safety plan saved yet. You can personalize this template to keep handy whenever distress peaks."
        }

    return {
        "has_plan": True,
        "plan": {
            "warning_signs": json.loads(row["warning_signs"] or "[]"),
            "internal_coping": json.loads(row["internal_coping"] or "[]"),
            "distraction_places": json.loads(row["distraction_places"] or "[]"),
            "trusted_people": json.loads(row["trusted_people"] or "[]"),
            "professional_contacts": json.loads(row["professional_contacts"] or "[]"),
            "safe_environment_steps": json.loads(row["safe_environment_steps"] or "[]"),
            "emergency_hotlines": json.loads(row["emergency_hotlines"] or "[]")
        },
        "updated_at": row["updated_at"]
    }

def save_safety_plan(user_id: str, plan_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()

    ws = json.dumps(plan_data.get("warning_signs", []))
    ic = json.dumps(plan_data.get("internal_coping", []))
    dp = json.dumps(plan_data.get("distraction_places", []))
    tp = json.dumps(plan_data.get("trusted_people", []))
    pc = json.dumps(plan_data.get("professional_contacts", []))
    se = json.dumps(plan_data.get("safe_environment_steps", []))
    eh = json.dumps(plan_data.get("emergency_hotlines", []))

    cursor.execute("""
        INSERT INTO safety_plans (
            id, user_id, warning_signs, internal_coping, distraction_places,
            trusted_people, professional_contacts, safe_environment_steps,
            emergency_hotlines, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            warning_signs = excluded.warning_signs,
            internal_coping = excluded.internal_coping,
            distraction_places = excluded.distraction_places,
            trusted_people = excluded.trusted_people,
            professional_contacts = excluded.professional_contacts,
            safe_environment_steps = excluded.safe_environment_steps,
            emergency_hotlines = excluded.emergency_hotlines,
            updated_at = CURRENT_TIMESTAMP
    """, (str(uuid.uuid4()), user_id, ws, ic, dp, tp, pc, se, eh))

    conn.commit()
    conn.close()

    return {"status": "success", "message": "Safety plan saved successfully."}

def get_trusted_contacts(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, relationship, email, phone, is_verified, consent_to_alert, created_at
        FROM trusted_contacts
        WHERE user_id = ?
        ORDER BY created_at ASC
    """, (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def add_trusted_contact(user_id: str, name: str, relationship: str, email: Optional[str], phone: Optional[str], consent_to_alert: bool) -> Dict[str, Any]:
    cid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO trusted_contacts (id, user_id, name, relationship, email, phone, is_verified, consent_to_alert)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    """, (cid, user_id, name, relationship, email or "", phone or "", 1 if consent_to_alert else 0))
    conn.commit()
    conn.close()
    return {"status": "success", "id": cid, "name": name, "consent_to_alert": consent_to_alert}

def delete_trusted_contact(user_id: str, contact_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trusted_contacts WHERE user_id = ? AND id = ?", (user_id, contact_id))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0
