"""
services/interventions.py - "What Works For Me" (Evidence-Based Coping Effectiveness)
Tracks longitudinal efficacy of emotional regulation strategies:
- breathing (4-7-8, box breathing)
- sensory grounding (5-4-3-2-1)
- mindful journaling
- cognitive reframing
- calming ambient soundscapes
- walking & physical pause
Zero fabricated stats: shows actual verified usage and feedback only.
"""
import uuid
from typing import Dict, List, Any, Optional
from ..database import get_db

STRATEGY_CATALOG = {
    "breathing_4_7_8": {
        "title": "4-7-8 Breathing Cadence",
        "description": "Inhale quietly through nose for 4s, hold gently for 7s, exhale with a whoosh for 8s.",
        "best_for": "Acute exam panic, heart racing, bedtime racing thoughts"
    },
    "grounding_5_4_3_2_1": {
        "title": "5-4-3-2-1 Sensory Grounding",
        "description": "Acknowledge 5 things you can see, 4 to touch, 3 to hear, 2 to smell, and 1 to taste.",
        "best_for": "Dissociation, overwhelm, sudden spirals"
    },
    "cognitive_reframing": {
        "title": "Gentle Perspective Reframing",
        "description": "Notice all-or-nothing catastrophizing and explore more realistic, compassionate interpretations.",
        "best_for": "Catastrophic thinking, self-blame, fear of failure"
    },
    "reflective_journaling": {
        "title": "Unfiltered Stream-of-Thought Journaling",
        "description": "Put swirling thoughts onto the private page without editing or judgment for 3 minutes.",
        "best_for": "Mental clutter, untangling heavy emotions"
    },
    "calming_music": {
        "title": "Warm Ambient Soundscapes",
        "description": "Listen to gentle rain, soft lofi, or binaural calm sounds to regulate the nervous system.",
        "best_for": "Sensory overload, study transitions, restlessness"
    },
    "walking_break": {
        "title": "Short Movement & Fresh Air Pause",
        "description": "Step away from the screen for 5 minutes, stretch, and change physical perspective.",
        "best_for": "Long work sessions, fatigue, creative blocks"
    }
}

def get_what_works_for_user(user_id: str) -> Dict[str, Any]:
    """
    Returns empirical effectiveness summary for the user.
    If no interventions logged, returns an honest empty state.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT strategy_name, total_uses, positive_feedback_count, negative_feedback_count,
               success_rate, last_used_at
        FROM what_works_profiles
        WHERE user_id = ?
        ORDER BY positive_feedback_count DESC, total_uses DESC
    """, (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if not rows:
        return {
            "has_data": False,
            "strategies": [],
            "message": "Not enough data yet. As you explore grounding, breathing, or reflections during chat, your personal effectiveness history will appear here.",
            "available_catalog": [
                {"id": k, **v} for k, v in STRATEGY_CATALOG.items()
            ]
        }

    formatted = []
    for r in rows:
        strat_key = r["strategy_name"]
        cat_info = STRATEGY_CATALOG.get(strat_key, {
            "title": strat_key.replace("_", " ").title(),
            "description": "Self-reflection strategy.",
            "best_for": "Emotional regulation"
        })
        formatted.append({
            "strategy_id": strat_key,
            "title": cat_info["title"],
            "description": cat_info["description"],
            "best_for": cat_info["best_for"],
            "total_uses": r["total_uses"],
            "positive_feedback_count": r["positive_feedback_count"],
            "negative_feedback_count": r["negative_feedback_count"],
            "success_rate_pct": round(r["success_rate"] * 100, 1),
            "evidence_statement": f"Received helpful feedback in {r['positive_feedback_count']} of {r['total_uses']} recent sessions.",
            "last_used_at": r["last_used_at"]
        })

    return {
        "has_data": True,
        "strategies": formatted,
        "total_interventions_tested": sum(r["total_uses"] for r in rows),
        "most_effective_strategy": formatted[0]["title"] if formatted else None
    }

def record_intervention_outcome(user_id: str, strategy_name: str, helpful: bool) -> Dict[str, Any]:
    """Updates empirical effectiveness count for a strategy."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT total_uses, positive_feedback_count, negative_feedback_count
        FROM what_works_profiles
        WHERE user_id = ? AND strategy_name = ?
    """, (user_id, strategy_name))
    row = cursor.fetchone()

    if row:
        total = row["total_uses"] + 1
        pos = row["positive_feedback_count"] + (1 if helpful else 0)
        neg = row["negative_feedback_count"] + (0 if helpful else 1)
        rate = round(pos / total, 3)
        cursor.execute("""
            UPDATE what_works_profiles
            SET total_uses = ?, positive_feedback_count = ?, negative_feedback_count = ?,
                success_rate = ?, last_used_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND strategy_name = ?
        """, (total, pos, neg, rate, user_id, strategy_name))
    else:
        total = 1
        pos = 1 if helpful else 0
        neg = 0 if helpful else 1
        rate = 1.0 if helpful else 0.0
        cursor.execute("""
            INSERT INTO what_works_profiles (
                id, user_id, strategy_name, total_uses, positive_feedback_count,
                negative_feedback_count, success_rate, last_used_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (str(uuid.uuid4()), user_id, strategy_name, total, pos, neg, rate))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "strategy": strategy_name,
        "helpful": helpful,
        "total_uses": total,
        "success_rate": rate
    }
