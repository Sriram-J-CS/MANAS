"""
test_voice_gender_f0.py
───────────────────────
Automated Pitch (F0) & Gender Verification Test Suite:
For all 8 supported Indian languages (en, hi, ta, te, kn, ml, bn, mr):
1. Asserts speaker is in the correct gender list (MALE_SARVAM_SPEAKERS or FEMALE_SARVAM_SPEAKERS).
2. Synthesizes a representative sentence.
3. Decodes the audio to PCM and estimates the median pitch (F0) via autocorrelation.
4. Asserts:
   - Male companion F0 < 165 Hz
   - Female companion F0 > 170 Hz
"""

import os
import io
import sys
import base64
import asyncio
import pytest
import miniaudio
import numpy as np

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if sys.path[0] != backend_dir:
    sys.path.insert(0, backend_dir)
if "app" in sys.modules and not hasattr(sys.modules["app"], "services"):
    del sys.modules["app"]

from app.services.voice import synthesize_speech_provider
from app.services.voice_config import (
    get_sarvam_speaker,
    MALE_SARVAM_SPEAKERS,
    FEMALE_SARVAM_SPEAKERS,
    ALL_SUPPORTED_LANGUAGES,
)

SAMPLE_SENTENCES = {
    "en": "I am here with you today and always.",
    "hi": "मैं हमेशा आपके साथ हूँ और आपकी बात सुन रहा हूँ।",
    "ta": "நான் எப்போதும் உங்கள் துணையாக உங்கள் பக்கத்தில் இருப்பேன்.",
    "te": "నేను ఎల్లప్పుడూ మీ తోడుగా మీ పక్కనే ఉంటాను.",
    "kn": "ನಾನು ಯಾವಾಗಲೂ ನಿಮ್ಮ ಜೊತೆಯಲ್ಲಿಯೇ ಇರುತ್ತೇನೆ.",
    "ml": "ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെ തന്നെയുണ്ടാകും.",
    "bn": "আমি সবসময় আপনার পাশে আছি এবং আপনার কথা শুনছি।",
    "mr": "मी नेहमी तुमच्या पाठीशी आहे आणि सोबत राहीन.",
}

def estimate_median_f0(audio_bytes: bytes) -> float:
    """
    Estimates fundamental frequency (F0) across voiced audio frames using normalized autocorrelation.
    """
    decoded = miniaudio.decode(audio_bytes)
    samples = np.array(decoded.samples, dtype=np.float32)
    if decoded.nchannels > 1:
        samples = samples.reshape(-1, decoded.nchannels).mean(axis=1)

    fs = decoded.sample_rate
    frame_len = int(0.04 * fs)  # 40ms frame
    hop_len = int(0.02 * fs)    # 20ms hop
    min_lag = int(fs / 350)     # Max 350 Hz
    max_lag = int(fs / 70)      # Min 70 Hz

    pitches = []
    for start in range(0, len(samples) - frame_len, hop_len):
        frame = samples[start : start + frame_len]
        energy = np.sum(frame ** 2)
        if energy < 1e-4:
            continue

        corr = np.correlate(frame, frame, mode="full")
        corr = corr[len(frame) - 1 :]
        if len(corr) <= max_lag:
            continue

        search_region = corr[min_lag:max_lag]
        peak_idx = np.argmax(search_region) + min_lag
        if corr[0] > 0 and (corr[peak_idx] / corr[0]) > 0.38:
            f0 = fs / peak_idx
            if 70 <= f0 <= 350:
                pitches.append(f0)

    return float(np.median(pitches)) if pitches else 0.0


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", ["en", "hi", "ta", "te", "kn", "ml", "bn", "mr"])
async def test_female_voice_speaker_and_f0(lang):
    """Assert female speaker is from female catalog and median F0 > 170 Hz."""
    speaker = get_sarvam_speaker(lang, "girl")
    assert speaker.lower() in FEMALE_SARVAM_SPEAKERS, (
        f"Language '{lang}' female speaker '{speaker}' is not in authorized female catalog: {FEMALE_SARVAM_SPEAKERS}"
    )

    text = SAMPLE_SENTENCES[lang]
    res = await synthesize_speech_provider(text=text, language=lang, gender="female", voice=speaker)
    audio_b64 = res.get("audio_base64")
    assert audio_b64, f"No audio returned for female {lang} ({speaker})"

    audio_bytes = base64.b64decode(audio_b64)
    f0 = estimate_median_f0(audio_bytes)
    assert f0 > 170.0, (
        f"Female speaker '{speaker}' ({lang}) F0={f0:.1f} Hz is below expected threshold (expected > 170 Hz)"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", ["en", "hi", "ta", "te", "kn", "ml", "bn", "mr"])
async def test_male_voice_speaker_and_f0(lang):
    """Assert male speaker is from male catalog and median F0 < 165 Hz."""
    speaker = get_sarvam_speaker(lang, "boy")
    assert speaker.lower() in MALE_SARVAM_SPEAKERS, (
        f"Language '{lang}' male speaker '{speaker}' is not in authorized male catalog: {MALE_SARVAM_SPEAKERS}"
    )

    text = SAMPLE_SENTENCES[lang]
    res = await synthesize_speech_provider(text=text, language=lang, gender="male", voice=speaker)
    audio_b64 = res.get("audio_base64")
    assert audio_b64, f"No audio returned for male {lang} ({speaker})"

    audio_bytes = base64.b64decode(audio_b64)
    f0 = estimate_median_f0(audio_bytes)
    assert f0 < 165.0, (
        f"Male speaker '{speaker}' ({lang}) F0={f0:.1f} Hz is above expected threshold (expected < 165 Hz)"
    )
