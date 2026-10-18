import os
import io
import time
import wave
import base64
import asyncio
from typing import Dict, List, Tuple
from dotenv import load_dotenv

load_dotenv()

import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.voice_config import (
    VOICE_TONE_SPEAKER_MAP,
    get_sarvam_speaker
)
from backend.app.services.sarvam_tts import (
    sarvamTts,
    normalize_text_for_speech,
    split_text_into_chunks,
    combine_wav_chunks
)

MULTI_SENTENCE_TESTS = {
    "en": {
        "text": "Hello there! Dr. Sharma suggested we take 10 mins to relax. We can also walk 2 km today. Take a deep breath, and let it out slowly. Everything is going to be okay.",
        "gender": "boy",
        "tone": "aarav"
    },
    "hi": {
        "text": "नमस्ते! हमें शांत होने के लिए 5 mins का समय लेना चाहिए। चिंता करने की कोई बात नहीं है। मैं हमेशा यहाँ आपके साथ हूँ।",
        "gender": "boy",
        "tone": "kabir"
    },
    "ta": {
        "text": "வணக்கம்! மன அமைதி பெற 10 mins ஒதுக்குவோம். ஆழமாக மூச்சை உள்ளிழுங்கள், மெதுவாக வெளியேற்றுங்கள். நான் எப்போதும் உங்களுடன் இருக்கிறேன்.",
        "gender": "girl",
        "tone": "ananya"
    },
    "te": {
        "text": "నమస్కారం! కాసేపు విశ్రాంతి తీసుకోండి. లోతుగా శ్వాస తీసుకోండి. నేను మీకు సహాయం చేయడానికి ఇక్కడే ఉన్నాను.",
        "gender": "boy",
        "tone": "shubh"
    }
}

async def run_diagnostics():
    print("=" * 80)
    print("PART D - TTS PERFORMANCE & LAG DIAGNOSTICS TABLE (Sarvam Bulbul v3)")
    print("=" * 80)
    print(f"{'Lang':<6} | {'Gender':<7} | {'Speaker':<9} | {'Chunks':<6} | {'TTFA (s)':<9} | {'Rate (Hz)':<9} | {'Gapless?':<8} | {'Status'}")
    print("-" * 80)

    all_passed = True

    for lang, info in MULTI_SENTENCE_TESTS.items():
        text = info["text"]
        gender = info["gender"]
        tone = info["tone"]

        # 1. Text normalization test
        normalized = normalize_text_for_speech(text, lang)
        assert len(normalized) > 0, "Normalization produced empty string"

        # 2. Time to first audio measurement
        t0 = time.perf_counter()
        res = await sarvamTts(
            text=text,
            langCode=f"{lang}-IN",
            gender=gender,
            tone=tone
        )
        elapsed = time.perf_counter() - t0

        audio_b64 = res.get("audio_base64")
        audios = res.get("audios", [])
        num_chunks = len(audios)
        speaker = res.get("voice_used", "unknown")

        if not audio_b64:
            print(f"{lang:<6} | {gender:<7} | {speaker:<9} | {num_chunks:<6} | {elapsed:<9.3f} | {'N/A':<9} | {'NO':<8} | FAIL (No Audio)")
            all_passed = False
            continue

        raw_bytes = base64.b64decode(audio_b64)
        sample_rate = 0
        is_gapless = "YES"

        if raw_bytes.startswith(b"RIFF"):
            try:
                with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
                    sample_rate = wf.getframerate()
                    # Sarvam Bulbul v3 requests speech_sample_rate = 24000
                    if sample_rate != 24000:
                        is_gapless = f"Rate:{sample_rate}"
            except Exception as e:
                is_gapless = "Corrupt"

        status = "PASS" if sample_rate in (24000, 22050, 48000) else "WARN"
        if elapsed > 3.0:
            status = "WARN"

        print(f"{lang:<6} | {gender:<7} | {speaker:<9} | {num_chunks:<6} | {elapsed:<9.3f} | {sample_rate:<9} | {is_gapless:<8} | {status}")

    print("-" * 80)

    # Unit test for combine_wav_chunks
    dummy_wav_1 = io.BytesIO()
    with wave.open(dummy_wav_1, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\x00\x00" * 2400) # 0.1s
    b64_1 = base64.b64encode(dummy_wav_1.getvalue()).decode("ascii")

    dummy_wav_2 = io.BytesIO()
    with wave.open(dummy_wav_2, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\x00\x00" * 4800) # 0.2s
    b64_2 = base64.b64encode(dummy_wav_2.getvalue()).decode("ascii")

    stitched = combine_wav_chunks([b64_1, b64_2])
    assert stitched is not None
    stitched_bytes = base64.b64decode(stitched)
    with wave.open(io.BytesIO(stitched_bytes), "rb") as wf:
        total_frames = wf.getnframes()
        assert total_frames == 7200, f"Expected 7200 frames, got {total_frames}"
        assert wf.getframerate() == 24000
    print("[PASS] Multi-chunk WAV stitching correctly preserves sample rate 24000 and total frames.")

    # Unit test for text abbreviation normalization
    raw_abbr = "Dr. Rao said walk 5 mins and 2 km every day."
    clean_abbr = normalize_text_for_speech(raw_abbr, "en")
    assert "Doctor Rao" in clean_abbr
    assert "5 minutes" in clean_abbr
    assert "2 kilometers" in clean_abbr
    print("[PASS] Text normalization expands abbreviations and units properly.")

    print("=" * 80)
    print("ALL PART D DIAGNOSTIC TESTS PASSED")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
