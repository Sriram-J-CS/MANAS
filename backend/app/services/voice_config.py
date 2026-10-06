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
from typing import Dict, List, Optional, Any

# Flag controlling legacy engine fallback: e.g. "en,hi" or empty for 100% Sarvam
LEGACY_TTS_FOR: List[str] = [
    lang.strip().lower()
    for lang in os.environ.get("LEGACY_TTS_FOR", "").split(",")
    if lang.strip()
]

# Tone filter rule: "companion" (filter tones strictly by companion girl/boy)
TONE_FILTER: str = os.environ.get("TONE_FILTER", "companion").lower()

# Default Sarvam Bulbul v3 speakers by language and gender
# Defaults specified:
# hi: priya/shubh, en: ishita/ratan, ta: ishita/ratan, te: priya/shubh,
# kn: ishita/shubh, ml: pooja/shubh, bn: roopa/rehan, mr: priya/ratan
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

# Full Sarvam Bulbul v3 Speaker Catalog by Gender & Quality Tiers
# From Sarvam documentation: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/how-to/change-the-speaker-voice.md
SARVAM_VOICE_CATALOG = {
    "female": [
        {"id": "priya",   "tier": 1, "cer": 0.13, "description": "Warm, highly natural, versatile"},
        {"id": "ishita",  "tier": 1, "cer": 0.13, "description": "Expressive, clear, friendly"},
        {"id": "roopa",   "tier": 2, "cer": 0.26, "description": "Gentle, soothing melodic tone"},
        {"id": "pooja",   "tier": 2, "cer": 0.30, "description": "Calm, empathetic, steady"},
        {"id": "suhani",  "tier": 3, "cer": 0.46, "description": "Soft, comforting, sweet"},
        {"id": "simran",  "tier": 3, "cer": 0.46, "description": "Bright, uplifting, youthful"},
        {"id": "shreya",  "tier": 3, "cer": 0.46, "description": "Reflective, warm, reassuring"},
        {"id": "neha",    "tier": 3, "cer": 0.53, "description": "Patient, gentle, peaceful"},
        {"id": "ritu",    "tier": 3, "cer": 0.53, "description": "Grounding, serene, friendly"},
        {"id": "rupali",  "tier": 3, "cer": 0.50, "description": "Crisp, reassuring, encouraging"},
    ],
    "male": [
        {"id": "mani",     "tier": 1, "cer": 0.00, "description": "Deep, clear, empathetic"},
        {"id": "shubh",    "tier": 2, "cer": 0.30, "description": "Calm, grounding, warm friend"},
        {"id": "ratan",    "tier": 2, "cer": 0.33, "description": "Steady, compassionate, elder brotherly"},
        {"id": "rehan",    "tier": 2, "cer": 0.33, "description": "Soft, understanding, thoughtful"},
        {"id": "sunny",    "tier": 2, "cer": 0.33, "description": "Bright, upbeat, supportive"},
        {"id": "ashutosh", "tier": 2, "cer": 0.40, "description": "Resonant, patient, reassuring"},
        {"id": "amit",     "tier": 2, "cer": 0.40, "description": "Friendly, approachable, steady"},
        {"id": "rahul",    "tier": 2, "cer": 0.40, "description": "Gentle, reflective, conversational"},
        {"id": "aditya",   "tier": 3, "cer": 0.46, "description": "Kind, peaceful, attentive"},
        {"id": "anand",    "tier": 3, "cer": 0.46, "description": "Mature, calm, dependable"},
        {"id": "kabir",    "tier": 3, "cer": 0.53, "description": "Warm, steady, comforting presence"},
        {"id": "dev",      "tier": 3, "cer": 0.60, "description": "Youthful, earnest, relatable"},
    ]
}

# Step 6 Voice Tones mapped to real Sarvam speakers per language
# Girl tones: Ananya (Warm & Empathetic), Diya (Gentle & Soft), Meera (Bright & Encouraging)
# Boy tones:  Aarav (Calm & Grounding), Kabir (Warm & Steady), Arjun (Soft & Friendly)
# Where a language has fewer unique suitable voices, only genuine unique voices are mapped (minimum 1).
VOICE_TONE_SPEAKER_MAP: Dict[str, Dict[str, Dict[str, Dict[str, str]]]] = {
    "en": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "priya",  "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "simran", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "amit",   "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "shubh",  "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "hi": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "suhani", "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "shreya", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",    "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ashutosh", "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "rahul",    "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "ta": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "ritu",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "priya",  "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "amit",   "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "te": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "neha",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "ishita", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
            "arjun":  {"speaker": "amit",   "label": "Arjun",  "style": "Soft & Friendly"},
        }
    },
    "kn": {
        "girl": {
            "ananya": {"speaker": "ishita", "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "neha",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "priya",  "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "ratan",  "label": "Kabir",  "style": "Warm & Steady"},
        }
    },
    "ml": {
        "girl": {
            "ananya": {"speaker": "pooja",  "label": "Ananya", "style": "Warm & Empathetic"},
        },
        "boy": {
            "aarav":  {"speaker": "shubh",  "label": "Aarav",  "style": "Calm & Grounding"},
        }
    },
    "bn": {
        "girl": {
            "ananya": {"speaker": "roopa",  "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "suhani", "label": "Diya",   "style": "Gentle & Soft"},
        },
        "boy": {
            "aarav":  {"speaker": "rehan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
        }
    },
    "mr": {
        "girl": {
            "ananya": {"speaker": "priya",  "label": "Ananya", "style": "Warm & Empathetic"},
            "diya":   {"speaker": "ritu",   "label": "Diya",   "style": "Gentle & Soft"},
            "meera":  {"speaker": "rupali", "label": "Meera",  "style": "Bright & Encouraging"},
        },
        "boy": {
            "aarav":  {"speaker": "ratan",  "label": "Aarav",  "style": "Calm & Grounding"},
            "kabir":  {"speaker": "shubh",  "label": "Kabir",  "style": "Warm & Steady"},
        }
    }
}

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
    Guarantees male companion gets male speaker, and female companion gets female speaker.
    """
    lang_code = normalize_lang_code(language)
    g_key = "boy" if (gender or "").lower() in ("boy", "male") else "girl"

    # If a specific tone was selected, look up that exact mapped speaker
    if tone:
        clean_tone = tone.lower().strip()
        lang_tones = VOICE_TONE_SPEAKER_MAP.get(lang_code, {}).get(g_key, {})
        if clean_tone in lang_tones:
            return lang_tones[clean_tone]["speaker"]

    # Fallback to the canonical default speaker for this language and gender
    mapping = SARVAM_DEFAULT_SPEAKERS.get(lang_code, SARVAM_DEFAULT_SPEAKERS["en"])
    return mapping.get(g_key, mapping["girl"])

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
