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

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
]
MODELS_CHAIN = list(dict.fromkeys(FALLBACK_MODELS))

STRUCTURED_OUTPUT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {
            "type": "STRING",
            "description": "Visible display text in 2-4 short sentences, reflecting user's exact words and feelings, natural spoken style (code-mixing allowed for on-screen reading)."
        },
        "speech_text": {
            "type": "STRING",
            "description": (
                "Spoken text for voice synthesis. For non-English languages (ta, hi, te, ml, kn, bn, mr), "
                "it must be 100% in the chosen language and native script with ZERO Latin letters or English phrases "
                "(unless the user wrote them). Transliterate all English loanwords into the native script "
                "(e.g. stress -> ஸ்ட்ரெஸ் in Tamil, स्ट्रेस in Hindi, etc.). Natural colloquial spoken style."
            )
        },
        "speech_metadata": {
            "type": "OBJECT",
            "properties": {
                "style": {
                    "type": "STRING",
                    "description": "Warm style prompt for voice synthesis."
                },
                "language_code": {
                    "type": "STRING",
                    "description": "Exact BCP-47 language code, e.g. ta-IN, hi-IN, te-IN, ml-IN, kn-IN, bn-IN, mr-IN, en-IN"
                }
            }
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
    saved_memories: Optional[List[Dict[str, Any]]] = None,
    breathing_shown_recently: bool = False,
    turns_since_name_used: int = 5,
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
    - Name usage: Max once every ~5 turns.
    - Saved memories: Reference naturally without robotic listing.
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
    lang_clean = language.split("-")[0] if language else "en"
    lang_label = lang_map.get(lang_clean, language)
    region_map = {
        "ta": "Tamil Nadu",
        "hi": "North India",
        "te": "Andhra Pradesh and Telangana",
        "kn": "Karnataka",
        "ml": "Kerala",
        "bn": "Bengal",
        "mr": "Maharashtra",
        "en": "India",
    }
    region = region_map.get(lang_clean, "India")
    bcp47_code = f"{lang_clean}-IN"

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
            f"\nPREVIOUS SESSION SUMMARY (RECALL GENTLY IF RELEVANT):\n"
            f"- Past Themes: {themes}\n"
            f"- What Helped: {helped}\n"
            f"- Summary: {summary}\n"
        )

    saved_mem_prompt = ""
    if saved_memories:
        m_lines = []
        for m in saved_memories[:8]:
            cat = m.get("category", "fact")
            fct = m.get("fact", "")
            if fct:
                m_lines.append(f"- [{cat.capitalize()}] {fct}")
        if m_lines:
            saved_mem_prompt = (
                f"\nSAVED MEMORIES (REFERENCE NATURALLY WHEN GENUINELY RELEVANT, DO NOT RECITE ROBOTICALLY):\n"
                + "\n".join(m_lines) + "\n"
            )

    name_rule = ""
    if turns_since_name_used < 4:
        name_rule = (
            f"\nNAME USAGE MANDATE: You used the user's name recently. DO NOT mention their name '{user_name}' in this reply. "
            f"Address them warmly and directly without repeating their name.\n"
        )
    else:
        name_rule = (
            f"\nNAME USAGE: You may use their name '{user_name}' only if it feels exceptionally warm and natural, "
            f"otherwise speak to them directly without repeating their name.\n"
        )

    breathing_rule = ""
    if breathing_shown_recently:
        breathing_rule = (
            "\nEXERCISE SUGGESTION: A breathing exercise was shown in the last 4 turns. "
            "Do NOT suggest breathing again right now; keep suggest_tool as 'none' or 'grounding'/'journaling'.\n"
        )

    rolling_prompt = ""
    if rolling_summary:
        rolling_prompt = f"\nSUMMARY OF OLDER CONVERSATION TURNS:\n{rolling_summary}\n"

    return f"""You are MANAS, an emotionally intelligent, empathetic companion and digital mental twin.
You talk and think like an authentic close friend or trusted confidant who genuinely cares — NOT a textbook therapist, NOT an AI robot, and NOT a customer service agent.

CORE CONVERSATIONAL PRINCIPLES:
1. THINK ON YOUR OWN: Analyze what the user is experiencing in depth. Think for yourself and offer genuine perspective, heartfelt advice, and comforting presence just as a wise, loving close friend would in real life. Avoid formulaic therapy scripts or generic canned rules.
2. STRICT CLINICAL BOUNDARIES: Never diagnose any medical or mental health disorders. Never prescribe drugs or clinical treatments.
3. DEEP REFLECTION & EMPATHY: Directly mirror and validate the user's specific feelings and real situation before offering thoughts. If they are venting or overwhelmed, hold quiet space first. If they want guidance, offer clear, comforting perspective.
4. AUTHENTIC NATURAL SPOKEN LANGUAGE ({lang_label}): Speak fluently in the user's chosen language ({lang_label}). Everyday natural conversational style and colloquial code-mixing (such as Tanglish for Tamil, Hinglish for Hindi) are warmly embraced so it feels like talking to a real friend.
5. CONCISE & THOUGHTFUL: Exactly 2 to 4 gentle, impactful sentences. No bulleted essays or clinical lectures.
6. GENTLE INQUIRY: Ask at most ONE natural, open-hearted question to invite them to share if they feel comfortable.
7. NEVER REPEAT: Vary your opening lines and phrasing every single turn. Never repeat stock phrases like "I'm right here beside you" or previous answers.
8. VOICE STEP MANDATE (FOR NON-ENGLISH: ta, hi, te, ml, kn, bn, mr):
   - You MUST write 'speech_text' 100% in the chosen language and authentic native script in natural spoken (colloquial) style.
   - Transliterate all English loanwords into the native script (e.g. "stress" -> "ஸ்ட்ரெஸ்" in Tamil, "स्ट्रेस" in Hindi, "స్ట్రెస్" in Telugu, "സ്ട്രെസ്സ്" in Malayalam, "ಸ್ಟ್ರೆಸ್" in Kannada, "স্ট্রেস" in Bengali, "स्ट्रेस" in Marathi).
   - ZERO Latin letters, ZERO English phrases in 'speech_text' unless the user wrote them.
   - Keep 'reply' (display_text) as it is.
   - Set 'speech_metadata' with style "warm, gentle, friendly, slightly slow, like a close friend from {region}, calm and comforting" and language_code "{bcp47_code}".
{anti_repetition_prompt}{saved_mem_prompt}{memory_prompt}{rolling_prompt}{name_rule}{breathing_rule}
USER CONTEXT:
- Preferred Name: {user_name}
- Age: {age}
- Language: {lang_label} ({language} / {bcp47_code})
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
        saved_memories: Optional[List[Dict[str, Any]]] = None,
        turns_since_name_used: int = 5,
        breathing_shown_recently: bool = False,
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
            saved_memories=saved_memories,
            turns_since_name_used=turns_since_name_used,
            breathing_shown_recently=breathing_shown_recently,
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
                "thinkingConfig": {
                    "thinkingLevel": "LOW"
                }
            }
        }

        models_to_try = [self.get_model_name()] + [m for m in MODELS_CHAIN if m != self.get_model_name()]
        stream_succeeded = False

        for target_model in models_to_try:
            url = f"{self.base_url}/{target_model}:streamGenerateContent?key={self.api_key}&alt=sse"
            raw_accumulated = ""
            yielded_len = 0
            reply_started = False
            reply_finished = False

            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code != 200:
                            err_body = await response.aread()
                            err_str = err_body.decode(errors="ignore")
                            logger.warning(
                                "Gemini model %s returned status %d: %s. Trying next fallback model...",
                                target_model, response.status_code, err_str[:200]
                            )
                            # If thinkingConfig was rejected, remove it and retry this model once
                            if "thinkingConfig" in payload.get("generationConfig", {}) and ("thinking" in err_str.lower() or response.status_code == 400):
                                payload["generationConfig"].pop("thinkingConfig", None)
                            continue

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
                    json_match = re.search(r'\{[\s\S]*\}', raw_accumulated)
                    if json_match:
                        parsed_data = json.loads(json_match.group(0))
                except Exception as final_parse_err:
                    logger.warning("Failed to parse final JSON from Gemini: %s", final_parse_err)

                final_reply = parsed_data.get("reply")
                if not final_reply and raw_accumulated:
                    rep_match = re.search(r'"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', raw_accumulated)
                    if rep_match:
                        try:
                            final_reply = rep_match.group(1).encode('utf-8').decode('unicode_escape')
                        except Exception:
                            final_reply = rep_match.group(1)
                    else:
                        final_reply = raw_accumulated.strip()

                if final_reply:
                    final_emotion = parsed_data.get("emotion") if parsed_data.get("emotion") in ("calm", "empathetic", "encouraging", "concerned") else "calm"
                    final_tool = parsed_data.get("suggest_tool") if parsed_data.get("suggest_tool") in ("none", "breathing", "grounding", "music", "journaling") else "none"
                    final_quick = parsed_data.get("quick_replies") if isinstance(parsed_data.get("quick_replies"), list) else []
                    final_risk = parsed_data.get("risk_level") if parsed_data.get("risk_level") in ("none", "low", "medium", "high") else "none"

                    # Requirement 5: show breathing card only when suggested and not shown in the last 4 turns
                    if breathing_shown_recently and final_tool == "breathing":
                        final_tool = "none"

                    # Requirement 5: do not use user's name in every message (max once every ~5 turns)
                    if turns_since_name_used < 4 and user_name:
                        for prefix in [f"{user_name}, ", f"{user_name}! ", f"{user_name}. "]:
                            if final_reply.startswith(prefix):
                                final_reply = final_reply[len(prefix):].strip()
                                final_reply = final_reply[0].upper() + final_reply[1:] if final_reply else final_reply
                                break

                    yield ("meta", {
                        "reply": final_reply,
                        "emotion": final_emotion,
                        "suggest_tool": final_tool,
                        "quick_replies": final_quick[:3],
                        "risk_level": final_risk,
                        "is_error": False,
                    })
                    stream_succeeded = True
                    break
            except Exception as e:
                logger.warning("Model %s stream error: %s. Trying fallback...", target_model, e)
                continue

        if not stream_succeeded:
            logger.error("All Gemini streaming models exhausted or unavailable.")
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
