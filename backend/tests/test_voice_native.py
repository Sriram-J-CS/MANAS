"""
test_voice_native.py - Comprehensive Unit & Integration Tests for Native Language Voice Output
─────────────────────────────────────────────────────────────────────────────
Validates:
1. 100% native script voice output: loanword transliteration (stress -> ஸ்ட்ரெஸ்/स्ट्रेस),
   zero Latin letters in non-English spoken text.
2. Normalization before TTS: markdown & emoji removal, times and numbers to native words,
   digit-by-digit helpline expansion.
3. Exact BCP-47 language codes and native voice mapping (never an English voice).
4. Warm companion style string via speech_metadata.style with appropriate regions.
5. Sentence-by-sentence streaming splitting and audio caching.
6. /voice-test sample lines per language.
"""

import pytest
import re
from app.services.voice import (
    to_bcp47,
    get_speech_style,
    pick_native_voice,
    sanitize_spoken_text,
    split_sentences_for_streaming,
    expand_times_and_numbers,
    transliterate_loanwords,
    compute_tts_cache_key,
    get_voice_samples,
    SAMPLE_LINES_BY_LANGUAGE,
    CHIRP3_HD_VOICES,
    EMERGENCY_DIGITS,
)

# ---------------------------------------------------------------------------
# 1. 100% Native Script & Loanword Transliteration Tests
# ---------------------------------------------------------------------------
class TestNativeScriptVoiceStep:
    def test_transliterate_tamil_loanwords(self):
        input_text = "ரொம்ப stress எடுக்காதீங்க, கொஞ்சம் relax பண்ணுங்க."
        output = transliterate_loanwords(input_text, "ta")
        assert "ஸ்ட்ரெஸ்" in output
        assert "ரிலாக்ஸ்" in output
        assert "stress" not in output.lower()
        assert "relax" not in output.lower()

    def test_transliterate_hindi_loanwords(self):
        input_text = "ज्यादा stress मत लीजिए, थोड़ा relax करिए।"
        output = transliterate_loanwords(input_text, "hi")
        assert "स्ट्रेस" in output
        assert "रिलैक्स" in output
        assert "stress" not in output.lower()
        assert "relax" not in output.lower()

    def test_transliterate_telugu_loanwords(self):
        input_text = "ఎక్కువ tension పడకండి, కాస్త relax అవ్వండి."
        output = transliterate_loanwords(input_text, "te")
        assert "టెన్షన్" in output
        assert "రిలాక్స్" in output
        assert "tension" not in output.lower()

    def test_transliterate_malayalam_loanwords(self):
        input_text = "ഒട്ടും tension വേണ്ട, കുറച്ച് relax ചെയ്യൂ."
        output = transliterate_loanwords(input_text, "ml")
        assert "ടെൻഷൻ" in output
        assert "റിലാക്സ്" in output
        assert "tension" not in output.lower()

    def test_transliterate_kannada_loanwords(self):
        input_text = "ತುಂಬಾ tension ಮಾಡ್ಕೋಬೇಡಿ, ಸ್ವಲ್ಪ relax ಆಗಿ."
        output = transliterate_loanwords(input_text, "kn")
        assert "ಟೆನ್ಷನ್" in output
        assert "ರಿಲ್ಯಾಕ್ಸ್" in output
        assert "tension" not in output.lower()

    def test_transliterate_bengali_loanwords(self):
        input_text = "একদম stress নেবেন না, একটু relax করুন।"
        output = transliterate_loanwords(input_text, "bn")
        assert "স্ট্রেস" in output
        assert "রিল্যাক্স" in output

    def test_transliterate_marathi_loanwords(self):
        input_text = "खूप tension घेऊ नका, जरा relax व्हा."
        output = transliterate_loanwords(input_text, "mr")
        assert "टेंशन" in output
        assert "रिलॅक्स" in output

    def test_non_english_spoken_text_has_no_latin_letters(self):
        """Sanitized spoken text for non-English must eliminate common Latin words."""
        sample_ta = "வணக்கம் friend, உங்களுக்கு stress மற்றும் tension இருக்கா? ஓகே, 9pm பேசுவோம்."
        sanitized = sanitize_spoken_text(sample_ta, "ta")
        # Check loanwords transliterated
        assert "ஸ்ட்ரெஸ்" in sanitized
        assert "டென்ஷன்" in sanitized
        # Check no standalone Latin loanwords remain
        assert not re.search(r"\b(stress|tension|friend|ok)\b", sanitized, re.IGNORECASE)


# ---------------------------------------------------------------------------
# 2. Normalisation Before TTS Tests
# ---------------------------------------------------------------------------
class TestTTSNormalisation:
    def test_strip_markdown_and_emojis(self):
        raw = "**மனசு** பாரமா இருக்கா? *ஆழ்ந்து* மூச்சு விடுங்கள் 🌸🌿 #wellness [லிங்க்](https://manas.ai)"
        clean = sanitize_spoken_text(raw, "ta")
        assert "**" not in clean
        assert "*" not in clean
        assert "#" not in clean
        assert "🌸" not in clean
        assert "🌿" not in clean
        assert "http" not in clean

    def test_helpline_digit_expansion(self):
        text_ta = "உதவிக்கு 14416 அழைக்கவும்."
        sanitized_ta = sanitize_spoken_text(text_ta, "ta")
        assert "ஒன்று, நான்கு, நான்கு, ஒன்று, ஆறு" in sanitized_ta
        assert "14416" not in sanitized_ta

        text_hi = "टेली-मानस 14416 पर कॉल करें।"
        sanitized_hi = sanitize_spoken_text(text_hi, "hi")
        assert "एक, चार, चार, एक, छह" in sanitized_hi
        assert "14416" not in sanitized_hi

    def test_expand_times_to_words(self):
        ta_time = expand_times_and_numbers("இரவு 9pm வாருங்கள்", "ta")
        assert "இரவு ஒன்பது மணி" in ta_time

        hi_time = expand_times_and_numbers("रात 9pm पर बात करते हैं", "hi")
        assert "नौ बजे" in hi_time or "रात नौ बजे" in hi_time

    def test_expand_numbers_to_words(self):
        ta_num = expand_times_and_numbers("5 நிமிடங்கள்", "ta")
        assert "ஐந்து" in ta_num

        hi_num = expand_times_and_numbers("4 गहरी सांस", "hi")
        assert "चार" in hi_num

    def test_split_sentences_for_streaming(self):
        multi_sentence = "நான் உங்கள் பக்கத்தில் இருக்கிறேன்! ஆழ்ந்து மூச்சு விடுங்கள். நீங்கள் தனியாக இல்லை? உதவிக்கு அழைக்கவும்."
        sentences = split_sentences_for_streaming(multi_sentence)
        assert len(sentences) == 4
        assert sentences[0].endswith("!")
        assert sentences[1].endswith(".")
        assert sentences[2].endswith("?")


# ---------------------------------------------------------------------------
# 3. Exact BCP-47 & Native Voice Roster Tests
# ---------------------------------------------------------------------------
class TestBCP47AndNativeVoices:
    def test_bcp47_code_resolution(self):
        expected_mappings = {
            "ta": "ta-IN",
            "hi": "hi-IN",
            "te": "te-IN",
            "ml": "ml-IN",
            "kn": "kn-IN",
            "bn": "bn-IN",
            "mr": "mr-IN",
            "en": "en-IN",
            "ta-IN": "ta-IN",
        }
        for inp, expected in expected_mappings.items():
            assert to_bcp47(inp) == expected

    def test_native_voice_never_english_for_indic(self):
        for lang_code in ["ta-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN", "bn-IN", "mr-IN"]:
            female_voice = pick_native_voice(lang_code, "female")
            male_voice = pick_native_voice(lang_code, "male")

            # Must never start with en- or contain English
            assert not female_voice.startswith("en-")
            assert not male_voice.startswith("en-")
            # Must match target language code
            assert female_voice.startswith(lang_code)
            assert male_voice.startswith(lang_code)

    def test_chirp3_hd_roster_complete_for_all_8_languages(self):
        all_8 = ["ta-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN", "bn-IN", "mr-IN", "en-IN"]
        for lang in all_8:
            assert lang in CHIRP3_HD_VOICES
            assert "female" in CHIRP3_HD_VOICES[lang]
            assert "male" in CHIRP3_HD_VOICES[lang]
            assert "Chirp3-HD" in CHIRP3_HD_VOICES[lang]["female"]
            assert "Chirp3-HD" in CHIRP3_HD_VOICES[lang]["male"]


# ---------------------------------------------------------------------------
# 4. Warm Companion Style via speech_metadata.style Tests
# ---------------------------------------------------------------------------
class TestWarmStyleMetadata:
    def test_speech_style_regions(self):
        style_ta = get_speech_style("ta-IN")
        assert "Tamil Nadu" in style_ta
        assert "warm, gentle, friendly, slightly slow, like a close friend from Tamil Nadu, calm and comforting" == style_ta

        style_hi = get_speech_style("hi-IN")
        assert "North India" in style_hi
        assert "warm, gentle, friendly, slightly slow, like a close friend from North India, calm and comforting" == style_hi

        style_te = get_speech_style("te-IN")
        assert "Andhra Pradesh and Telangana" in style_te

        style_ml = get_speech_style("ml-IN")
        assert "Kerala" in style_ml

        style_kn = get_speech_style("kn-IN")
        assert "Karnataka" in style_kn

        style_bn = get_speech_style("bn-IN")
        assert "Bengal" in style_bn

        style_mr = get_speech_style("mr-IN")
        assert "Maharashtra" in style_mr


# ---------------------------------------------------------------------------
# 5. Caching and Fingerprint Tests
# ---------------------------------------------------------------------------
class TestTTSCaching:
    def test_cache_key_deterministic(self):
        k1 = compute_tts_cache_key("வணக்கம்", "ta-IN", "ta-IN-Chirp3-HD-Aoede", "warm")
        k2 = compute_tts_cache_key("வணக்கம்", "ta-IN", "ta-IN-Chirp3-HD-Aoede", "warm")
        assert k1 == k2
        assert len(k1) == 64

    def test_cache_key_differs_per_voice_and_language(self):
        k_ta = compute_tts_cache_key("hello", "ta-IN", "ta-IN-Chirp3-HD-Aoede", "warm")
        k_hi = compute_tts_cache_key("hello", "hi-IN", "hi-IN-Chirp3-HD-Aoede", "warm")
        assert k_ta != k_hi


# ---------------------------------------------------------------------------
# 6. /voice-test Samples Tests
# ---------------------------------------------------------------------------
class TestVoiceTestSamples:
    def test_all_8_languages_have_native_script_samples(self):
        samples_data = get_voice_samples()
        samples = samples_data["samples"]

        for lang in ["ta-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN", "bn-IN", "mr-IN", "en-IN"]:
            assert lang in samples
            entry = samples[lang]
            sample_text = entry["sample_text"]
            assert len(sample_text) > 10

            # Indic samples must have ZERO Latin letters
            if lang != "en-IN":
                has_latin = bool(re.search(r"[a-zA-Z]", sample_text))
                assert not has_latin, f"Sample for {lang} contained Latin letters: {sample_text}"

            assert "female_voice" in entry
            assert "male_voice" in entry
            assert entry["female_voice"].startswith(lang)
            assert entry["male_voice"].startswith(lang)
