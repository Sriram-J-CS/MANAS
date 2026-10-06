"""
voice_config.py - Unified Voice & Speaker Configuration for Sarvam Bulbul v3
─────────────────────────────────────────────────────────────────────────────
All 8 Supported Indian Languages:
- en (en-IN) - English (India)
- hi (hi-IN) - Hindi
- ta (ta-IN) - Tamil
- te (te-IN) - Telugu
- kn (kn-IN) - Kannada
- ml (ml-IN) - Malayalam
- bn (bn-IN) - Bengali
- mr (mr-IN) - Marathi

Features:
- Full Sarvam Bulbul v3 speaker catalog mapped per language and companion gender.
- Defaults per user task specifications:
  hi: priya/shubh, en: ishita/ratan, ta: ishita/ratan, te: priya/shubh,
  kn: ishita/shubh, ml: pooja/shubh, bn: roopa/rehan, mr: priya/ratan.
- Step 6 Companion Voice Tones:
  Girl: Ananya, Diya, Meera
  Boy:  Aarav, Kabir, Arjun
- Fallback flag LEGACY_TTS_FOR (e.g. "en,hi") for A/B testing and legacy fallback.
- Tone filter rule flag TONE_FILTER ("companion" | "user").
"""

import os
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("manas.voice_config")

# Flag controlling legacy engine fallback: e.g. "en,hi" or empty for 100% Sarvam
LEGACY_TTS_FOR: List[str] = [
    lang.strip().lower()
    for lang in os.environ.get("LEGACY_TTS_FOR", "").split(",")
    if lang.strip()
]

# Tone filter rule: "companion" (filter tones strictly by companion girl/boy)
TONE_FILTER: str = os.environ.get("TONE_FILTER", "companion").lower()

# Strict sets of authorized Sarvam speakers per gender
MALE_SARVAM_SPEAKERS = {"shubh", "ratan", "rohan", "rehan"}
FEMALE_SARVAM_SPEAKERS = {"priya", "ishita", "ritu", "neha", "pooja", "roopa", "suhani"}

# Default Sarvam Bulbul v3 speakers by language and gender
SARVAM_DEFAULT_SPEAKERS: Dict[str, Dict[str, str]] = {
    "en": {"girl": "ishita", "boy": "ratan", "female": "ishita", "male": "ratan"},
    "hi": {"girl": "priya",  "boy": "shubh", "female": "priya",  "male": "shubh"},
    "ta": {"girl": "ishita", "boy": "ratan", "female": "ishita", "male": "ratan"},
    "te": {"girl": "priya",  "boy": "shubh", "female": "priya",  "male": "shubh"},
    "kn": {"girl": "ishita", "boy": "shubh", "female": "ishita", "male": "shubh"},
    "ml": {"girl": "pooja",  "boy": "shubh", "female": "pooja",  "male": "shubh"},
    "bn": {"girl": "roopa",  "boy": "rehan", "female": "roopa",  "male": "rehan"},
    "mr": {"girl": "priya",  "boy": "ratan", "female": "priya",  "male": "ratan"},
}

SARVAM_VOICE_CATALOG = {
    "female": [
        {"id": "priya",   "tier": 1, "cer": 0.13, "description": "Warm, highly natural, versatile"},
        {"id": "ishita",  "tier": 1, "cer": 0.13, "description": "Expressive, clear, friendly"},
        {"id": "roopa",   "tier": 2, "cer": 0.26, "description": "Gentle, soothing melodic tone"},
        {"id": "pooja",   "tier": 2, "cer": 0.30, "description": "Calm, empathetic, steady"},
        {"id": "suhani",  "tier": 3, "cer": 0.46, "description": "Soft, comforting, sweet"},
        {"id": "neha",    "tier": 3, "cer": 0.53, "description": "Patient, gentle, peaceful"},
        {"id": "ritu",    "tier": 3, "cer": 0.53, "description": "Grounding, serene, friendly"},
    ],
    "male": [
        {"id": "shubh",    "tier": 2, "cer": 0.30, "description": "Calm, grounding, warm friend"},
        {"id": "ratan",    "tier": 2, "cer": 0.33, "description": "Steady, compassionate, elder brotherly"},
        {"id": "rohan",    "tier": 2, "cer": 0.33, "description": "Conversational, approachable, clear"},
        {"id": "rehan",    "tier": 2, "cer": 0.33, "description": "Soft, understanding, thoughtful"},
    ]
}

# Voice Tones mapped strictly to real Sarvam speakers per language:
# Girl tones: Ananya (Warm & Caring), Diya (Gentle & Soft), Meera (Bright & Encouraging)
# Boy tones:  Aarav (Calm & Grounding), Kabir (Warm & Steady), Arjun (Soft & Friendly)
VOICE_TONE_SPEAKER_MAP: Dict[str, Dict[str, Dict[str, Dict[str, str]]]] = {
    "en": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "priya",  "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "suhani", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rohan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "hi": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "suhani", "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "ritu",   "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rohan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "ta": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "ritu",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "priya",  "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rehan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "te": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "neha",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "ishita", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rohan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "kn": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "neha",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "priya",  "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rehan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "ml": {
        "girl": {
            "ananya": {"speaker": "pooja",  "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "priya",  "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "suhani", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rehan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "bn": {
        "girl": {
            "ananya": {"speaker": "roopa",  "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "suhani", "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "priya",  "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "rehan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "ratan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "mr": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Caring"},
            "diya":   {"speaker": "ritu",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "neha",   "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rohan",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    }
}

# Speaking tone to TTS pace mapping per specification:
# Calm/Gentle 0.92, Warm/Casual 1.0, Encouraging 1.05, Direct 1.0
SPEAKING_TONE_PACE: Dict[str, float] = {
    "warm & caring": 1.0,
    "warm": 1.0,
    "calm & grounding": 0.92,
    "calm": 0.92,
    "gentle & soft": 0.92,
    "gentle": 0.92,
    "friendly & casual": 1.0,
    "casual": 1.0,
    "encouraging & motivating": 1.05,
    "encouraging": 1.05,
    "direct & practical": 1.0,
    "direct": 1.0,
}

def get_tone_pace(tone_or_style: Optional[str]) -> float:
    if not tone_or_style:
        return 1.0
    clean = tone_or_style.strip().lower()
    return SPEAKING_TONE_PACE.get(clean, 1.0)

SARVAM_CONFIG = {
    "model": "bulbul:v3",
    "pace": 0.92,
    "default_pace": 1.0,
    "calming_pace": 0.95,
    "max_chars_per_chunk": 2500,
    "timeout_seconds": 6.0,
    "api_endpoint": "https://api.sarvam.ai/text-to-speech"
}

SARVAM_NATIVE_VOICE_MAP: Dict[str, Dict[str, str]] = {
    "ta": {"girl": "ishita", "boy": "ratan", "female": "ishita", "male": "ratan"},
    "te": {"girl": "priya", "boy": "shubh", "female": "priya", "male": "shubh"},
    "kn": {"girl": "ishita", "boy": "shubh", "female": "ishita", "male": "shubh"},
    "ml": {"girl": "pooja", "boy": "shubh", "female": "pooja", "male": "shubh"},
    "bn": {"girl": "roopa", "boy": "rehan", "female": "roopa", "male": "rehan"},
    "mr": {"girl": "priya", "boy": "ratan", "female": "priya", "male": "ratan"},
}

CHIRP3_FALLBACK_VOICE_MAP: Dict[str, Dict[str, str]] = {
    "ta-IN": {"girl": "ta-IN-Chirp3-HD-F", "boy": "ta-IN-Chirp3-HD-M", "female": "ta-IN-Chirp3-HD-F", "male": "ta-IN-Chirp3-HD-M"},
    "te-IN": {"girl": "te-IN-Chirp3-HD-F", "boy": "te-IN-Chirp3-HD-M", "female": "te-IN-Chirp3-HD-F", "male": "te-IN-Chirp3-HD-M"},
    "kn-IN": {"girl": "kn-IN-Chirp3-HD-F", "boy": "kn-IN-Chirp3-HD-M", "female": "kn-IN-Chirp3-HD-F", "male": "kn-IN-Chirp3-HD-M"},
    "ml-IN": {"girl": "ml-IN-Chirp3-HD-F", "boy": "ml-IN-Chirp3-HD-M", "female": "ml-IN-Chirp3-HD-F", "male": "ml-IN-Chirp3-HD-M"},
    "bn-IN": {"girl": "bn-IN-Chirp3-HD-F", "boy": "bn-IN-Chirp3-HD-M", "female": "bn-IN-Chirp3-HD-F", "male": "bn-IN-Chirp3-HD-M"},
    "mr-IN": {"girl": "mr-IN-Chirp3-HD-F", "boy": "mr-IN-Chirp3-HD-M", "female": "mr-IN-Chirp3-HD-F", "male": "mr-IN-Chirp3-HD-M"},
    "hi-IN": {"girl": "hi-IN-Chirp3-HD-F", "boy": "hi-IN-Chirp3-HD-M", "female": "hi-IN-Chirp3-HD-F", "male": "hi-IN-Chirp3-HD-M"},
    "en-IN": {"girl": "en-IN-Chirp3-HD-F", "boy": "en-IN-Chirp3-HD-M", "female": "en-IN-Chirp3-HD-F", "male": "en-IN-Chirp3-HD-M"},
}

def get_chirp3_fallback_voice(lang: str, gender: str = "girl") -> str:
    bcp = lang if "-IN" in lang else f"{lang}-IN"
    g_key = "boy" if (gender or "").lower() in ("boy", "male") else "girl"
    if bcp in CHIRP3_FALLBACK_VOICE_MAP:
        return CHIRP3_FALLBACK_VOICE_MAP[bcp][g_key]
    return f"{bcp}-Chirp3-HD-{'M' if g_key == 'boy' else 'F'}"

ALL_SUPPORTED_LANGUAGES = {"en", "hi", "ta", "te", "kn", "ml", "bn", "mr"}

def normalize_lang_code(language: str) -> str:
    """Normalizes input language to 2-letter base code."""
    if not language:
        return "en"
    clean = language.strip().lower().split("-")[0]
    return clean if clean in ALL_SUPPORTED_LANGUAGES else "en"

def should_use_legacy_tts(language: str) -> bool:
    """Checks whether the requested language is flagged to use legacy TTS fallback."""
    lang_code = normalize_lang_code(language)
    return lang_code in LEGACY_TTS_FOR

def get_sarvam_speaker(language: str, gender: str = "girl", tone: Optional[str] = None) -> str:
    """
    Resolves the exact Sarvam speaker by language, companion gender (boy/girl), and optional tone.
    Strictly guarantees:
    - Male companion NEVER resolves to a female speaker.
    - Female companion NEVER resolves to a male speaker.
    - If a tone has no speaker for that language, falls back to another speaker of the SAME gender, and logs it.
    """
    lang_code = normalize_lang_code(language)
    is_boy = (gender or "").lower() in ("boy", "male")
    g_key = "boy" if is_boy else "girl"
    valid_gender_set = MALE_SARVAM_SPEAKERS if is_boy else FEMALE_SARVAM_SPEAKERS

    # Canonical default for fallback
    mapping = SARVAM_DEFAULT_SPEAKERS.get(lang_code, SARVAM_DEFAULT_SPEAKERS["en"])
    default_speaker = mapping.get(g_key, "ratan" if is_boy else "ishita")

    # If a specific tone was selected, look up that exact mapped speaker
    if tone:
        clean_tone = tone.lower().strip()
        lang_tones = VOICE_TONE_SPEAKER_MAP.get(lang_code, {}).get(g_key, {})
        if clean_tone in lang_tones:
            candidate = lang_tones[clean_tone]["speaker"]
            if candidate in valid_gender_set:
                return candidate
            else:
                logger.warning(
                    "[SPEAKER GENDER MISMATCH] Tone '%s' in '%s' resolved to '%s' which is not in %s set! Falling back to '%s'",
                    clean_tone, lang_code, candidate, g_key, default_speaker
                )
        else:
            logger.warning(
                "[SPEAKER RESOLUTION FALLBACK] No speaker for tone '%s' in lang '%s' (gender '%s'); falling back to same-gender default '%s'",
                clean_tone, lang_code, g_key, default_speaker
            )

    return default_speaker

def get_tones_for_companion(language: str, companion: str = "girl") -> List[Dict[str, str]]:
    """
    Returns only valid voice tone cards for the chosen companion in the specified language.
    Never returns male voices to a girl companion or female voices to a boy companion.
    """
    lang_code = normalize_lang_code(language)
    g_key = "boy" if (companion or "").lower() in ("boy", "male") else "girl"
    tones_dict = VOICE_TONE_SPEAKER_MAP.get(lang_code, {}).get(g_key, {})

    result = []
    for tone_id, info in tones_dict.items():
        result.append({
            "id": tone_id,
            "name": info["label"],
            "style": info["style"],
            "speaker": info["speaker"],
            "gender": g_key
        })
    return result

def is_native_6_language(language: str) -> bool:
    """Kept for backward compatibility."""
    lang_code = normalize_lang_code(language)
    return lang_code in {"ta", "te", "kn", "ml", "bn", "mr"}
