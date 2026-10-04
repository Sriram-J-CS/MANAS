"""
gemini_provider.py - Production-Grade Google Gemini Provider for EmotiCare AI / MANAS
──────────────────────────────────────────────────────────────────────────────────
Centralized provider abstraction handling:
1. Environment-driven configuration (GEMINI_MODEL, GEMINI_API_KEY).
2. Official model fallback chain (gemini-1.5-flash -> gemini-2.0-flash -> gemini-1.5-pro).
3. Structured context separation (system instructions, persona, language, history, memory, twin).
4. Synchronous & asynchronous generate(), stream(), and health_check().
5. Zero client-side API key leakage.
6. Robust failure handling (timeouts, quota, safety blocks, malformed payloads).
"""

import os
import re
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("manas.gemini_provider")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-pro-latest"
]
# Deduplicate preserving order
MODELS_CHAIN = list(dict.fromkeys(FALLBACK_MODELS))


class GeminiProvider:
    """Production provider interface for Google Gemini API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def is_configured(self) -> bool:
        """Returns True if a valid API key is present."""
        return bool(self.api_key and len(self.api_key.strip()) > 15)

    async def health_check(self) -> Dict[str, Any]:
        """
        Server-side health check verifying API connectivity and model availability.
        Never exposes the actual API key.
        """
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "provider": "google_gemini",
                "message": "Gemini API key is not configured in environment.",
                "model": DEFAULT_MODEL
            }

        last_err = None
        for m in MODELS_CHAIN:
            url = f"{self.base_url}/{m}:generateContent?key={self.api_key}"
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
                            "model": m,
                            "latency_ms": round(res.elapsed.total_seconds() * 1000)
                        }
                    elif res.status_code == 429:
                        last_err = "rate_limited"
                    else:
                        last_err = f"http_{res.status_code}"
            except Exception as e:
                last_err = str(e)
                continue

        return {
            "status": "rate_limited" if last_err == "rate_limited" else "degraded",
            "provider": "google_gemini",
            "active_fallback": "dynamic_local_engine",
            "last_signal": last_err
        }

    def build_structured_prompt(
        self,
        message: str,
        user_name: str = "Friend",
        language: str = "en",
        role: str = "student",
        style_pref: str = "reflective",
        history: Optional[List[Dict[str, str]]] = None,
        memories: Optional[List[str]] = None,
        twin_context: Optional[Dict[str, Any]] = None,
        typing_cps: float = 0.0,
    ) -> str:
        """
        Constructs clean, structured context without massive generic prompt clutter.
        Separates:
        - SYSTEM INSTRUCTIONS (Companion persona, tone, rules, non-clinical)
        - RELEVANT USER CONTEXT (Name, role, language)
        - PERMITTED MEMORIES & DIGITAL TWIN BASELINE
        - CONVERSATION HISTORY (Recent turns only)
        - CURRENT MESSAGE
        """
        # Typing cadence context
        cadence_str = "normal pace"
        if typing_cps > 32.0:
            cadence_str = "fast cadence (>30 cps) - thoughts racing, possible anxiety, speak gently with steady grounding"
        elif 0.0 < typing_cps < 12.0:
            cadence_str = "slow cadence (<12 cps) - vulnerable, fatigue or hesitation, acknowledge effort gently"

        lang_map = {
            "ta": "Tamil (தமிழ்)",
            "hi": "Hindi (हिंदी)",
            "te": "Telugu (తెలుగు)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "ml": "Malayalam (മലയാളം)",
            "bn": "Bengali (বাংলা)",
            "mr": "Marathi (मराठी)",
            "en": "English",
        }
        chosen_lang_label = lang_map.get(language, language)

        system_block = (
            "You are MANAS, a personal emotional wellness companion and digital mental twin.\n"
            "You speak as the user's calm, wise, caring inner reflection.\n"
            "\n"
            "COMMUNICATION RULES:\n"
            "1. Be natural, thoughtful, human, and grounded. Never sound like a generic customer bot or ChatGPT.\n"
            "2. Never use generic AI clichés ('As an AI...', 'I am an AI assistant...', 'I am here for you' in every reply).\n"
            "3. Address their specific situation directly. If they ask for study/sleep/relationship guidance, give concrete practical thoughts.\n"
            "4. NON-CLINICAL GUARANTEE: Never diagnose illnesses, never prescribe medications, never encourage self-harm.\n"
            f"5. CHOSEN LANGUAGE MANDATE: The user has selected {chosen_lang_label} ({language}). "
            f"You MUST answer ALL questions and generate both 'reply' and 'spoken_text' 100% in {chosen_lang_label} using proper authentic native script. "
            "Even if the user writes in English or Romanized characters, you MUST reply entirely in their chosen language.\n"
            "6. Keep replies focused: 2 to 4 supportive, clear sentences."
        )

        context_parts = [system_block, f"\nUSER IDENTITY:\n- Name: {user_name}\n- Selected Language: {chosen_lang_label} ({language})\n- Tone: {style_pref}\n- Typing Cadence: {cadence_str}"]

        if memories:
            mem_lines = "\n".join(f"- {m}" for m in memories[:5])
            context_parts.append(f"\nRELEVANT PERSONAL MEMORIES (User-Authorized):\n{mem_lines}")

        if twin_context:
            mood_b = twin_context.get("mood_baseline", "Establishing")
            trend = twin_context.get("trend", "stable")
            context_parts.append(f"\nDIGITAL TWIN BASELINE:\n- Mood Baseline: {mood_b}\n- Trend: {trend}")

        if history:
            hist_parts = []
            for h in history[-6:]:  # Last 6 messages max for tight, relevant short-term context
                sender = h.get("sender", "user")
                text = h.get("text", "")
                if text:
                    hist_parts.append(f"{sender.capitalize()}: {text}")
            if hist_parts:
                context_parts.append("\nRECENT CONVERSATION:\n" + "\n".join(hist_parts))

        context_parts.append(f"\nCURRENT MESSAGE:\nUser: {message}")
        context_parts.append(
            "\nRESPONSE FORMAT:\n"
            "Return a valid JSON object ONLY:\n"
            "{\n"
            '  "reply": "Conversational reply (2-4 gentle, clear sentences)",\n'
            '  "spoken_text": "Clean version for TTS voice synthesis (no emojis or symbols)",\n'
            '  "emotion": "calm" | "concerned" | "happy" | "sad" | "supportive" | "thoughtful",\n'
            '  "gesture": "nod" | "breathe" | "listening" | "encourage",\n'
            '  "expression": "neutral" | "happy" | "concerned" | "calm"\n'
            "}"
        )

        return "\n".join(context_parts)

    async def generate(
        self,
        message: str,
        user_name: str = "Friend",
        language: str = "en",
        role: str = "student",
        style_pref: str = "reflective",
        history: Optional[List[Dict[str, str]]] = None,
        memories: Optional[List[str]] = None,
        twin_context: Optional[Dict[str, Any]] = None,
        typing_cps: float = 0.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Executes generation against Gemini with fallback across candidate models.
        Returns parsed JSON response or None if all models fail.
        """
        if not self.is_configured():
            return None

        prompt = self.build_structured_prompt(
            message=message,
            user_name=user_name,
            language=language,
            role=role,
            style_pref=style_pref,
            history=history,
            memories=memories,
            twin_context=twin_context,
            typing_cps=typing_cps,
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.65,
                "maxOutputTokens": 450,
            }
        }

        for model_name in MODELS_CHAIN:
            url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=9.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            continue

                        parts = candidates[0].get("content", {}).get("parts", [])
                        raw_text = ""
                        for p in parts:
                            if "text" in p and p["text"]:
                                raw_text = p["text"].strip()
                                break

                        if not raw_text:
                            continue

                        # Extract JSON
                        parsed = None
                        match = re.search(r"\{[\s\S]*\}", raw_text)
                        if match:
                            try:
                                parsed = json.loads(match.group(0), strict=False)
                            except Exception:
                                pass

                        if parsed and isinstance(parsed, dict) and parsed.get("reply"):
                            reply = parsed["reply"].strip()
                            spoken = parsed.get("spoken_text") or reply
                            emotion = parsed.get("emotion", "calm")
                            gesture = parsed.get("gesture", "nod")
                            expression = parsed.get("expression", "calm")

                            return {
                                "reply": reply,
                                "spoken_text": spoken,
                                "emotion": emotion,
                                "gesture": gesture,
                                "expression": expression,
                                "provider": "google_gemini",
                                "model": model_name
                            }
                        elif raw_text:
                            # Clean markdown if JSON parser missed
                            clean_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.IGNORECASE)
                            return {
                                "reply": clean_text,
                                "spoken_text": clean_text,
                                "emotion": "calm",
                                "gesture": "nod",
                                "expression": "calm",
                                "provider": "google_gemini",
                                "model": model_name
                            }
            except Exception as e:
                logger.warning("Gemini attempt on %s failed: %s", model_name, e)
                continue

        return None

    async def stream(
        self,
        message: str,
        user_name: str = "Friend",
        language: str = "en",
        role: str = "student",
        style_pref: str = "reflective",
        history: Optional[List[Dict[str, str]]] = None,
        memories: Optional[List[str]] = None,
        twin_context: Optional[Dict[str, Any]] = None,
        typing_cps: float = 0.0,
    ) -> AsyncGenerator[str, None]:
        """
        Streams response tokens/chunks from Gemini via Server-Sent Events stream endpoint.
        """
        if not self.is_configured():
            yield "MANAS intelligence is currently in local offline mode."
            return

        prompt = self.build_structured_prompt(
            message=message,
            user_name=user_name,
            language=language,
            role=role,
            style_pref=style_pref,
            history=history,
            memories=memories,
            twin_context=twin_context,
            typing_cps=typing_cps,
        )

        url = f"{self.base_url}/{DEFAULT_MODEL}:streamGenerateContent?key={self.api_key}&alt=sse"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.65,
                "maxOutputTokens": 450,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw_chunk = line[6:].strip()
                            if raw_chunk == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(raw_chunk)
                                candidates = chunk_json.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for p in parts:
                                        if "text" in p:
                                            yield p["text"]
                            except Exception:
                                continue
        except Exception as e:
            logger.warning("Gemini stream error: %s", e)
            yield " I am right here with you. Take a steady breath."


# Global singleton instance
gemini = GeminiProvider()
