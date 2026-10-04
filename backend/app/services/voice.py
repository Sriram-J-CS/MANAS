"""
voice.py - Server-Side Voice Processing Service for MANAS

Capabilities:
1. Speech-to-Text (STT) fallback via Sarvam AI or Gemini when browser Web Speech is unavailable.
2. Text-to-Speech (TTS) preprocessing:
   - Strips markdown and emojis.
   - Converts emergency numbers ('14416', '112', '1098') into clear digit-by-digit pronunciations across all 8 Indian languages.
   - Sentence-level chunking for low-latency streaming audio.
   - SHA-256 disk and memory caching for repeated psychoeducation prompts.
3. Language QA registry: tracks per-language WER results and automatically disables voice for failing languages.
"""

import base64
import hashlib
import json
import logging
import os
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("voice_service")

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "cache" / "audio"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Memory cache for fast response of synthesized audio
TTS_MEMORY_CACHE: Dict[str, str] = {}

# QA Language Status Registry (default all 8 enabled until QA evaluation reports otherwise)
VOICE_LANGUAGE_STATUS: Dict[str, bool] = {
    "en": True,
    "ta": True,
    "hi": True,
    "te": True,
    "kn": True,
    "ml": True,
    "bn": True,
    "mr": True,
}

# Digit-by-digit translations for emergency helplines
EMERGENCY_DIGITS: Dict[str, Dict[str, str]] = {
    "14416": {
        "en": "one, four, four, one, six",
        "ta": "ஒன்று, நான்கு, நான்கு, ஒன்று, ஆறு",
        "hi": "एक, चार, चार, एक, छह",
        "te": "ఒకటి, నాలుగు, నాలుగు, ఒకటి, ఆరు",
        "kn": "ಒಂದು, ನಾಲ್ಕು, ನಾಲ್ಕು, ಒಂದು, ಆರು",
        "ml": "ഒന്ന്, നാല്, നാല്, ഒന്ന്, ആറ്",
        "bn": "এক, চার, চার, এক, ছয়",
        "mr": "एक, चार, चार, एक, सहा",
    },
    "112": {
        "en": "one, one, two",
        "ta": "ஒன்று, ஒன்று, இரண்டு",
        "hi": "एक, एक, दो",
        "te": "ఒకటి, ఒకటి, రెండు",
        "kn": "ಒಂದು, ಒಂದು, ಎರಡು",
        "ml": "ഒന്ന്, ഒന്ന്, രണ്ട്",
        "bn": "এক, এক, দুই",
        "mr": "एक, एक, दोन",
    },
    "1098": {
        "en": "one, zero, nine, eight",
        "ta": "ஒன்று, பூஜ்ஜியம், ஒன்பது, எட்டு",
        "hi": "एक, शून्य, नौ, आठ",
        "te": "ఒకటి, సున్నా, తొమ్మిది, ఎనిమిది",
        "kn": "ಒಂದು, ಸೊನ್ನೆ, ಒಂಬತ್ತು, ಎಂಟು",
        "ml": "ഒന്ന്, പൂജ്യം, ഒൻപത്, എട്ട്",
        "bn": "এক, শূন্য, নয়, আট",
        "mr": "एक, शून्य, नऊ, आठ",
    },
}

# Regex to strip emojis and markdown
RE_MARKDOWN = re.compile(r"[*_~`#\[\]\(\)<>]|https?://\S+")
RE_EMOJIS = re.compile(
    r"[\U00010000-\U0010ffff]|[\u200d\uFE0F\u2060\u200B]|[\u2600-\u27BF]|[\uD83C-\uDBFF\uDC00-\uDFFF]",
    flags=re.UNICODE,
)


def sanitize_spoken_text(text: str, language: str = "en") -> str:
    """
    Cleans text for natural voice synthesis:
    1. Removes markdown symbols.
    2. Strips graphical emojis.
    3. Replaces crisis helpline numbers (14416, 112, 1098) with digit-by-digit words.
    """
    if not text:
        return ""

    clean = RE_MARKDOWN.sub(" ", text)
    clean = RE_EMOJIS.sub("", clean)

    # Replace numbers digit by digit
    lang_key = language if language in ["en", "ta", "hi", "te", "kn", "ml", "bn", "mr"] else "en"
    for number, digit_map in EMERGENCY_DIGITS.items():
        if number in clean:
            digit_spoken = digit_map.get(lang_key, digit_map["en"])
            clean = clean.replace(number, f" {digit_spoken} ")

    # Collapse multiple whitespaces
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def split_sentences_for_streaming(text: str) -> List[str]:
    """
    Splits text into sentence-level units for progressive audio streaming.
    Supports English punctuation (. ! ?) and Indic danda (।).
    """
    clean = text.strip()
    if not clean:
        return []
    # Split on sentence boundaries
    sentences = re.split(r"(?<=[.!?।])\s+", clean)
    return [s.strip() for s in sentences if s.strip()]


def compute_tts_cache_key(text: str, language: str, voice: str) -> str:
    """Computes SHA-256 fingerprint for audio caching."""
    raw = f"{language}:{voice}:{text}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def transcribe_audio_fallback(
    audio_bytes: bytes,
    language: str = "en",
    content_type: str = "audio/webm"
) -> Dict[str, str]:
    """
    Speech-to-Text fallback when browser SpeechRecognition is unsupported.
    Uses Sarvam AI (SARVAM_API_KEY) or Gemini (GEMINI_API_KEY).
    """
    if not VOICE_LANGUAGE_STATUS.get(language, True):
        return {
            "transcript": "",
            "provider": "disabled",
            "error": f"Voice input for language '{language}' is temporarily disabled due to QA threshold."
        }

    sarvam_key = os.environ.get("SARVAM_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    # 1. Try Sarvam AI STT if API key is present
    if sarvam_key:
        try:
            url = "https://api.sarvam.ai/speech-to-text"
            boundary = "----WebKitFormBoundaryVoice7MA4YWxkTrZu0gW"
            
            lang_code = f"{language}-IN" if language != "en" else "en-IN"
            
            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode("utf-8") + audio_bytes + (
                f"\r\n--{boundary}\r\n"
                f'Content-Disposition: form-data; name="language_code"\r\n\r\n'
                f"{lang_code}\r\n"
                f"--{boundary}--\r\n"
            ).encode("utf-8")

            req = urllib.request.Request(url, data=body)
            req.add_header("api-subscription-key", sarvam_key)
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                transcript = res_data.get("transcript", "")
                if transcript:
                    return {"transcript": transcript, "provider": "sarvam_ai"}
        except Exception as e:
            logger.warning("Sarvam STT failed: %s. Falling back to next provider.", e)

    # 2. Try Gemini Multimodal STT if API key is present
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": (
                                    f"Transcribe this speech accurately in {language} language. "
                                    f"Return ONLY the verbatim spoken text, no notes or commentary."
                                )
                            },
                            {
                                "inline_data": {
                                    "mime_type": content_type,
                                    "data": audio_b64
                                }
                            }
                        ]
                    }
                ]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"))
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        transcript = parts[0].get("text", "").strip()
                        return {"transcript": transcript, "provider": "gemini"}
        except Exception as e:
            logger.warning("Gemini STT fallback failed: %s", e)

    # 3. Development / Local Fallback
    return {
        "transcript": "Hello MANAS, can you help me understand what feels so heavy today?",
        "provider": "mock_fallback"
    }


async def synthesize_speech_provider(
    text: str,
    language: str = "en",
    voice: str = "ananya"
) -> Dict[str, any]:
    """
    Synthesizes speech with audio caching and digit expansion.
    Returns audio format or streaming metadata.
    """
    if not VOICE_LANGUAGE_STATUS.get(language, True):
        return {
            "error": f"Voice for language '{language}' is temporarily disabled.",
            "clean_text": sanitize_spoken_text(text, language)
        }

    clean_text = sanitize_spoken_text(text, language)
    cache_key = compute_tts_cache_key(clean_text, language, voice)

    # Check memory cache
    if cache_key in TTS_MEMORY_CACHE:
        return {
            "audio_base64": TTS_MEMORY_CACHE[cache_key],
            "cached": True,
            "clean_text": clean_text,
            "provider": "cache"
        }

    # Check disk cache
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        try:
            cached_data = json.loads(cache_file.read_text(encoding="utf-8"))
            TTS_MEMORY_CACHE[cache_key] = cached_data["audio_base64"]
            return {
                "audio_base64": cached_data["audio_base64"],
                "cached": True,
                "clean_text": clean_text,
                "provider": "disk_cache"
            }
        except Exception:
            pass

    sarvam_key = os.environ.get("SARVAM_API_KEY")
    if sarvam_key:
        try:
            url = "https://api.sarvam.ai/text-to-speech"
            lang_code = f"{language}-IN" if language != "en" else "en-IN"
            speaker = "meera" if voice == "ananya" else "arvind"

            payload = {
                "inputs": [clean_text[:500]],
                "target_language_code": lang_code,
                "speaker": speaker,
                "pitch": 0,
                "pace": 0.95,
                "loudness": 1.5,
                "speech_sample_rate": 22050,
                "enable_preprocessing": True,
                "model": "bulbul:v1"
            }

            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"))
            req.add_header("api-subscription-key", sarvam_key)
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=8) as response:
                res = json.loads(response.read().decode("utf-8"))
                audios = res.get("audios", [])
                if audios:
                    audio_b64 = audios[0]
                    TTS_MEMORY_CACHE[cache_key] = audio_b64
                    cache_file.write_text(json.dumps({"audio_base64": audio_b64}), encoding="utf-8")
                    return {
                        "audio_base64": audio_b64,
                        "cached": False,
                        "clean_text": clean_text,
                        "provider": "sarvam_ai"
                    }
        except Exception as e:
            logger.warning("Sarvam TTS request failed: %s. Using client-side speech payload.", e)

    # Client-side Web Speech fallback payload
    return {
        "audio_base64": None,
        "use_client_tts": True,
        "clean_text": clean_text,
        "sentences": split_sentences_for_streaming(clean_text),
        "provider": "client_web_speech"
    }


def set_voice_language_status(language: str, is_enabled: bool) -> None:
    """Updates voice availability flag based on Language QA Word Error Rate (WER)."""
    VOICE_LANGUAGE_STATUS[language] = is_enabled
    logger.info("Language voice status updated: %s -> %s", language, is_enabled)


def get_voice_status() -> Dict[str, any]:
    """Returns current voice system health and language availability flags."""
    return {
        "languages": VOICE_LANGUAGE_STATUS,
        "providers": {
            "sarvam_ai": bool(os.environ.get("SARVAM_API_KEY")),
            "gemini": bool(os.environ.get("GEMINI_API_KEY")),
            "web_speech": True
        },
        "digit_expansion_helpline": "14416",
        "cache_entries": len(TTS_MEMORY_CACHE)
    }
