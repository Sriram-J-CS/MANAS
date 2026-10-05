"""
gemini_provider.py - Live Gemini LLM Provider for MANAS
───────────────────────────────────────────────────────
Handles:
1. Server-side API key management (GEMINI_API_KEY, AI_PROVIDER_API_KEY).
2. Model resolution from env (GEMINI_MODEL, default gemini-flash-latest).
3. System prompt construction with user profile, anti-repetition of last 5 bot turns,
   rolling summary of older turns, and past session memory.
4. Token-by-token streaming with structured output JSON schema:
   { reply, emotion, suggest_tool, quick_replies, risk_level }.
5. Friendly error handling: "Connection hiccup, please try again." (no canned therapy text).
6. Session memory summarization (mood themes, what helped).
"""

import os
import re
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("manas.gemini_provider")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-pro-latest"
]
MODELS_CHAIN = list(dict.fromkeys(FALLBACK_MODELS))

STRUCTURED_OUTPUT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {
            "type": "STRING",
            "description": "Conversational reply in 2-4 short sentences, reflecting user's exact words and feelings, natural spoken style (code-mixing allowed)."
        },
        "emotion": {
            "type": "STRING",
            "enum": ["calm", "empathetic", "encouraging", "concerned"]
        },
        "suggest_tool": {
            "type": "STRING",
            "enum": ["none", "breathing", "grounding", "music", "journaling"]
        },
        "quick_replies": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Exactly 3 concise, natural follow-up options for the user to tap."
        },
        "risk_level": {
            "type": "STRING",
            "enum": ["none", "low", "medium", "high"]
        }
    },
    "required": ["reply", "emotion", "suggest_tool", "quick_replies", "risk_level"]
}


def build_companion_system_prompt(
    user_name: str = "Friend",
    age: int = 20,
    language: str = "en",
    companion_tone: str = "gentle",
    recent_bot_messages: Optional[List[str]] = None,
    rolling_summary: str = "",
    session_memory: Optional[Dict[str, Any]] = None,
) -> str:
    """
    System prompt adhering strictly to clinical safety and conversational guidelines:
    - Warm, friendly companion, NOT a therapist.
    - Never diagnose or prescribe.
    - Reflect user's exact words and feelings.
    - Reply in user's chosen language in natural spoken style (code-mix allowed).
    - 2-4 short sentences.
    - Ask at most ONE gentle open question.
    - Vary openers and structure every turn.
    - Never repeat a phrase used in the last 5 bot messages.
    - No stock lines like "I'm right here beside you" unless it genuinely fits.
    """
    lang_map = {
        "ta": "Tamil",
        "hi": "Hindi",
        "te": "Telugu",
        "kn": "Kannada",
        "ml": "Malayalam",
        "bn": "Bengali",
        "mr": "Marathi",
        "en": "English",
    }
    lang_label = lang_map.get(language, language)

    anti_repetition_prompt = ""
    if recent_bot_messages:
        cleaned_recent = [m.strip() for m in recent_bot_messages[-5:] if m.strip()]
        if cleaned_recent:
            recent_bullets = "\n".join(f"- \"{m}\"" for m in cleaned_recent)
            anti_repetition_prompt = (
                f"\nANTI-REPETITION (STRICT MANDATE):\n"
                f"Never repeat any phrase, opening line, or sentence structure used in your recent bot messages below:\n"
                f"{recent_bullets}\n"
            )

    memory_prompt = ""
    if session_memory:
        themes = session_memory.get("mood_themes", "")
        helped = session_memory.get("what_helped", "")
        summary = session_memory.get("summary", "")
        memory_prompt = (
            f"\nPREVIOUS SESSION MEMORY (RECALL GENTLY IF RELEVANT):\n"
            f"- Past Themes: {themes}\n"
            f"- What Helped: {helped}\n"
            f"- Summary: {summary}\n"
        )

    rolling_prompt = ""
    if rolling_summary:
        rolling_prompt = f"\nSUMMARY OF OLDER CONVERSATION TURNS:\n{rolling_summary}\n"

    return f"""You are MANAS, a warm, friendly emotional wellness companion.
You are a supportive friend, NOT a therapist.

STRICT CLINICAL BOUNDARIES:
- Never diagnose any medical or mental health condition.
- Never prescribe medications, dosages, or medical treatments.

CONVERSATIONAL GUIDELINES:
1. REFLECTION: Reflect the user's exact words and feelings so they feel deeply understood.
2. LANGUAGE & NATURAL SPOKEN STYLE: Reply in the user's chosen language ({lang_label}) in natural spoken style. Code-mixing (like Tanglish or Hinglish) is completely allowed if that feels natural and conversational.
3. CONCISENESS: Exactly 2 to 4 short sentences. Do not write long paragraphs or lists.
4. INQUIRY: Ask at most ONE gentle open question to invite the user to share further.
5. VARIETY & OPENERS: Vary your openers and sentence structure every single turn.
6. NO STOCK LINES: Absolutely NO stock lines (e.g. "I'm right here beside you", "Take a deep breath with me") unless it specifically and genuinely fits their exact context.
{anti_repetition_prompt}{memory_prompt}{rolling_prompt}
USER PROFILE:
- Preferred Name: {user_name}
- Age: {age}
- Language: {lang_label} ({language})
- Companion Tone: {companion_tone}

You must return a valid JSON object matching the requested schema.
"""


class GeminiProvider:
    """Production provider interface for Google Gemini API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def is_configured(self) -> bool:
        """Returns True if a valid API key is present."""
        return bool(self.api_key and len(self.api_key.strip()) > 15)

    def get_model_name(self) -> str:
        """Resolves model name from environment or fallback."""
        return os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    async def health_check(self) -> Dict[str, Any]:
        """Server-side health check verifying API connectivity and model availability."""
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "provider": "google_gemini",
                "message": "Gemini API key is not configured in environment.",
                "model": self.get_model_name()
            }

        target_model = self.get_model_name()
        url = f"{self.base_url}/{target_model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return {
                        "status": "healthy",
                        "provider": "google_gemini",
                        "model": target_model,
                        "latency_ms": round(res.elapsed.total_seconds() * 1000)
                    }
                return {
                    "status": "degraded" if res.status_code != 429 else "rate_limited",
                    "provider": "google_gemini",
                    "model": target_model,
                    "code": res.status_code
                }
        except Exception as e:
            return {
                "status": "error",
                "provider": "google_gemini",
                "message": str(e)
            }

    async def stream_chat(
        self,
        message: str,
        user_name: str = "Friend",
        age: int = 20,
        language: str = "en",
        companion_tone: str = "gentle",
        history_turns: Optional[List[Dict[str, str]]] = None,
        rolling_summary: str = "",
        session_memory: Optional[Dict[str, Any]] = None,
        recent_bot_messages: Optional[List[str]] = None,
    ) -> AsyncGenerator[Tuple[str, Any], None]:
        """
        Streams response from Gemini API using Server-Sent Events.
        Yields:
          ("token", token_string) as reply tokens are parsed from stream
          ("meta", structured_dict) containing { reply, emotion, suggest_tool, quick_replies, risk_level }
          ("error", error_message) on API failure
        """
        if not self.is_configured():
            logger.warning("Gemini API key is not configured")
            yield ("token", "Connection hiccup, please try again.")
            yield ("meta", {
                "reply": "Connection hiccup, please try again.",
                "emotion": "calm",
                "suggest_tool": "none",
                "quick_replies": [],
                "risk_level": "none",
                "is_error": True,
            })
            return

        system_instruction = build_companion_system_prompt(
            user_name=user_name,
            age=age,
            language=language,
            companion_tone=companion_tone,
            recent_bot_messages=recent_bot_messages,
            rolling_summary=rolling_summary,
            session_memory=session_memory,
        )

        # Build contents from last 20 turns + current message
        contents: List[Dict[str, Any]] = []
        if history_turns:
            # Keep at most last 20 turns
            trimmed = history_turns[-20:]
            # Ensure proper alternating roles for Gemini
            last_role = None
            for turn in trimmed:
                sender = turn.get("sender", "user")
                role = "model" if sender == "mascot" else "user"
                text = turn.get("text", "").strip()
                if not text:
                    continue
                if role == last_role and contents:
                    # Append text to previous turn if consecutive same role
                    contents[-1]["parts"][0]["text"] += f"\n{text}"
                else:
                    contents.append({"role": role, "parts": [{"text": text}]})
                    last_role = role

        # Append current user message
        if contents and contents[-1]["role"] == "user":
            contents[-1]["parts"][0]["text"] += f"\n{message.strip()}"
        else:
            contents.append({"role": "user", "parts": [{"text": message.strip()}]})

        target_model = self.get_model_name()
        url = f"{self.base_url}/{target_model}:streamGenerateContent?key={self.api_key}&alt=sse"

        payload = {
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": STRUCTURED_OUTPUT_SCHEMA,
                "temperature": 0.7,
                "maxOutputTokens": 600,
            }
        }

        raw_accumulated = ""
        yielded_len = 0
        reply_started = False
        reply_finished = False

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        logger.error("Gemini stream error %d: %s", response.status_code, err_body.decode(errors="ignore")[:300])
                        yield ("error", "Connection hiccup, please try again.")
                        yield ("token", "Connection hiccup, please try again.")
                        yield ("meta", {
                            "reply": "Connection hiccup, please try again.",
                            "emotion": "calm",
                            "suggest_tool": "none",
                            "quick_replies": [],
                            "risk_level": "none",
                            "is_error": True,
                        })
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        chunk_text = line[5:].strip()
                        if not chunk_text or chunk_text == "[DONE]":
                            continue

                        try:
                            chunk_json = json.loads(chunk_text)
                            candidates = chunk_json.get("candidates", [])
                            if not candidates:
                                continue
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for p in parts:
                                part_text = p.get("text", "")
                                if not part_text:
                                    continue
                                raw_accumulated += part_text

                                # Parse reply field streaming in real time
                                if not reply_started:
                                    m = re.search(r'"reply"\s*:\s*"', raw_accumulated)
                                    if m:
                                        reply_started = True
                                        content_after = raw_accumulated[m.end():]
                                        end_m = re.search(r'(?<!\\)"', content_after)
                                        if end_m:
                                            reply_token = content_after[:end_m.start()]
                                            reply_finished = True
                                            if reply_token:
                                                yield ("token", reply_token)
                                        else:
                                            if content_after:
                                                yield ("token", content_after)
                                                yielded_len = len(content_after)
                                elif not reply_finished:
                                    m = re.search(r'"reply"\s*:\s*"', raw_accumulated)
                                    if m:
                                        content_after = raw_accumulated[m.end():]
                                        end_m = re.search(r'(?<!\\)"', content_after)
                                        if end_m:
                                            full_reply = content_after[:end_m.start()]
                                            new_token = full_reply[yielded_len:]
                                            if new_token:
                                                yield ("token", new_token)
                                            reply_finished = True
                                        else:
                                            new_token = content_after[yielded_len:]
                                            if new_token:
                                                yield ("token", new_token)
                                                yielded_len = len(content_after)
                        except Exception as parse_err:
                            logger.debug("Chunk JSON parse note: %s", parse_err)
                            continue

            # Parse finalized JSON payload
            parsed_data: Dict[str, Any] = {}
            try:
                # Find outermost JSON object
                json_match = re.search(r'\{[\s\S]*\}', raw_accumulated)
                if json_match:
                    parsed_data = json.loads(json_match.group(0))
            except Exception as final_parse_err:
                logger.warning("Failed to parse final JSON from Gemini: %s", final_parse_err)

            final_reply = parsed_data.get("reply")
            if not final_reply and raw_accumulated:
                # Fallback to regex extraction of reply
                rep_match = re.search(r'"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', raw_accumulated)
                if rep_match:
                    final_reply = rep_match.group(1).encode('utf-8').decode('unicode_escape')
                else:
                    final_reply = raw_accumulated.strip()

            if not final_reply:
                final_reply = "Connection hiccup, please try again."

            final_emotion = parsed_data.get("emotion") if parsed_data.get("emotion") in ("calm", "empathetic", "encouraging", "concerned") else "calm"
            final_tool = parsed_data.get("suggest_tool") if parsed_data.get("suggest_tool") in ("none", "breathing", "grounding", "music", "journaling") else "none"
            final_quick = parsed_data.get("quick_replies") if isinstance(parsed_data.get("quick_replies"), list) else []
            final_risk = parsed_data.get("risk_level") if parsed_data.get("risk_level") in ("none", "low", "medium", "high") else "none"

            yield ("meta", {
                "reply": final_reply,
                "emotion": final_emotion,
                "suggest_tool": final_tool,
                "quick_replies": final_quick[:3],
                "risk_level": final_risk,
                "is_error": False,
            })

        except Exception as e:
            logger.error("Gemini stream connection error: %s", e)
            yield ("error", "Connection hiccup, please try again.")
            yield ("token", "Connection hiccup, please try again.")
            yield ("meta", {
                "reply": "Connection hiccup, please try again.",
                "emotion": "calm",
                "suggest_tool": "none",
                "quick_replies": [],
                "risk_level": "none",
                "is_error": True,
            })

    async def summarize_session(self, messages: List[Dict[str, str]]) -> Dict[str, str]:
        """
        Generates a concise session summary (mood themes, what helped).
        Called after each session to persist in DB for next time.
        """
        if not messages:
            return {
                "mood_themes": "General check-in",
                "what_helped": "Conversational reflection",
                "summary": "User completed a brief wellness check-in."
            }

        convo_lines = []
        for m in messages[-20:]:
            sender = m.get("sender", "user")
            text = m.get("text", "")
            if text:
                convo_lines.append(f"{sender}: {text}")
        convo_text = "\n".join(convo_lines)

        prompt = (
            "Analyze this brief supportive conversation and produce a JSON object with:\n"
            "1. 'mood_themes': 2-5 words summarizing user's emotional themes (e.g. 'Exam stress, trouble sleeping')\n"
            "2. 'what_helped': 2-5 words on what brought relief or tools discussed (e.g. '4-7-8 breathing, study pacing')\n"
            "3. 'summary': 1-2 sentence gentle summary of the session\n\n"
            f"Conversation:\n{convo_text}\n\n"
            "Output JSON format ONLY:\n"
            "{\"mood_themes\": \"...\", \"what_helped\": \"...\", \"summary\": \"...\"}"
        )

        if not self.is_configured():
            return {
                "mood_themes": "Emotional check-in",
                "what_helped": "Mindful reflection",
                "summary": "Completed a wellness check-in session."
            }

        target_model = self.get_model_name()
        url = f"{self.base_url}/{target_model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3,
                "maxOutputTokens": 250
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    parts = data.get("candidates", [])[0].get("content", {}).get("parts", [])
                    raw = parts[0].get("text", "")
                    parsed = json.loads(raw)
                    return {
                        "mood_themes": str(parsed.get("mood_themes", "Wellness check-in")),
                        "what_helped": str(parsed.get("what_helped", "Reflective conversation")),
                        "summary": str(parsed.get("summary", "User completed a supportive conversation."))
                    }
        except Exception as e:
            logger.warning("Session summarization failed: %s", e)

        return {
            "mood_themes": "Wellness check-in",
            "what_helped": "Reflective conversation",
            "summary": "User completed a supportive conversation."
        }


# Global singleton instance
gemini = GeminiProvider()
