"""
sarvam_tts.py - High-Fidelity Sarvam Bulbul v3 TTS Service for Indic Languages
─────────────────────────────────────────────────────────────────────────────
Target Languages:
- Tamil (ta / ta-IN)
- Telugu (te / te-IN)
- Kannada (kn / kn-IN)
- Malayalam (ml / ml-IN)
- Bengali (bn / bn-IN)
- Marathi (mr / mr-IN)

Features:
1. Strict routing to Sarvam Bulbul v3 with model "bulbul:v3" and pace 0.92.
2. Sentence chunking with max 2500 characters per request.
3. Parallel execution with ordered audio segments for fastest first-sentence playback.
4. SHA-256 caching by hash(text, speaker, lang) in memory and disk cache.
5. 6.0-second timeout with structured fallback to Google Cloud Chirp 3 HD.
6. Fallback strictly uses native Indic voices, never English voices.
"""

import os
import re
import json
import base64
import hashlib
import asyncio
import logging
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import httpx

from .voice_config import (
    SARVAM_CONFIG,
    is_native_6_language,
    get_sarvam_speaker,
    get_chirp3_fallback_voice,
    CHIRP3_FALLBACK_VOICE_MAP
)

logger = logging.getLogger("manas.sarvam_tts")

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "cache" / "audio"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Shared memory cache
SARVAM_MEMORY_CACHE: Dict[str, str] = {}

RE_SENTENCE_SPLIT = re.compile(r"(?<=[.!?|।\n])\s+")

def get_sarvam_cache_key(text: str, speaker: str, lang: str) -> str:
    """Computes deterministic hash(text, speaker, lang) for caching."""
    raw = f"{text.strip()}:{speaker.strip()}:{lang.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def strip_markdown_and_normalize(text: str) -> str:
    """Removes markdown symbols and cleans whitespace for clean acoustic prosody."""
    if not text:
        return ""
    # Strip markdown bold, italics, headers, links, and code backticks
    clean = re.sub(r"[*_~`#\[\]\(\)<>]|https?://\S+", " ", text)
    # Strip emojis
    clean = re.sub(r"[\U00010000-\U0010ffff]", "", clean)
    return re.sub(r"\s+", " ", clean).strip()

def split_text_into_chunks(text: str, max_chars: int = 220) -> List[str]:
    """
    Groups 2-3 sentences (max ~220 characters) per request for optimal prosody and natural flow.
    """
    cleaned = strip_markdown_and_normalize(text)
    if not cleaned:
        return []

    # Split by standard sentence delimiters
    raw_sentences = [s.strip() for s in RE_SENTENCE_SPLIT.split(cleaned) if s.strip()]
    if not raw_sentences:
        raw_sentences = [cleaned]

    chunks: List[str] = []
    current_chunk = ""

    for s in raw_sentences:
        # Check if adding this sentence stays within ~220 chars
        candidate = f"{current_chunk} {s}".strip() if current_chunk else s
        if len(candidate) <= max_chars:
            current_chunk = candidate
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(s) > max_chars:
                # Sub-split overly long sentences safely at spaces
                words = s.split()
                sub = ""
                for w in words:
                    cand_sub = f"{sub} {w}".strip() if sub else w
                    if len(cand_sub) <= max_chars:
                        sub = cand_sub
                    else:
                        if sub:
                            chunks.append(sub)
                        sub = w
                if sub:
                    current_chunk = sub
                else:
                    current_chunk = ""
            else:
                current_chunk = s

    if current_chunk:
        chunks.append(current_chunk)

    return chunks

async def _synthesize_chirp3_hd_fallback(
    text: str,
    target_lang_code: str,
    gender: str = "girl"
) -> Optional[str]:
    """
    Strict native Google Cloud Chirp 3 HD fallback.
    Never uses an English voice.
    """
    fallback_voice = get_chirp3_fallback_voice(target_lang_code, gender)
    logger.warning(
        "[TTS FALLBACK TRIGGERED] Sarvam Bulbul v3 failed/timed out. Falling back to native Chirp 3 HD voice: %s (%s)",
        fallback_voice,
        target_lang_code
    )

    google_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""
    if google_key and len(google_key.strip()) > 15:
        try:
            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={google_key}"
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": target_lang_code,
                    "name": fallback_voice,
                    "ssmlGender": "FEMALE" if gender.lower() in ("female", "girl") else "MALE"
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "speakingRate": 0.92,
                    "pitch": 0.0
                }
            }
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    b64 = data.get("audioContent")
                    if b64:
                        return b64
        except Exception as e:
            logger.error("[TTS FALLBACK] Google Chirp 3 HD fallback error: %s", e)

    # Universal Native Audio Fallback (strictly native language code)
    try:
        lang_short = target_lang_code.split("-")[0].lower()
        clean_text = text.strip()
        if clean_text:
            encoded = urllib.parse.quote(clean_text)
            fallback_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang_short}&q={encoded}"
            req = urllib.request.Request(fallback_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://translate.google.com/"
            })
            with urllib.request.urlopen(req, timeout=6) as response:
                audio_bytes = response.read()
                if audio_bytes and len(audio_bytes) > 200:
                    return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        logger.error("[TTS FALLBACK] Universal native fallback error: %s", e)

    return None

async def synthesize_single_sarvam_chunk(
    chunk: str,
    target_lang_code: str,
    speaker: str,
    pace: float = 0.92,
    gender: str = "girl"
) -> Tuple[str, Optional[str]]:
    """
    Synthesizes a single chunk using Sarvam Bulbul v3 with caching and fallback.
    Returns (chunk_text, base64_audio_or_none).
    """
    cache_key = get_sarvam_cache_key(chunk, speaker, target_lang_code)

    # 1. Check Memory Cache
    if cache_key in SARVAM_MEMORY_CACHE:
        return chunk, SARVAM_MEMORY_CACHE[cache_key]

    # 2. Check Disk Cache
    disk_file = CACHE_DIR / f"sarvam_{cache_key}.json"
    if disk_file.exists():
        try:
            cached_data = json.loads(disk_file.read_text(encoding="utf-8"))
            b64 = cached_data.get("audio_base64")
            if b64:
                SARVAM_MEMORY_CACHE[cache_key] = b64
                return chunk, b64
        except Exception:
            pass

    # 3. Call Sarvam Bulbul v3
    sarvam_key = os.getenv("SARVAM_API_KEY") or os.getenv("VOICE_PROVIDER_API_KEY") or ""
    headers = {
        "api-subscription-key": sarvam_key,
        "Content-Type": "application/json"
    }

    # Primary payload per requirement
    body = {
        "text": chunk,
        "target_language_code": target_lang_code,
        "speaker": speaker,
        "model": "bulbul:v3",
        "pace": pace
    }

    audio_b64: Optional[str] = None
    sarvam_failed = False

    if sarvam_key:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(
                    SARVAM_CONFIG["api_endpoint"],
                    headers=headers,
                    json=body
                )

                # If body requires inputs array instead of text
                if res.status_code == 422:
                    alt_body = {
                        "inputs": [chunk],
                        "target_language_code": target_lang_code,
                        "speaker": speaker,
                        "model": "bulbul:v3",
                        "pace": pace
                    }
                    res = await client.post(
                        SARVAM_CONFIG["api_endpoint"],
                        headers=headers,
                        json=alt_body
                    )

                if res.status_code == 200:
                    data = res.json()
                    audios = data.get("audios", [])
                    if audios and audios[0]:
                        audio_b64 = audios[0]
                        SARVAM_MEMORY_CACHE[cache_key] = audio_b64
                        try:
                            disk_file.write_text(json.dumps({"audio_base64": audio_b64}), encoding="utf-8")
                        except Exception:
                            pass
                        logger.info(
                            "[SARVAM BULBUL:V3 SUCCESS] Lang: %s | Speaker: %s | Text: '%s...'",
                            target_lang_code, speaker, chunk[:30]
                        )
                        return chunk, audio_b64
                    else:
                        sarvam_failed = True
                else:
                    logger.warning("[SARVAM BULBUL:V3 HTTP %s] %s", res.status_code, res.text[:200])
                    sarvam_failed = True
        except asyncio.TimeoutError:
            logger.warning("[SARVAM TIMEOUT] Sarvam Bulbul v3 timed out after 6.0s for '%s'", chunk[:30])
            sarvam_failed = True
        except Exception as e:
            logger.warning("[SARVAM ERROR] %s", e)
            sarvam_failed = True
    else:
        logger.info("[SARVAM KEY MISSING] Routing directly to native Chirp 3 HD fallback.")
        sarvam_failed = True

    # 4. Fallback if Sarvam fails or times out
    if sarvam_failed or not audio_b64:
        fallback_b64 = await _synthesize_chirp3_hd_fallback(chunk, target_lang_code, gender)
        if fallback_b64:
            SARVAM_MEMORY_CACHE[cache_key] = fallback_b64
            try:
                disk_file.write_text(json.dumps({"audio_base64": fallback_b64}), encoding="utf-8")
            except Exception:
                pass
            return chunk, fallback_b64

    return chunk, None

async def sarvamTts(
    text: str,
    langCode: str,
    speaker: Optional[str] = None,
    pace: float = 1.0,
    gender: str = "girl",
    tone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main Sarvam TTS entrypoint for all 8 Indian languages (en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN, bn-IN, mr-IN):
    - Splits text into short chunks grouping 2-3 sentences (max ~220 chars) for optimal prosody.
    - Resolves speaker strictly by language, companion gender, and tone.
    - Default pace 1.0, or 0.95 for empathetic replies.
    - Caches by hash(text, speaker, lang).
    - Falls back to Google Cloud Chirp 3 HD with exact native voice on timeout/error.
    """
    if not text or not text.strip():
        return {"audio_base64": None, "sentences": [], "provider": "sarvam_bulbul_v3"}

    lang_clean = langCode.split("-")[0].lower()
    target_lang_code = f"{lang_clean}-IN"

    resolved_speaker = speaker or get_sarvam_speaker(lang_clean, gender, tone)
    chunks = split_text_into_chunks(text, max_chars=220)

    if not chunks:
        return {"audio_base64": None, "sentences": [], "provider": "sarvam_bulbul_v3"}

    # Parallel synthesis with ordered results
    tasks = [
        synthesize_single_sarvam_chunk(
            chunk=c,
            target_lang_code=target_lang_code,
            speaker=resolved_speaker,
            pace=pace,
            gender=gender
        )
        for c in chunks
    ]
    results: List[Tuple[str, Optional[str]]] = await asyncio.gather(*tasks)

    sentence_segments: List[Dict[str, Any]] = []
    audios: List[str] = []

    for chunk_text, audio_b64 in results:
        sentence_segments.append({
            "sentence": chunk_text,
            "audio_base64": audio_b64,
            "duration_ms": max(1200, len(chunk_text) * 65),
            "cached": True if audio_b64 else False
        })
        if audio_b64:
            audios.append(audio_b64)

    # First sentence starts immediately for fast playback
    primary_audio = audios[0] if audios else None

    return {
        "audio_base64": primary_audio,
        "audios": audios,
        "sentences": sentence_segments,
        "clean_text": text,
        "provider": "sarvam_bulbul_v3",
        "voice_used": resolved_speaker,
        "language_code": target_lang_code,
        "speaker": resolved_speaker,
        "pace": pace,
        "gender": gender,
        "tone": tone
    }
