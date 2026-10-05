import os
import json
import logging
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("manas.llm")

from .gemini_provider import gemini, build_companion_system_prompt

def get_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""

async def generate_chat_response(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    role: str = "student",
    style_pref: str = "reflective",
    typing_cps: float = 0.0,
    history: Optional[list] = None,
    memories: Optional[list] = None,
    twin_context: Optional[dict] = None
) -> Dict[str, Any]:
    """
    Live LLM generation for MANAS companion using Gemini.
    No hard-coded replies or canned templates.
    On failure, returns friendly connection hiccup message.
    """
    if gemini.is_configured():
        final_meta = None
        async for kind, payload in gemini.stream_chat(
            message=message,
            user_name=user_name,
            language=language,
            companion_tone=style_pref,
            history_turns=history or [],
        ):
            if kind == "meta":
                final_meta = payload

        if final_meta and not final_meta.get("is_error"):
            reply = final_meta.get("reply", "Connection hiccup, please try again.")
            emotion = final_meta.get("emotion", "calm")
            tool = final_meta.get("suggest_tool", "none")
            quick_replies = final_meta.get("quick_replies", [])
            risk = final_meta.get("risk_level", "none")

            exercise = "none"
            if tool == "breathing":
                exercise = "breathing_4_7_8"
            elif tool == "grounding":
                exercise = "grounding_54321"

            return {
                "reply": reply,
                "spoken_text": reply,
                "emotion": emotion,
                "gesture": "nod",
                "expression": emotion,
                "risk_level": risk,
                "suggest_tool": tool,
                "quick_replies": quick_replies,
                "suggested_exercise": exercise,
                "provider": "google_gemini",
                "model": gemini.get_model_name(),
                "segments": [{
                    "spoken_text": reply,
                    "text": reply,
                    "emotion": emotion,
                    "gesture": "nod"
                }]
            }

    # Friendly connection hiccup message on failure — never canned therapy reply
    return {
        "reply": "Connection hiccup, please try again.",
        "spoken_text": "Connection hiccup, please try again.",
        "emotion": "calm",
        "gesture": "nod",
        "expression": "calm",
        "risk_level": "none",
        "suggest_tool": "none",
        "quick_replies": [],
        "suggested_exercise": "none",
        "is_error": True,
        "segments": [{
            "spoken_text": "Connection hiccup, please try again.",
            "text": "Connection hiccup, please try again.",
            "emotion": "calm",
            "gesture": "nod"
        }]
    }

async def gemini_health_check() -> Dict[str, Any]:
    """Check status of Gemini provider."""
    return await gemini.health_check()
