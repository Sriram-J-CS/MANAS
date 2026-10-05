"""
test_voice_native_6.py - 20 Automated Tests for the 6 Indic Native Languages
─────────────────────────────────────────────────────────────────────────────
Target Languages:
- Tamil (ta / ta-IN)
- Telugu (te / te-IN)
- Kannada (kn / kn-IN)
- Malayalam (ml / ml-IN)
- Bengali (bn / bn-IN)
- Marathi (mr / mr-IN)

Preserves:
- English (en) and Hindi (hi) voices 100% untouched.
"""

import os
import sys
import re
import uuid
import asyncio

# Ensure backend directory is prioritized in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if sys.path[0] != backend_dir:
    sys.path.insert(0, backend_dir)
if "app" in sys.modules and not hasattr(sys.modules["app"], "services"):
    del sys.modules["app"]

from app.services.voice_config import (
    is_native_6_language,
    get_sarvam_speaker,
    get_chirp3_fallback_voice,
    SARVAM_NATIVE_VOICE_MAP,
    CHIRP3_FALLBACK_VOICE_MAP,
    SARVAM_CONFIG
)
from app.services.voice_validator import (
    convert_digits_to_words,
    apply_script_loanwords,
    validate_and_purify_speech_text,
    apply_last_resort_transliteration,
    NATURAL_SCRIPT_LOANWORDS,
    DIGIT_MAP
)
from app.services.sarvam_tts import (
    split_text_into_chunks,
    get_sarvam_cache_key,
    sarvamTts
)
from app.services.voice import (
    SAMPLE_LINES_BY_LANGUAGE,
    synthesize_speech_provider
)
from app.database import get_db, init_db

# Initialize database tables
init_db()

# ---------------------------------------------------------------------------
# 1. Routing & Isolation Tests
# ---------------------------------------------------------------------------
def test_1_native_6_languages_detected():
    """Validates that ta, te, kn, ml, bn, mr belong to native 6 group."""
    for lang in ["ta", "te", "kn", "ml", "bn", "mr", "ta-IN", "te-IN"]:
        assert is_native_6_language(lang) is True

def test_2_english_hindi_explicitly_isolated():
    """Validates that en and hi are NOT in native 6 group (must stay untouched)."""
    for lang in ["en", "hi", "en-IN", "hi-IN", "es", "fr"]:
        assert is_native_6_language(lang) is False

# ---------------------------------------------------------------------------
# 2. Sarvam Bulbul v3 Speaker Map Config Tests
# ---------------------------------------------------------------------------
def test_3_sarvam_speaker_map_config():
    """
    Validates exact speaker map:
    ta: ishita/ratan, te: priya/shubh, kn: ishita/shubh,
    ml: pooja/shubh, bn: roopa/rehan, mr: priya/ratan.
    """
    expected = {
        "ta": ("ishita", "ratan"),
        "te": ("priya", "shubh"),
        "kn": ("ishita", "shubh"),
        "ml": ("pooja", "shubh"),
        "bn": ("roopa", "rehan"),
        "mr": ("priya", "ratan"),
    }
    for lang, (girl_voice, boy_voice) in expected.items():
        assert get_sarvam_speaker(lang, "girl") == girl_voice
        assert get_sarvam_speaker(lang, "female") == girl_voice
        assert get_sarvam_speaker(lang, "boy") == boy_voice
        assert get_sarvam_speaker(lang, "male") == boy_voice

def test_4_sarvam_bulbul_v3_config_parameters():
    """Validates Sarvam model, pace 0.92, max 2500 chars, and 6s timeout."""
    assert SARVAM_CONFIG["model"] == "bulbul:v3"
    assert SARVAM_CONFIG["pace"] == 0.92
    assert SARVAM_CONFIG["max_chars_per_chunk"] == 2500
    assert SARVAM_CONFIG["timeout_seconds"] == 6.0

def test_5_chirp3_fallback_voices_strictly_native():
    """Validates fallback voices are strictly native language Chirp 3 HD, never English."""
    for lang in ["ta-IN", "te-IN", "kn-IN", "ml-IN", "bn-IN", "mr-IN"]:
        girl_voice = get_chirp3_fallback_voice(lang, "girl")
        boy_voice = get_chirp3_fallback_voice(lang, "boy")
        assert lang in girl_voice
        assert lang in boy_voice
        assert "en-IN" not in girl_voice
        assert "en-IN" not in boy_voice
        assert "Chirp3-HD" in girl_voice

# ---------------------------------------------------------------------------
# 3. Native Script & Number Normalization Tests
# ---------------------------------------------------------------------------
def test_6_digits_conversion_tamil():
    """Converts numbers to Tamil words."""
    res = convert_digits_to_words("உங்களுக்கு 5 நிமிடம் டைம் இருக்கு", "ta")
    assert "ஐந்து" in res
    assert "5" not in res

def test_7_digits_conversion_telugu():
    """Converts numbers to Telugu words."""
    res = convert_digits_to_words("మీకు 10 నిమిషాలు ఉంది", "te")
    assert "పది" in res
    assert "10" not in res

def test_8_digits_conversion_kannada():
    """Converts numbers to Kannada words."""
    res = convert_digits_to_words("ನಿಮಗೆ 2 ನಿಮಿಷ ಸಮಯವಿದೆ", "kn")
    assert "ಎರಡು" in res
    assert "2" not in res

def test_9_digits_conversion_bengali():
    """Converts numbers to Bengali words."""
    res = convert_digits_to_words("তোমার ৩ মিনিট সময় আছে", "bn")
    assert "তিন" in res
    assert "3" not in res

def test_10_digits_conversion_marathi():
    """Converts numbers to Marathi words."""
    res = convert_digits_to_words("तुमच्याकडे 4 मिनिटे आहेत", "mr")
    assert "चार" in res
    assert "4" not in res

def test_11_digits_conversion_malayalam():
    """Converts numbers to Malayalam words."""
    res = convert_digits_to_words("നിങ്ങൾക്ക് 1 നിമിഷം വേണം", "ml")
    assert "ഒന്ന്" in res
    assert "1" not in res

# ---------------------------------------------------------------------------
# 4. Spoken Loanword Representation in Native Script
# ---------------------------------------------------------------------------
def test_12_loanwords_tamil_script():
    """Checks loanwords like stress, exam, phone, doctor in Tamil script."""
    text = "exam மற்றும் stress பற்றி doctor உடன் phone பேசலாம்"
    res = apply_script_loanwords(text, "ta")
    assert "எக்ஸாம்" in res
    assert "ஸ்ட்ரெஸ்" in res
    assert "டாக்டர்" in res
    assert "போன்" in res

def test_13_loanwords_telugu_script():
    """Checks loanwords in Telugu script."""
    text = "stress మరియు exam గురించి doctor తో phone మాట్లాడండి"
    res = apply_script_loanwords(text, "te")
    assert "స్ట్రెస్" in res
    assert "ఎగ్జామ్" in res
    assert "డాక్టర్" in res
    assert "ఫోన్" in res

def test_14_loanwords_bengali_script():
    """Checks loanwords in Bengali script."""
    text = "stress আর exam নিয়ে doctor এর সাথে কথা বলো"
    res = apply_script_loanwords(text, "bn")
    assert "স্ট্রেস" in res
    assert "এক্সাম" in res
    assert "ডাক্তার" in res

# ---------------------------------------------------------------------------
# 5. Validator Pipeline Tests
# ---------------------------------------------------------------------------
def test_15_validator_purifies_latin_in_native_language():
    """Validates that validate_and_purify_speech_text removes/rewrites Latin characters for ta."""
    raw = "மனசு ரொம்ப stress-ah இருக்கு, 10 நிமிஷம் relax பண்ணுங்க"
    purified = asyncio.run(validate_and_purify_speech_text(raw, "ta"))
    latin = re.findall(r"[A-Za-z]", purified)
    assert len(latin) == 0
    assert "ஸ்ட்ரெஸ்" in purified or "மனசு" in purified

def test_16_validator_leaves_english_and_hindi_untouched():
    """Validates that English and Hindi are not filtered by Indic 6 validator."""
    en_text = "Take a deep breath and take 5 minutes to relax."
    purified_en = asyncio.run(validate_and_purify_speech_text(en_text, "en"))
    assert purified_en == en_text

    hi_text = "थोड़ा stress मत लीजिए, 5 मिनट आराम करिए।"
    purified_hi = asyncio.run(validate_and_purify_speech_text(hi_text, "hi"))
    assert purified_hi == hi_text

# ---------------------------------------------------------------------------
# 6. Sarvam Chunking & Caching Tests
# ---------------------------------------------------------------------------
def test_17_chunking_at_sentence_ends():
    """Validates splitting at sentence ends with max 2500 chars."""
    text = "முதல் வாக்கியம். இரண்டாவது வாக்கியம்! மூன்றாவது வாக்கியம்?"
    chunks = split_text_into_chunks(text, max_chars=2500)
    assert len(chunks) >= 1
    for c in chunks:
        assert len(c) <= 2500

def test_18_deterministic_cache_key():
    """Validates deterministic SHA-256 hash caching."""
    k1 = get_sarvam_cache_key("வணக்கம்", "ishita", "ta-IN")
    k2 = get_sarvam_cache_key("வணக்கம்", "ishita", "ta-IN")
    k3 = get_sarvam_cache_key("வணக்கம்", "ratan", "ta-IN")
    assert k1 == k2
    assert k1 != k3
    assert len(k1) == 64

# ---------------------------------------------------------------------------
# 7. Fallback & End-to-End Synthesis Tests
# ---------------------------------------------------------------------------
def test_19_sarvam_tts_pipeline_and_fallback():
    """Validates sarvamTts produces audio (via Sarvam or Chirp 3 HD fallback)."""
    res = asyncio.run(sarvamTts(
        text="மனசு அமைதியாக இருக்கட்டும்.",
        langCode="ta-IN",
        speaker="ishita",
        pace=0.92,
        gender="girl"
    ))
    assert res is not None
    assert "sentences" in res
    assert res["language_code"] == "ta-IN"
    assert res["speaker"] == "ishita"
    assert res["pace"] == 0.92

# ---------------------------------------------------------------------------
# 8. Database Ratings Table & Sample Lines Coverage
# ---------------------------------------------------------------------------
def test_20_voice_ratings_table_and_sample_lines():
    """Validates saving a voice rating to voice_ratings table and checks 6 sample lines."""
    # 1. Test database table insertion
    conn = get_db()
    cursor = conn.cursor()
    rating_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO voice_ratings (
            id, language, voice_gender, voice_name, overall_rating,
            naturalness, pronunciation, pacing, native_speaker, feedback_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rating_id, "ta-IN", "female", "ishita", 5, 5, 5, 5, 1, "Very natural spoken Chennai Tamil."
    ))
    conn.commit()

    cursor.execute("SELECT id, language, voice_name, overall_rating FROM voice_ratings WHERE id = ?", (rating_id,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None
    assert row["language"] == "ta-IN"
    assert row["voice_name"] == "ishita"
    assert row["overall_rating"] == 5

    # 2. Check that all 6 target languages have natural sample lines with ZERO Latin letters
    for lang in ["ta-IN", "te-IN", "kn-IN", "ml-IN", "bn-IN", "mr-IN"]:
        assert lang in SAMPLE_LINES_BY_LANGUAGE
        sample = SAMPLE_LINES_BY_LANGUAGE[lang]["sample_text"]
        assert len(sample) > 10
        # Assert zero Latin letters in sample
        assert len(re.findall(r"[A-Za-z]", sample)) == 0
