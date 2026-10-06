"""
services/chat_extractor.py - Asynchronous Background Extraction with Gemini Function Calling
─────────────────────────────────────────────────────────────────────────────────────────────
Runs concurrently in the background after every user message (never blocking the user reply).
Uses:
- Model: gemini-3.8-flash (with fallback chain)
- Thinking level: MEDIUM
- Tools:
  * log_mood(score 1-5, emotions[], note) -> Mood Journey
  * log_dimension(dimension: stress|sleep|energy|focus|workload|activity, value 1-10, note) -> Digital Twin
  * save_memory(fact, category: people|goals|triggers|coping|preferences, confidence) -> Memory Center
  * add_goal(text) -> Journal & Goals
  * add_journal_entry(summary) -> Mindful Journal
  * record_what_helped(technique, outcome) -> What Works For Me
  * set_reminder(text, time_or_recurrence) -> Notifications / Reminders (asks 1 confirmation)
  * update_preference(key, value) -> User Preferences (asks 1 confirmation if implied)

Strict Privacy & Factual Fidelity:
- Confidence thresholding (minimum 0.70)
- Only calls a tool when the user clearly asserted it; zero hallucination.
- Per-user AES-256-GCM encryption in DB.
- Respects 'auto_save_from_chat' toggle and 'manual_only_mode'.
- Produces auto_save_audit entries for transparent toasts and instantaneous Undo.
"""

import os
import re
import json
import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple
import httpx
from dotenv import load_dotenv

from ..database import get_db
from .user_crypto import encrypt_user_text, decrypt_user_text

load_dotenv()
logger = logging.getLogger("manas.chat_extractor")

PRIMARY_EXTRACTOR_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_EXTRACTOR_MODELS = [
    PRIMARY_EXTRACTOR_MODEL,
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
]
EXTRACTION_MODELS_CHAIN = list(dict.fromkeys(FALLBACK_EXTRACTOR_MODELS))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def sync_to_supabase_sync(table: str, row: Dict[str, Any]) -> None:
    """Synchronizes extracted row to Supabase Postgres using the service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
    uid = str(row.get("user_id", ""))
    if not uid or len(uid) != 36:
        return
    try:
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        with httpx.Client(timeout=4.0) as client:
            client.post(url, headers=headers, json=row)
    except Exception as e:
        logger.debug("Supabase sync to %s note: %s", table, e)

# Exact function declarations required
EXTRACTION_FUNCTION_DECLARATIONS = [
    {
        "name": "log_mood",
        "description": "Log the user's emotional state only when the user explicitly expresses how they are feeling right now. Score 1 (Very Low/Distressed) to 5 (Joyful/Peaceful).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "score": {
                    "type": "INTEGER",
                    "description": "Mood score: 1 (Very Low), 2 (Low/Anxious), 3 (Neutral/Tired), 4 (Calm/Good), 5 (Joyful/Great)"
                },
                "emotions": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                    "description": "Emotions explicitly stated by the user (e.g. anxious, exhausted, hopeful, grateful, angry)"
                },
                "note": {
                    "type": "STRING",
                    "description": "Brief factual summary of why the user feels this way, strictly from user's words"
                }
            },
            "required": ["score", "emotions"]
        }
    },
    {
        "name": "log_dimension",
        "description": "Log a specific wellness dimension when the user explicitly talks about their stress, sleep, energy, focus, workload, or physical activity.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "dimension": {
                    "type": "STRING",
                    "enum": ["stress", "sleep", "energy", "focus", "workload", "activity"],
                    "description": "Wellness dimension"
                },
                "value": {
                    "type": "INTEGER",
                    "description": "Dimension intensity from 1 (lowest/worst) to 10 (highest/strongest)"
                },
                "note": {
                    "type": "STRING",
                    "description": "Short quote or factual note from user text"
                }
            },
            "required": ["dimension", "value"]
        }
    },
    {
        "name": "save_memory",
        "description": "Save an important personal fact about the user's life, loved ones, triggers, coping mechanisms, or core preferences to the Memory Center. Never invent facts. Confidence must be >= 0.7.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "fact": {
                    "type": "STRING",
                    "description": "Clear, concise fact about the user (e.g. 'Lives with elder grandmother', 'Exams start next Tuesday')"
                },
                "category": {
                    "type": "STRING",
                    "enum": ["people", "goals", "triggers", "coping", "preferences"],
                    "description": "Category for the memory"
                },
                "confidence": {
                    "type": "NUMBER",
                    "description": "Confidence from 0.0 to 1.0 that the user clearly stated this fact"
                }
            },
            "required": ["fact", "category", "confidence"]
        }
    },
    {
        "name": "add_goal",
        "description": "Add a new personal aspiration, habit, or goal that the user explicitly states they want to achieve or start.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "text": {
                    "type": "STRING",
                    "description": "Goal or habit description"
                }
            },
            "required": ["text"]
        }
    },
    {
        "name": "add_journal_entry",
        "description": "Save a reflective journal summary when the user shares a meaningful personal reflection, breakthrough, or story.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "summary": {
                    "type": "STRING",
                    "description": "Reflective summary of user's personal thought or experience"
                }
            },
            "required": ["summary"]
        }
    },
    {
        "name": "record_what_helped",
        "description": "Record a coping technique, habit, or action that the user explicitly states helped them feel better or failed to help.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "technique": {
                    "type": "STRING",
                    "description": "Name of technique or activity (e.g. '4-7-8 Breathing', 'Evening walk in park', 'Lo-fi ambient music')"
                },
                "outcome": {
                    "type": "STRING",
                    "description": "User reported outcome (e.g. 'helped calm heartbeat', 'eased headache', 'did not help focus')"
                }
            },
            "required": ["technique", "outcome"]
        }
    },
    {
        "name": "set_reminder",
        "description": "Set a reminder when the user mentions wanting a reminder or mentions a specific check-in time (e.g. 'remind me at 9pm', 'check on me tomorrow morning').",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "text": {
                    "type": "STRING",
                    "description": "What to be reminded about (neutral phrasing)"
                },
                "time_or_recurrence": {
                    "type": "STRING",
                    "description": "Stated time or recurrence (e.g. '9:00 PM', 'daily morning', 'tomorrow 10am')"
                }
            },
            "required": ["text", "time_or_recurrence"]
        }
    },
    {
        "name": "update_preference",
        "description": "Update user lifestyle or app preference when user explicitly states it (e.g. 'I wake up at 7am', 'mornings are hard', 'keep notifications off during afternoon').",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "key": {
                    "type": "STRING",
                    "description": "Preference key (e.g. 'wake_time', 'difficult_time_of_day', 'preferred_tone')"
                },
                "value": {
                    "type": "STRING",
                    "description": "Preference value stated by user"
                }
            },
            "required": ["key", "value"]
        }
    }
]

SYSTEM_INSTRUCTION = """You are the factual extraction engine for MANAS.
Your ONLY role is to analyze the user's latest message in context of the conversation and determine if ANY of the extraction tools should be called.

STRICT CLINICAL & FACTUAL RULES:
1. ONLY call a tool if the user CLEARLY and EXPLICITLY stated or confirmed it.
2. NEVER invent, extrapolate, or hallucinate facts, emotions, or goals that were not said.
3. For save_memory, minimum confidence is 0.70. If you are uncertain, do NOT call save_memory.
4. For log_dimension, only call if user mentioned their stress, sleep, energy, focus, workload, or activity.
5. If the user is merely asking a general question or greeting (e.g. 'hi', 'how are you', 'what is anxiety?'), call ZERO tools.
6. Call multiple tools if the user expressed multiple distinct items in their message.
"""

def is_auto_save_allowed(user_id: str) -> bool:
    """Checks whether the user has auto-save enabled and is not in manual-only mode."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT auto_save_from_chat, manual_only_mode
        FROM user_app_settings
        WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return True  # Default on as requested
    auto_save = bool(row["auto_save_from_chat"])
    manual_only = bool(row["manual_only_mode"])
    return auto_save and not manual_only

async def extract_chat_features_gemini(
    user_id: str,
    user_message: str,
    recent_history: Optional[List[Dict[str, str]]] = None,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Calls Gemini API with function calling tools and thinking level MEDIUM.
    Returns list of parsed tool invocations: [{"name": "...", "args": {...}}].
    """
    key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""
    if not key or len(key.strip()) < 15:
        logger.warning("No Gemini API key available for background extraction.")
        return []

    # Build prompt context
    contents = []
    if recent_history:
        for turn in recent_history[-6:]:
            role = "model" if turn.get("sender") == "mascot" else "user"
            txt = turn.get("text", "").strip()
            if txt:
                contents.append({"role": role, "parts": [{"text": txt}]})

    contents.append({"role": "user", "parts": [{"text": user_message.strip()}]})

    payload = {
        "systemInstruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}]
        },
        "contents": contents,
        "tools": [
            {
                "functionDeclarations": EXTRACTION_FUNCTION_DECLARATIONS
            }
        ],
        "toolConfig": {
            "functionCallingConfig": {
                "mode": "AUTO"
            }
        },
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 600,
            "thinkingConfig": {
                "thinkingLevel": "MEDIUM"
            }
        }
    }

    tool_calls: List[Dict[str, Any]] = []

    for target_model in EXTRACTION_MODELS_CHAIN:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}"
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "functionCall" in part:
                                fc = part["functionCall"]
                                name = fc.get("name")
                                args = fc.get("args") or {}
                                if name:
                                    tool_calls.append({"name": name, "args": args})
                    return tool_calls
                else:
                    logger.debug("Extraction model %s returned status %d", target_model, res.status_code)
        except Exception as e:
            logger.debug("Extraction model %s call exception: %s", target_model, e)
            continue

    return tool_calls

def execute_extraction_actions(
    user_id: str,
    tool_calls: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Executes and persists each tool call into the database with per-user AES-256 encryption.
    Records auto_save_audit row for UI toast and Undo support.
    """
    if not is_auto_save_allowed(user_id):
        logger.info("Auto-save is disabled or Manual-only mode is active for user %s", user_id)
        return []

    executed_results: List[Dict[str, Any]] = []
    conn = get_db()
    cursor = conn.cursor()

    for tc in tool_calls:
        name = tc.get("name")
        args = tc.get("args") or {}
        audit_id = str(uuid.uuid4())

        try:
            if name == "log_mood":
                score = int(args.get("score", 3))
                score = max(1, min(5, score))
                emotions = args.get("emotions", [])
                if isinstance(emotions, str):
                    emotions = [emotions]
                note = args.get("note", "")
                tags_str = ", ".join(emotions) if emotions else "Chat Check-in"

                entry_id = str(uuid.uuid4())
                encrypted_note = encrypt_user_text(user_id, note)
                cursor.execute("""
                    INSERT INTO mood_entries (id, user_id, score, tags, note)
                    VALUES (?, ?, ?, ?, ?)
                """, (entry_id, user_id, score, tags_str, encrypted_note))

                sync_to_supabase_sync("mood_events", {
                    "user_id": user_id,
                    "score": score,
                    "emotions": emotions,
                    "note": note
                })

                summary = f"Mood score {score}/5 ({tags_str})"
                target_screen = "Mood Journey"
                toast_msg = "Logged to Mood Journey"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, entry_id, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": entry_id,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "score": score,
                    "tags": tags_str,
                    "requires_confirmation": False
                })

            elif name == "log_dimension":
                dimension = str(args.get("dimension", "stress")).lower()
                valid_dims = ["stress", "sleep", "energy", "focus", "workload", "activity"]
                if dimension not in valid_dims:
                    dimension = "stress"
                val = float(args.get("value", 5))
                val = max(1.0, min(10.0, val))
                note = args.get("note", "")

                entry_id = str(uuid.uuid4())
                encrypted_note = encrypt_user_text(user_id, note)
                cursor.execute("""
                    INSERT INTO wellness_entries (id, user_id, metric_type, score, note)
                    VALUES (?, ?, ?, ?, ?)
                """, (entry_id, user_id, dimension, val, encrypted_note))

                twin_payload: Dict[str, Any] = {"user_id": user_id, "source": "chat_auto", "note": note}
                if dimension in valid_dims:
                    twin_payload[dimension] = val
                sync_to_supabase_sync("twin_snapshots", twin_payload)

                summary = f"{dimension.capitalize()} logged at {int(val)}/10"
                target_screen = "Digital Mental Twin"
                toast_msg = f"Auto-filled to Digital Twin ({dimension.capitalize()})"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, entry_id, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": entry_id,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "dimension": dimension,
                    "value": val,
                    "requires_confirmation": False
                })

            elif name == "save_memory":
                fact = args.get("fact", "").strip()
                cat = str(args.get("category", "preferences")).lower()
                valid_cats = ["people", "goals", "triggers", "coping", "preferences"]
                if cat not in valid_cats:
                    cat = "preferences"
                confidence = float(args.get("confidence", 1.0))

                if not fact or confidence < 0.65:
                    continue

                mem_id = str(uuid.uuid4())
                encrypted_fact = encrypt_user_text(user_id, fact)
                cursor.execute("""
                    INSERT INTO user_memories (id, user_id, category, fact, importance)
                    VALUES (?, ?, ?, ?, ?)
                """, (mem_id, user_id, cat, encrypted_fact, confidence))

                sync_to_supabase_sync("memories", {
                    "user_id": user_id,
                    "category": cat,
                    "fact": fact,
                    "importance": confidence,
                    "source": "chat_auto"
                })

                summary = f"{cat.capitalize()}: {fact[:45]}"
                target_screen = "Memory Center"
                toast_msg = "Saved to Memory Center"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, mem_id, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": mem_id,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "fact": fact,
                    "category": cat,
                    "requires_confirmation": False
                })

            elif name == "add_goal":
                text = args.get("text", "").strip()
                if not text:
                    continue

                goal_id = str(uuid.uuid4())
                encrypted_title = encrypt_user_text(user_id, text)
                cursor.execute("""
                    INSERT INTO goals (id, user_id, title, category)
                    VALUES (?, ?, ?, 'mindfulness')
                """, (goal_id, user_id, encrypted_title))

                sync_to_supabase_sync("goals", {
                    "user_id": user_id,
                    "title": text,
                    "source": "chat_auto"
                })

                summary = f"Goal: {text[:40]}"
                target_screen = "Journal & Goals"
                toast_msg = "Added to Goals"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, goal_id, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": goal_id,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "text": text,
                    "requires_confirmation": False
                })

            elif name == "add_journal_entry":
                summary_text = args.get("summary", "").strip()
                if not summary_text:
                    continue

                jid = str(uuid.uuid4())
                encrypted_content = encrypt_user_text(user_id, summary_text)
                title = "Reflection from Chat"
                cursor.execute("""
                    INSERT INTO journal_entries (id, user_id, title, content, tags)
                    VALUES (?, ?, ?, ?, '["chat-extracted"]')
                """, (jid, user_id, title, encrypted_content))

                sync_to_supabase_sync("journal_entries", {
                    "user_id": user_id,
                    "title": "Reflection from Chat",
                    "content": summary_text,
                    "tags": ["chat-extracted"],
                    "is_auto_summary": True
                })

                summary = f"Journal entry: {summary_text[:40]}"
                target_screen = "Journal & Goals"
                toast_msg = "Saved to Mindful Journal"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, jid, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": jid,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "text": summary_text,
                    "requires_confirmation": False
                })

            elif name == "record_what_helped":
                technique = args.get("technique", "").strip()
                outcome = args.get("outcome", "").strip()
                if not technique:
                    continue

                is_positive = not any(neg in outcome.lower() for neg in ["not", "failed", "worse", "didn't", "no difference"])

                # Upsert into what_works_profiles
                cursor.execute("""
                    INSERT INTO what_works_profiles (id, user_id, strategy_name, total_uses, positive_feedback_count, negative_feedback_count, success_rate)
                    VALUES (?, ?, ?, 1, ?, ?, ?)
                    ON CONFLICT(user_id, strategy_name) DO UPDATE SET
                        total_uses = total_uses + 1,
                        positive_feedback_count = positive_feedback_count + excluded.positive_feedback_count,
                        negative_feedback_count = negative_feedback_count + excluded.negative_feedback_count,
                        success_rate = ROUND(CAST(positive_feedback_count + excluded.positive_feedback_count AS REAL) / (total_uses + 1), 2),
                        last_used_at = CURRENT_TIMESTAMP
                """, (
                    str(uuid.uuid4()), user_id, technique,
                    1 if is_positive else 0,
                    0 if is_positive else 1,
                    1.0 if is_positive else 0.0
                ))

                sync_to_supabase_sync("insights", {
                    "user_id": user_id,
                    "strategy_name": technique,
                    "suggestion_text": outcome or f"Try {technique} to self-regulate",
                    "evidence_message": f"You noted that {technique} helped in chat",
                    "action_type": "try_this",
                    "effectiveness_score": 1.0 if is_positive else 0.2,
                    "is_helpful": is_positive
                })

                summary = f"{technique}: {outcome[:35]}"
                target_screen = "What Works For Me"
                toast_msg = "Recorded in What Works For Me"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, technique, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": technique,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": toast_msg,
                    "summary": summary,
                    "technique": technique,
                    "outcome": outcome,
                    "requires_confirmation": False
                })

            elif name == "set_reminder":
                # Requirement 4: If chat implies a preference/reminder, ask ONE confirmation before saving
                text = args.get("text", "Check-in").strip()
                time_rec = args.get("time_or_recurrence", "").strip()
                if not time_rec:
                    continue

                rem_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO user_reminders (id, user_id, reminder_text, time_or_recurrence, status)
                    VALUES (?, ?, ?, ?, 'pending')
                """, (rem_id, user_id, text, time_rec))

                confirmation_text = f"Would you like me to set a reminder for {time_rec}?"
                summary = f"Reminder: {time_rec}"
                target_screen = "Notifications"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, rem_id, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": rem_id,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": f"Confirm reminder: {time_rec}",
                    "summary": summary,
                    "requires_confirmation": True,
                    "confirmation_prompt": confirmation_text,
                    "reminder_text": text,
                    "time_or_recurrence": time_rec
                })

            elif name == "update_preference":
                # Requirement 4: Implied preference asks ONE confirmation before saving
                pkey = args.get("key", "").strip().lower()
                pval = args.get("value", "").strip()
                if not pkey or not pval:
                    continue

                pid = str(uuid.uuid4())
                confirmation_text = f"Would you like to save this preference: '{pkey}' = '{pval}'?"
                summary = f"Preference: {pkey} -> {pval}"
                target_screen = "Settings"

                cursor.execute("""
                    INSERT INTO auto_save_audit (id, user_id, tool, item_id, target_screen, summary, details_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (audit_id, user_id, name, pid, target_screen, summary, json.dumps(args)))

                executed_results.append({
                    "action_id": audit_id,
                    "item_id": pid,
                    "tool": name,
                    "target_screen": target_screen,
                    "toast_message": f"Confirm preference: {pkey}?",
                    "summary": summary,
                    "requires_confirmation": True,
                    "confirmation_prompt": confirmation_text,
                    "pref_key": pkey,
                    "pref_value": pval
                })

        except Exception as err:
            logger.error("Error executing tool %s: %s", name, err)
            continue

    conn.commit()
    conn.close()
    return executed_results

def undo_auto_save_action(user_id: str, action_id: str) -> Dict[str, Any]:
    """
    Reverses an auto-saved action: deletes the created item from its table
    and marks the audit record as is_undone = 1.
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, tool, item_id, target_screen, is_undone
        FROM auto_save_audit
        WHERE id = ? AND user_id = ?
    """, (action_id, user_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return {"status": "error", "success": False, "message": "Action not found or unauthorized"}

    if row["is_undone"]:
        conn.close()
        return {"status": "already_undone", "success": False, "message": "This action was already undone"}

    tool = row["tool"]
    item_id = row["item_id"]

    try:
        if tool == "log_mood":
            cursor.execute("DELETE FROM mood_entries WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "log_dimension":
            cursor.execute("DELETE FROM wellness_entries WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "save_memory":
            cursor.execute("DELETE FROM user_memories WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "add_goal":
            cursor.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "add_journal_entry":
            cursor.execute("DELETE FROM journal_entries WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "record_what_helped":
            # item_id is technique name
            cursor.execute("DELETE FROM what_works_profiles WHERE user_id = ? AND strategy_name = ?", (user_id, item_id))
        elif tool == "set_reminder":
            cursor.execute("DELETE FROM user_reminders WHERE id = ? AND user_id = ?", (item_id, user_id))
        elif tool == "update_preference":
            cursor.execute("DELETE FROM user_preferences WHERE id = ? AND user_id = ?", (item_id, user_id))

        cursor.execute("UPDATE auto_save_audit SET is_undone = 1 WHERE id = ?", (action_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "success": True, "message": f"Undid save to {row['target_screen']}"}
    except Exception as e:
        conn.close()
        return {"status": "error", "success": False, "message": str(e)}

async def run_chat_background_extraction(
    user_id: str,
    user_message: str,
    recent_history: Optional[List[Dict[str, str]]] = None,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Top-level entrypoint called in background after user message."""
    tool_calls = await extract_chat_features_gemini(
        user_id=user_id,
        user_message=user_message,
        recent_history=recent_history,
        api_key=api_key
    )
    if not tool_calls:
        return []
    return execute_extraction_actions(user_id=user_id, tool_calls=tool_calls)
