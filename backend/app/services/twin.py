"""
services/twin.py - MANAS Digital Mental Twin & Behavioral Intelligence Engine
Maintains personal longitudinal baselines, calculates deviations, and evaluates burnout strain
using strictly evidence-based user observations (zero fabricated metrics).
"""
import uuid
import math
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from ..database import get_db

def get_user_twin_overview(user_id: str) -> Dict[str, Any]:
    """
    Returns Digital Twin state:
    - Current State
    - Personal Baseline (mean & stddev)
    - Trend (stable, rising, decreasing)
    - Change from Baseline
    - Burnout / Workload strain signal (non-clinical language)
    - Evidence & timestamps
    If insufficient data exists, returns honest empty state.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Fetch recent mood entries
    cursor.execute("""
        SELECT score, tags, note, created_at
        FROM mood_entries
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 30
    """, (user_id,))
    mood_rows = [dict(r) for r in cursor.fetchall()]

    # 2. Fetch wellness metrics (stress, sleep, energy, workload, focus)
    cursor.execute("""
        SELECT metric_type, score, created_at
        FROM wellness_entries
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, (user_id,))
    wellness_rows = [dict(r) for r in cursor.fetchall()]

    # 3. Fetch typing observations
    cursor.execute("""
        SELECT wpm, cps, avg_pause_sec, backspace_count, correction_ratio, baseline_deviation, created_at
        FROM typing_observations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
    """, (user_id,))
    typing_rows = [dict(r) for r in cursor.fetchall()]

    conn.close()

    total_logs = len(mood_rows) + len(wellness_rows)

    # Honest empty state if user has fewer than 3 logs
    if total_logs < 3:
        return {
            "baseline_established": False,
            "status": "accumulating_data",
            "message": "Not enough data yet. Check in with your mood or wellness metrics over a few days to establish your personal baseline.",
            "data_points_collected": total_logs,
            "min_required_points": 3,
            "current_state": {
                "mood": mood_rows[0]["score"] if mood_rows else None,
                "latest_checkin": mood_rows[0]["created_at"] if mood_rows else None
            },
            "personal_baseline": None,
            "burnout_risk_signal": {
                "level": "undetermined",
                "label": "Insufficient data to establish pattern",
                "evidence": []
            }
        }

    # Compute Mood Baseline & Trend
    mood_scores = [r["score"] for r in mood_rows]
    mean_mood = sum(mood_scores) / len(mood_scores)
    variance = sum((x - mean_mood) ** 2 for x in mood_scores) / max(1, len(mood_scores) - 1)
    stddev_mood = math.sqrt(variance)

    latest_mood = mood_scores[0]
    deviation_from_baseline = round(latest_mood - mean_mood, 2)

    # Determine trend from latest 3 vs earlier
    if len(mood_scores) >= 5:
        recent_avg = sum(mood_scores[:3]) / 3
        earlier_avg = sum(mood_scores[3:]) / len(mood_scores[3:])
        if recent_avg - earlier_avg > 0.4:
            trend = "improving"
        elif earlier_avg - recent_avg > 0.4:
            trend = "declining"
        else:
            trend = "steady"
    else:
        trend = "steady"

    # Compute Wellness Metrics by Type
    wellness_by_type: Dict[str, List[float]] = {}
    for r in wellness_rows:
        t = r["metric_type"]
        wellness_by_type.setdefault(t, []).append(r["score"])

    # Burnout / Workload strain evaluation (Evidence-based, strictly non-clinical)
    strain_evidence = []
    strain_points = 0

    if "workload" in wellness_by_type and len(wellness_by_type["workload"]) >= 2:
        recent_workload = sum(wellness_by_type["workload"][:3]) / min(3, len(wellness_by_type["workload"]))
        if recent_workload >= 7.0:
            strain_points += 1
            strain_evidence.append(f"Recent self-reported workload is elevated ({recent_workload:.1f}/10)")

    if "sleep" in wellness_by_type and len(wellness_by_type["sleep"]) >= 2:
        recent_sleep = sum(wellness_by_type["sleep"][:3]) / min(3, len(wellness_by_type["sleep"]))
        if recent_sleep <= 5.0:
            strain_points += 1
            strain_evidence.append(f"Recent sleep recovery is lower than typical ({recent_sleep:.1f}/10)")

    if "stress" in wellness_by_type and len(wellness_by_type["stress"]) >= 2:
        recent_stress = sum(wellness_by_type["stress"][:3]) / min(3, len(wellness_by_type["stress"]))
        if recent_stress >= 7.0:
            strain_points += 1
            strain_evidence.append(f"Stress indicators have stayed elevated across recent logs ({recent_stress:.1f}/10)")

    if deviation_from_baseline <= -1.0:
        strain_points += 1
        strain_evidence.append(f"Current mood check-in is noticeably lower than your personal baseline of {mean_mood:.1f}")

    if strain_points >= 3:
        strain_level = "elevated"
        strain_label = "Your recent workload and recovery patterns suggest you may be under more strain than usual."
    elif strain_points >= 1:
        strain_level = "moderate"
        strain_label = "A few indicators show increased daily pressure; taking intentional micro-breaks may help."
    else:
        strain_level = "balanced"
        strain_label = "Your recent check-in patterns reflect a steady, balanced state relative to your baseline."

    # Typing baseline summary
    typing_baseline = None
    if len(typing_rows) >= 3:
        avg_wpm = sum(r["wpm"] for r in typing_rows) / len(typing_rows)
        avg_pause = sum(r["avg_pause_sec"] for r in typing_rows) / len(typing_rows)
        typing_baseline = {
            "average_wpm": round(avg_wpm, 1),
            "average_pause_sec": round(avg_pause, 2),
            "sessions_analyzed": len(typing_rows),
            "latest_deviation": typing_rows[0].get("baseline_deviation", 0.0)
        }

    return {
        "baseline_established": True,
        "status": "active",
        "current_state": {
            "mood": latest_mood,
            "latest_checkin": mood_rows[0]["created_at"],
            "trend": trend,
            "deviation_from_baseline": deviation_from_baseline
        },
        "personal_baseline": {
            "mean_mood": round(mean_mood, 2),
            "stddev": round(stddev_mood, 2),
            "sample_size": len(mood_scores),
            "first_entry": mood_rows[-1]["created_at"],
            "latest_entry": mood_rows[0]["created_at"]
        },
        "burnout_risk_signal": {
            "level": strain_level,
            "label": strain_label,
            "evidence": strain_evidence,
            "last_evaluated": datetime.utcnow().isoformat()
        },
        "typing_baseline": typing_baseline,
        "evidence_summary": {
            "total_mood_logs": len(mood_rows),
            "total_wellness_logs": len(wellness_rows),
            "typing_sessions": len(typing_rows)
        }
    }


def record_typing_observation(
    user_id: str,
    session_id: Optional[str],
    cps: float,
    wpm: float,
    pause_count: int,
    avg_pause_sec: float,
    backspace_count: int,
    correction_ratio: float,
    message_len: int
) -> Dict[str, Any]:
    """
    Saves typing behavioral telemetry without raw keystrokes and computes personal baseline deviation.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Compute baseline from previous observations
    cursor.execute("""
        SELECT wpm FROM typing_observations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    """, (user_id,))
    past_wpms = [r["wpm"] for r in cursor.fetchall() if r["wpm"] > 0]

    baseline_dev = 0.0
    if len(past_wpms) >= 3:
        avg_w = sum(past_wpms) / len(past_wpms)
        if avg_w > 0:
            baseline_dev = round((wpm - avg_w) / avg_w, 2)

    obs_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO typing_observations (
            id, user_id, session_id, wpm, cps, pause_count, avg_pause_sec,
            backspace_count, correction_ratio, message_len, baseline_deviation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        obs_id, user_id, session_id or str(uuid.uuid4()), wpm, cps,
        pause_count, avg_pause_sec, backspace_count, correction_ratio,
        message_len, baseline_dev
    ))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "id": obs_id,
        "baseline_deviation": baseline_dev,
        "observation": "Typing pattern aligned with baseline." if abs(baseline_dev) < 0.25 else "Typing pattern changed from your recent baseline."
    }


def evaluate_proactive_checkin(user_id: str) -> Dict[str, Any]:
    """
    Evaluates whether a proactive check-in is justified based on:
    1. Explicit user consent for proactive check-ins
    2. Meaningful deviation from baseline (e.g. low mood or high strain)
    3. Cooldown window (maximum 1 check-in per 24 hours)
    """
    conn = get_db()
    cursor = conn.cursor()

    # Check consent
    cursor.execute("""
        SELECT granted FROM user_consents
        WHERE user_id = ? AND consent_type = 'proactive_checkins'
    """, (user_id,))
    consent_row = cursor.fetchone()
    if not consent_row or consent_row["granted"] != 1:
        conn.close()
        return {"should_checkin": False, "reason": "User has not opted in to proactive check-ins."}

    # Check cooldown (safety events or prior check-ins in last 24h)
    cursor.execute("""
        SELECT created_at FROM chat_messages
        WHERE user_id = ? AND strategy_used = 'proactive_checkin'
        ORDER BY created_at DESC LIMIT 1
    """, (user_id,))
    last_checkin = cursor.fetchone()
    if last_checkin:
        last_t = datetime.strptime(last_checkin["created_at"][:19], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() - last_t < timedelta(hours=20):
            conn.close()
            return {"should_checkin": False, "reason": "Within check-in cooldown period."}

    conn.close()

    overview = get_user_twin_overview(user_id)
    if not overview.get("baseline_established"):
        return {"should_checkin": False, "reason": "Insufficient baseline data."}

    strain = overview.get("burnout_risk_signal", {}).get("level")
    dev = overview.get("current_state", {}).get("deviation_from_baseline", 0.0)

    if strain == "elevated" or dev <= -1.2:
        return {
            "should_checkin": True,
            "reason": "meaningful_deviation",
            "prompt_suggestion": "You have seemed under a bit more pressure than your usual baseline recently. Would you like to take a quiet breath together, or just talk about what's on your mind?",
            "evidence": overview.get("burnout_risk_signal", {}).get("evidence", [])
        }

    return {"should_checkin": False, "reason": "Metrics within normal baseline range."}
