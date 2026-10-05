"""
services/notifications.py - Web Push (VAPID) and In-App Notification Center
─────────────────────────────────────────────────────────────────────────────
Handles:
1. Web Push using standard W3C Push API + VAPID (pywebpush).
2. Neutral wording filter: strictly enforces that notifications contain zero
   sensitive clinical or diagnostic details (e.g. "Time for your check-in",
   "A mindful pause for yourself").
3. In-App Notification Center: stores and delivers in-app notifications with
   read states, direct action links, and full deletion.
4. Granular notification preferences:
   - Types: check-in, breathing, journal, goals
   - Preferred time & frequency (daily, weekdays, twice_daily)
   - Quiet hours window enforcement
   - Language
   - Master on/off toggle
5. Zero push sent without explicit user permission.
"""

import os
import re
import json
import uuid
import base64
import logging
from datetime import datetime, time
from typing import Dict, Any, List, Optional
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption
from py_vapid import Vapid
from pywebpush import webpush, WebPushException

from ..database import get_db

logger = logging.getLogger("manas.notifications")

VAPID_CLAIMS = {
    "sub": "mailto:support@manas.ai"
}

# Neutral Notification Templates
NEUTRAL_TEMPLATES = {
    "checkin": {
        "title": "Daily Check-in",
        "message": "Time for your daily reflection and check-in.",
        "action_url": "/?chat=open"
    },
    "breathing": {
        "title": "Mindful Moment",
        "message": "A gentle 2-minute pause to reset your breathing.",
        "action_url": "/?breathing=open"
    },
    "journal": {
        "title": "Evening Reflection",
        "message": "Take a quiet moment to record your thoughts today.",
        "action_url": "/?journal=open"
    },
    "goals": {
        "title": "Habit Milestone",
        "message": "A gentle reminder to celebrate today's progress.",
        "action_url": "/?goals=open"
    },
    "reminder": {
        "title": "Scheduled Reminder",
        "message": "Time for your scheduled check-in.",
        "action_url": "/?chat=open"
    }
}

# Sensitive words that must NEVER appear in push notifications
DISALLOWED_NOTIFICATION_WORDS = [
    "depression", "depressed", "suicide", "suicidal", "anxiety", "panic",
    "trauma", "bipolar", "ptsd", "disorder", "crisis", "antidepressant",
    "therapy", "clinical", "medication", "kill", "harm", "psychiatric"
]

def sanitize_neutral_notification_text(text: str, fallback: str = "Time for your check-in.") -> str:
    """Replaces any clinical or sensitive keywords with calm, neutral phrasing."""
    if not text:
        return fallback
    cleaned = text
    lower = cleaned.lower()
    for word in DISALLOWED_NOTIFICATION_WORDS:
        if word in lower:
            # Mask or replace with neutral phrasing
            cleaned = re.sub(rf"\b{re.escape(word)}\b", "wellness", cleaned, flags=re.IGNORECASE)
    # If the text itself is heavily sensitive, revert to neutral fallback
    for word in ["suicide", "kill", "harm", "crisis", "depression"]:
        if word in lower:
            return fallback
    return cleaned

# Singleton VAPID manager
class VapidKeyManager:
    _instance = None

    def __init__(self):
        self.vapid = Vapid()
        vapid_pem_env = os.getenv("VAPID_PRIVATE_PEM")
        if vapid_pem_env:
            try:
                self.vapid = Vapid.from_pem(vapid_pem_env.encode("utf-8"))
            except Exception:
                self.vapid.generate_keys()
        else:
            self.vapid.generate_keys()

    @classmethod
    def get(cls) -> "VapidKeyManager":
        if cls._instance is None:
            cls._instance = VapidKeyManager()
        return cls._instance

    def get_public_key_b64(self) -> str:
        """Returns uncompressed EC point in base64url without padding."""
        raw_pub = self.vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        return base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode("utf-8")

    def get_private_pem_bytes(self) -> bytes:
        return self.vapid.private_pem()


def get_vapid_public_key() -> str:
    """Returns the application's VAPID public key for browser push subscription."""
    return VapidKeyManager.get().get_public_key_b64()


def subscribe_push_device(user_id: str, endpoint: str, p256dh: str, auth: str) -> Dict[str, Any]:
    """Saves or updates Web Push subscription credentials for a user."""
    conn = get_db()
    cursor = conn.cursor()
    sub_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            updated_at = CURRENT_TIMESTAMP
    """, (sub_id, user_id, endpoint, p256dh, auth))
    conn.commit()
    conn.close()
    return {"status": "subscribed", "id": sub_id}


def unsubscribe_push_device(user_id: str, endpoint: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM web_push_subscriptions WHERE endpoint = ? AND user_id = ?", (endpoint, user_id))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return {"status": "unsubscribed", "removed": affected > 0}


def get_notification_preferences(user_id: str) -> Dict[str, Any]:
    """Retrieves user's notification preferences or sensible defaults."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT enabled, type_checkin, type_breathing, type_journal, type_goals,
               time_pref, frequency, quiet_hours_start, quiet_hours_end, language
        FROM notification_preferences
        WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "enabled": True,
            "type_checkin": True,
            "type_breathing": True,
            "type_journal": True,
            "type_goals": True,
            "time_pref": "09:00",
            "frequency": "daily",
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00",
            "language": "en"
        }

    return {
        "enabled": bool(row["enabled"]),
        "type_checkin": bool(row["type_checkin"]),
        "type_breathing": bool(row["type_breathing"]),
        "type_journal": bool(row["type_journal"]),
        "type_goals": bool(row["type_goals"]),
        "time_pref": row["time_pref"] or "09:00",
        "frequency": row["frequency"] or "daily",
        "quiet_hours_start": row["quiet_hours_start"] or "22:00",
        "quiet_hours_end": row["quiet_hours_end"] or "08:00",
        "language": row["language"] or "en"
    }


def update_notification_preferences(user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Updates user notification preferences."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO notification_preferences (
            user_id, enabled, type_checkin, type_breathing, type_journal, type_goals,
            time_pref, frequency, quiet_hours_start, quiet_hours_end, language, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            enabled = excluded.enabled,
            type_checkin = excluded.type_checkin,
            type_breathing = excluded.type_breathing,
            type_journal = excluded.type_journal,
            type_goals = excluded.type_goals,
            time_pref = excluded.time_pref,
            frequency = excluded.frequency,
            quiet_hours_start = excluded.quiet_hours_start,
            quiet_hours_end = excluded.quiet_hours_end,
            language = excluded.language,
            updated_at = CURRENT_TIMESTAMP
    """, (
        user_id,
        1 if prefs.get("enabled", True) else 0,
        1 if prefs.get("type_checkin", True) else 0,
        1 if prefs.get("type_breathing", True) else 0,
        1 if prefs.get("type_journal", True) else 0,
        1 if prefs.get("type_goals", True) else 0,
        prefs.get("time_pref", "09:00"),
        prefs.get("frequency", "daily"),
        prefs.get("quiet_hours_start", "22:00"),
        prefs.get("quiet_hours_end", "08:00"),
        prefs.get("language", "en")
    ))
    conn.commit()
    conn.close()
    return {"status": "success", "preferences": prefs}


def is_in_quiet_hours(
    start_str: str = "22:00",
    end_str: str = "08:00",
    check_time: Optional[time] = None
) -> bool:
    """Evaluates whether current server/local time (or provided check_time) falls in user's quiet hours window."""
    try:
        now = check_time or datetime.now().time()
        s_h, s_m = map(int, start_str.split(":"))
        e_h, e_m = map(int, end_str.split(":"))
        start = time(s_h, s_m)
        end = time(e_h, e_m)

        if start <= end:
            return start <= now <= end
        else:
            # Spans midnight (e.g. 22:00 to 08:00)
            return now >= start or now <= end
    except Exception:
        return False


def create_in_app_notification(
    user_id: str,
    notif_type: str,
    title: Optional[str] = None,
    message: Optional[str] = None,
    action_url: Optional[str] = None
) -> Dict[str, Any]:
    """Creates a neutral in-app notification in the database."""
    template = NEUTRAL_TEMPLATES.get(notif_type, NEUTRAL_TEMPLATES["checkin"])
    final_title = title or template["title"]
    final_msg = sanitize_neutral_notification_text(message or template["message"])
    final_url = action_url or template["action_url"]

    nid = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, is_read)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    """, (nid, user_id, notif_type, final_title, final_msg, final_url))
    conn.commit()
    conn.close()

    return {
        "id": nid,
        "type": notif_type,
        "title": final_title,
        "message": final_msg,
        "action_url": final_url,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    }


def list_in_app_notifications(user_id: str, limit: int = 50) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, type, title, message, action_url, is_read, created_at
        FROM in_app_notifications
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
    """, (user_id, limit))
    rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT COUNT(*) as unread
        FROM in_app_notifications
        WHERE user_id = ? AND is_read = 0
    """, (user_id,))
    unread_count = (cursor.fetchone() or {})["unread"] or 0
    conn.close()

    return {
        "notifications": rows,
        "unread_count": unread_count
    }


def mark_notification_read(user_id: str, notification_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE in_app_notifications
        SET is_read = 1
        WHERE id = ? AND user_id = ?
    """, (notification_id, user_id))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def mark_all_notifications_read(user_id: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE in_app_notifications
        SET is_read = 1
        WHERE user_id = ?
    """, (user_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected


def delete_in_app_notification(user_id: str, notification_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM in_app_notifications
        WHERE id = ? AND user_id = ?
    """, (notification_id, user_id))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def send_web_push_notification(
    user_id: str,
    notif_type: str = "checkin",
    custom_title: Optional[str] = None,
    custom_message: Optional[str] = None,
    action_url: Optional[str] = None,
    ignore_quiet_hours: bool = False
) -> Dict[str, Any]:
    """
    Sends Web Push to all active registered devices of user_id.
    - Respects quiet hours unless explicitly ignored.
    - Sanitizes text to be completely neutral and non-sensitive.
    - Also records in in-app notification center.
    """
    prefs = get_notification_preferences(user_id)
    if not prefs["enabled"]:
        return {"status": "skipped", "reason": "notifications_disabled_by_user"}

    # Type check
    type_key = f"type_{notif_type}"
    if type_key in prefs and not prefs[type_key]:
        return {"status": "skipped", "reason": f"{notif_type}_notifications_disabled"}

    # Quiet hours check
    if not ignore_quiet_hours and is_in_quiet_hours(prefs["quiet_hours_start"], prefs["quiet_hours_end"]):
        return {"status": "delayed", "reason": "in_quiet_hours"}

    template = NEUTRAL_TEMPLATES.get(notif_type, NEUTRAL_TEMPLATES["checkin"])
    title = custom_title or template["title"]
    message = sanitize_neutral_notification_text(custom_message or template["message"])
    url = action_url or template["action_url"]

    # Also log into in-app notification center
    in_app_record = create_in_app_notification(user_id, notif_type, title, message, url)

    # Fetch subscriptions
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, endpoint, p256dh, auth
        FROM web_push_subscriptions
        WHERE user_id = ?
    """, (user_id,))
    subs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if not subs:
        return {"status": "in_app_only", "devices": 0, "notification": in_app_record}

    payload = json.dumps({
        "title": title,
        "body": message,
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/badge-72x72.png",
        "data": {
            "url": url,
            "id": in_app_record["id"]
        }
    })

    vapid_manager = VapidKeyManager.get()
    sent_count = 0
    expired_endpoints = []

    for sub in subs:
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"]
            }
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=vapid_manager.get_private_pem_bytes().decode("utf-8"),
                vapid_claims=VAPID_CLAIMS
            )
            sent_count += 1
        except WebPushException as ex:
            logger.warning("WebPush error for endpoint %s: %s", sub["endpoint"], ex)
            # If 404 or 410 Gone, device subscription expired
            if ex.response is not None and ex.response.status_code in (404, 410):
                expired_endpoints.append(sub["endpoint"])
        except Exception as e:
            logger.debug("Push delivery failed: %s", e)

    # Clean up expired endpoints
    if expired_endpoints:
        conn = get_db()
        cursor = conn.cursor()
        for ep in expired_endpoints:
            cursor.execute("DELETE FROM web_push_subscriptions WHERE endpoint = ?", (ep,))
        conn.commit()
        conn.close()

    return {
        "status": "sent",
        "devices_contacted": sent_count,
        "notification": in_app_record
    }
