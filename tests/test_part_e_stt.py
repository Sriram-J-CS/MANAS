import os
import sys
import io
import time
import base64
import asyncio
from typing import Dict, List, Tuple
from dotenv import load_dotenv

load_dotenv()

from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

from backend.app.services.voice import transcribe_audio_fallback
from backend.app.services.sarvam_tts import sarvamTts
from backend.app.main import is_stt_rate_limited

STT_SAMPLES = {
    "en": "Hello, I am feeling a little overwhelmed today and need help.",
    "hi": "नमस्ते, मुझे आज थोड़ा तनाव महसूस हो रहा है।",
    "ta": "வணக்கம், இன்று எனக்கு சற்று மன அழுத்தம் அதிகமாக உள்ளது.",
    "te": "నమస్కారం, ఈ రోజు నాకు చాలా ఒత్తిడిగా ఉంది.",
    "kn": "ನಮಸ್ಕಾರ, ಇಂದು ನನಗೆ ಸ್ವಲ್ಪ ಆತಂಕವೆನಿಸುತ್ತಿದೆ.",
    "ml": "നമസ്കാരം, ഇന്ന് എനിക്ക് വളരെ ക്ഷീണം തോന്നുന്നു.",
    "bn": "নমস্কার, আজ আমার মন খুব ভারাক্রান্ত লাগছে।",
    "mr": "नमस्कार, आज मला खूप अस्वस्थ वाटत आहे."
}

def compute_word_error_rate(reference: str, hypothesis: str) -> float:
    """Computes basic word-level Levenshtein distance WER."""
    ref_words = reference.strip().replace("।", "").replace(".", "").replace(",", "").split()
    hyp_words = hypothesis.strip().replace("।", "").replace(".", "").replace(",", "").split()

    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    if not hyp_words:
        return 1.0

    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]
    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i - 1].lower() == hyp_words[j - 1].lower():
                d[i][j] = d[i - 1][j - 1]
            else:
                d[i][j] = min(
                    d[i - 1][j] + 1,      # deletion
                    d[i][j - 1] + 1,      # insertion
                    d[i - 1][j - 1] + 1   # substitution
                )

    return d[len(ref_words)][len(hyp_words)] / len(ref_words)

async def run_stt_tests():
    print("=" * 95)
    print("PART E - PROFESSIONAL SPEECH-TO-TEXT (Sarvam Saaras v3) TEST SUITE")
    print("=" * 95)
    print(f"{'Lang':<6} | {'WER':<7} | {'Latency (s)':<12} | {'Transcript (First 35 chars)':<38} | {'Status'}")
    print("-" * 95)

    all_passed = True

    for lang, sample_text in STT_SAMPLES.items():
        # 1. Synthesize audio with Bulbul v3
        tts_res = await sarvamTts(text=sample_text, langCode=f"{lang}-IN", gender="girl")
        audio_b64 = tts_res.get("audio_base64")
        if not audio_b64:
            print(f"{lang:<6} | {'N/A':<7} | {'N/A':<12} | {'Failed to synthesize reference audio':<38} | FAIL")
            all_passed = False
            continue

        raw_wav_bytes = base64.b64decode(audio_b64)

        # 2. Transcribe using Saaras v3 via transcribe_audio_fallback
        t0 = time.perf_counter()
        stt_res = await transcribe_audio_fallback(
            audio_bytes=raw_wav_bytes,
            language=lang,
            content_type="audio/wav",
            mode="transcribe"
        )
        latency = time.perf_counter() - t0

        transcript = (stt_res.get("transcript") or "").strip()
        wer = compute_word_error_rate(sample_text, transcript)

        status = "PASS" if wer <= 0.35 and transcript else "WARN"
        if wer > 0.6 or not transcript:
            status = "FAIL"
            all_passed = False

        short_display = (transcript[:35] + "...") if len(transcript) > 35 else transcript
        print(f"{lang:<6} | {wer:<7.2f} | {latency:<12.3f} | {short_display:<38} | {status}")

    print("-" * 95)

    # 3. Test Empty / Silence audio: Must return "I didn't catch that, try again" (NO FAKE TEXT)
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"\x00\x00" * 8000) # 0.5s silence

    empty_res = await transcribe_audio_fallback(
        audio_bytes=buf.getvalue(),
        language="en",
        content_type="audio/wav"
    )
    assert empty_res.get("transcript") == "", f"Expected empty transcript for silence, got: {empty_res.get('transcript')}"
    assert "didn't catch that" in empty_res.get("message", "").lower()
    print("[PASS] Silence audio correctly returns empty transcript and 'I didn't catch that' (NO fake text).")

    # 4. Test Language Mismatch Detection (Suggest Switch)
    # Synthesize Tamil audio, send with language='en'
    ta_tts = await sarvamTts(text="வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?", langCode="ta-IN", gender="girl")
    ta_wav = base64.b64decode(ta_tts["audio_base64"])
    mismatch_res = await transcribe_audio_fallback(
        audio_bytes=ta_wav,
        language="en",
        content_type="audio/wav"
    )
    if mismatch_res.get("suggest_switch"):
        print(f"[PASS] Language mismatch detected: '{mismatch_res.get('suggest_switch')}'")
    else:
        print("[INFO] Language detected matching requested code or same script.")

    # 5. Test Rate Limiter
    test_ip = "192.168.1.100"
    for _ in range(59):
        is_stt_rate_limited(test_ip, limit_per_min=60)
    assert not is_stt_rate_limited(test_ip, limit_per_min=60)
    assert is_stt_rate_limited(test_ip, limit_per_min=60) # 61st call is blocked
    print("[PASS] Per-client STT rate limiting correctly blocks on >60 req/min.")

    print("=" * 95)
    print("ALL PART E TESTS COMPLETE")
    print("=" * 95)

if __name__ == "__main__":
    asyncio.run(run_stt_tests())
