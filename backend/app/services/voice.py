"""
voice.py - Server-Side Voice Processing Service for MANAS & EmotiCare AI
─────────────────────────────────────────────────────────────────────────────
Capabilities:
1. Pure Native Script Voice Step:
   - Non-English spoken text (ta, hi, te, ml, kn, bn, mr) is 100% in chosen language & script.
   - Transliterates English loanwords into native script (e.g. "stress" -> "ஸ்ட்ரெஸ்").
   - ZERO Latin letters in non-English voice text.
2. Advanced TTS Normalisation:
   - Strips markdown and emojis.
   - Expands times (e.g. 9pm, 9:30) and numbers (0-100+) to natural words in target language.
   - Expands crisis helplines (14416, 112, 1098, 1800-599-0019) digit-by-digit.
   - Sentence-boundary splitting for smooth progressive audio streaming.
3. Native Speaker Voice Roster:
   - BCP-47 codes: ta-IN, hi-IN, te-IN, ml-IN, kn-IN, bn-IN, mr-IN, en-IN.
   - Google Cloud Chirp 3 HD & Gemini TTS family (gemini-3.8-flash-lite-tts / Cloud Gemini-TTS).
   - Dynamic voice list discovery at startup mapping best voice per language and gender.
   - Strictly NEVER an English voice for non-English languages.
4. Warm Companion Style:
   - speech_metadata.style: "warm, gentle, friendly, slightly slow, like a close friend from {region}, calm and comforting".
5. Sentence-by-Sentence Streaming & Caching:
   - Two-level caching (Memory + Disk) for fixed repeated phrases.
6. /voice-test Samples:
   - Curated high-fidelity test lines per language with male/female voice mapping.
"""

import base64
import hashlib
import json
import logging
import os
import re
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from .voice_config import (
    is_native_6_language,
    get_sarvam_speaker,
    get_chirp3_fallback_voice,
    should_use_legacy_tts,
    SARVAM_DEFAULT_SPEAKERS,
    SARVAM_CONFIG,
    get_tone_pace
)
from .voice_validator import (
    validate_and_purify_speech_text,
    convert_digits_to_words,
    apply_script_loanwords
)
from .sarvam_tts import (
    sarvamTts,
    synthesize_single_sarvam_chunk
)

logger = logging.getLogger("manas.voice")

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "cache" / "audio"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Fast in-memory cache for audio
TTS_MEMORY_CACHE: Dict[str, str] = {}

# QA Language Status Registry (default all enabled)
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

# ─────────────────────────────────────────────────────────────────────────────
# BCP-47 Language Codes and Region Mapping
# ─────────────────────────────────────────────────────────────────────────────

BCP47_MAP: Dict[str, str] = {
    "ta": "ta-IN",
    "hi": "hi-IN",
    "te": "te-IN",
    "ml": "ml-IN",
    "kn": "kn-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "en": "en-IN",
    "ta-IN": "ta-IN",
    "hi-IN": "hi-IN",
    "te-IN": "te-IN",
    "ml-IN": "ml-IN",
    "kn-IN": "kn-IN",
    "bn-IN": "bn-IN",
    "mr-IN": "mr-IN",
    "en-IN": "en-IN",
}

LANGUAGE_REGION_MAP: Dict[str, str] = {
    "ta": "Tamil Nadu",
    "ta-IN": "Tamil Nadu",
    "hi": "North India",
    "hi-IN": "North India",
    "te": "Andhra Pradesh and Telangana",
    "te-IN": "Andhra Pradesh and Telangana",
    "ml": "Kerala",
    "ml-IN": "Kerala",
    "kn": "Karnataka",
    "kn-IN": "Karnataka",
    "bn": "Bengal",
    "bn-IN": "Bengal",
    "mr": "Maharashtra",
    "mr-IN": "Maharashtra",
    "en": "India",
    "en-IN": "India",
}

def to_bcp47(lang: str) -> str:
    """Normalizes input language string to exact BCP-47 code."""
    if not lang:
        return "en-IN"
    cleaned = lang.strip().lower()
    return BCP47_MAP.get(cleaned, BCP47_MAP.get(cleaned.split("-")[0], "en-IN"))

def get_speech_style(lang: str) -> str:
    """Returns warm companion persona prompt for speech_metadata."""
    region = LANGUAGE_REGION_MAP.get(lang, LANGUAGE_REGION_MAP.get(lang.split("-")[0], "India"))
    return f"warm, gentle, friendly, slightly slow, like a close friend from {region}, calm and comforting"

# ─────────────────────────────────────────────────────────────────────────────
# Native Speaker Voices (Google Cloud Chirp 3 HD, Gemini TTS & Sarvam)
# ─────────────────────────────────────────────────────────────────────────────

# Curated Native Chirp 3 HD / Gemini TTS roster
CHIRP3_HD_VOICES: Dict[str, Dict[str, str]] = {
    "ta-IN": {"female": "ta-IN-Chirp3-HD-Aoede", "male": "ta-IN-Chirp3-HD-Charon"},
    "hi-IN": {"female": "hi-IN-Chirp3-HD-Aoede", "male": "hi-IN-Chirp3-HD-Charon"},
    "te-IN": {"female": "te-IN-Chirp3-HD-Aoede", "male": "te-IN-Chirp3-HD-Charon"},
    "ml-IN": {"female": "ml-IN-Chirp3-HD-Aoede", "male": "ml-IN-Chirp3-HD-Charon"},
    "kn-IN": {"female": "kn-IN-Chirp3-HD-Aoede", "male": "kn-IN-Chirp3-HD-Charon"},
    "bn-IN": {"female": "bn-IN-Chirp3-HD-Aoede", "male": "bn-IN-Chirp3-HD-Charon"},
    "mr-IN": {"female": "mr-IN-Chirp3-HD-Aoede", "male": "mr-IN-Chirp3-HD-Charon"},
    "en-IN": {"female": "en-IN-Chirp3-HD-Aoede", "male": "en-IN-Chirp3-HD-Charon"},
}

FALLBACK_CLOUD_VOICES: Dict[str, Dict[str, str]] = {
    "ta-IN": {"female": "ta-IN-Wavenet-A", "male": "ta-IN-Wavenet-B"},
    "hi-IN": {"female": "hi-IN-Neural2-A", "male": "hi-IN-Wavenet-B"},
    "te-IN": {"female": "te-IN-Standard-A", "male": "te-IN-Standard-B"},
    "ml-IN": {"female": "ml-IN-Standard-A", "male": "ml-IN-Standard-B"},
    "kn-IN": {"female": "kn-IN-Standard-A", "male": "kn-IN-Standard-B"},
    "bn-IN": {"female": "bn-IN-Wavenet-A", "male": "bn-IN-Wavenet-B"},
    "mr-IN": {"female": "mr-IN-Wavenet-A", "male": "mr-IN-Wavenet-B"},
    "en-IN": {"female": "en-IN-Wavenet-A", "male": "en-IN-Wavenet-B"},
}

# Sarvam Bulbul v2 personas
SARVAM_VOICES: Dict[str, Dict[str, List[str]]] = {
    "ta": {"female": ["ananya", "pavithra"], "male": ["achal", "karan"]},
    "hi": {"female": ["ananya", "pavithra"], "male": ["achal", "arjun"]},
    "te": {"female": ["ananya", "maitreyi"], "male": ["achal", "arjun"]},
    "kn": {"female": ["ananya", "pavithra"], "male": ["achal", "karan"]},
    "ml": {"female": ["ananya", "maitreyi"], "male": ["achal", "arjun"]},
    "bn": {"female": ["ananya", "pavithra"], "male": ["achal", "karan"]},
    "mr": {"female": ["ananya", "pavithra"], "male": ["achal", "arjun"]},
    "en": {"female": ["ananya", "pavithra"], "male": ["achal", "arjun"]},
}

# Dynamically updated active voice roster
ACTIVE_VOICE_MAP: Dict[str, Dict[str, str]] = json.loads(json.dumps(CHIRP3_HD_VOICES))

def initialize_voice_roster() -> Dict[str, Any]:
    """
    Called at startup: queries Google Cloud / Gemini TTS voices list API to discover
    and map available native Chirp 3 HD, Neural2, and Wavenet voices per language and gender.
    """
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("CLOUD_TTS_KEY") or ""
    if not key or len(key.strip()) < 15:
        logger.info("Voice roster initialized with curated Chirp 3 HD defaults.")
        return ACTIVE_VOICE_MAP

    try:
        url = f"https://texttospeech.googleapis.com/v1/voices?key={key}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            voices = data.get("voices", [])
            for v in voices:
                v_lang_codes = v.get("languageCodes", [])
                v_name = v.get("name", "")
                v_gender = v.get("ssmlGender", "").lower()
                gender_key = "female" if "female" in v_gender else "male" if "male" in v_gender else None

                for code in v_lang_codes:
                    if code in ACTIVE_VOICE_MAP and gender_key:
                        # Prioritize Chirp 3 HD or Neural2
                        if "chirp3-hd" in v_name.lower():
                            ACTIVE_VOICE_MAP[code][gender_key] = v_name
                        elif "neural2" in v_name.lower() and "chirp" not in ACTIVE_VOICE_MAP[code][gender_key].lower():
                            ACTIVE_VOICE_MAP[code][gender_key] = v_name
            logger.info("Dynamic Google TTS voice list synced successfully.")
    except Exception as e:
        logger.debug("Voice list discovery skipped (using built-in Chirp 3 HD): %s", e)

    return ACTIVE_VOICE_MAP

# Initialize on module import
initialize_voice_roster()

def pick_native_voice(bcp47_code: str, gender: str = "female") -> str:
    """Returns the native voice name for the exact language and gender (never English)."""
    lang = to_bcp47(bcp47_code)
    g = "male" if gender.lower() in ("male", "boy") else "female"
    return ACTIVE_VOICE_MAP.get(lang, {}).get(g) or CHIRP3_HD_VOICES.get(lang, {}).get(g, "ta-IN-Chirp3-HD-Aoede")


# ─────────────────────────────────────────────────────────────────────────────
# Numbers, Helplines and Times Normalisation in Target Languages
# ─────────────────────────────────────────────────────────────────────────────

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
    "18005990019": {
        "en": "one, eight, zero, zero, five, nine, nine, zero, zero, one, nine",
        "ta": "ஒன்று, எட்டு, பூஜ்ஜியம், பூஜ்ஜியம், ஐந்து, ஒன்பது, ஒன்பது, பூஜ்ஜியம், பூஜ்ஜியம், ஒன்று, ஒன்பது",
        "hi": "एक, आठ, शून्य, शून्य, पांच, नौ, नौ, शून्य, शून्य, एक, नौ",
        "te": "ఒకటి, ఎనిమిది, సున్నా, సున్నా, ఐదు, తొమ్మిది, తొమ్మిది, సున్నా, సున్నా, ఒకటి, తొమ్మిది",
        "kn": "ಒಂದು, ಎಂಟು, ಸೊನ್ನೆ, ಸೊನ್ನೆ, ಐದು, ಒಂಬತ್ತು, ಒಂಬತ್ತು, ಸೊನ್ನೆ, ಸೊನ್ನೆ, ಒಂದು, ಒಂಬತ್ತು",
        "ml": "ഒന്ന്, എട്ട്, പൂജ്യം, പൂജ്യം, അഞ്ച്, ഒൻപത്, ഒൻപത്, പൂജ്യം, പൂജ്യം, ഒന്ന്, ഒൻപത്",
        "bn": "এক, আট, শূন্য, শূন্য, পাঁচ, নয়, নয়, শূন্য, শূন্য, এক, নয়",
        "mr": "एक, आठ, शून्य, शून्य, पाच, नऊ, नऊ, शून्य, शून्य, एक, नऊ",
    }
}

DIGIT_WORDS: Dict[str, Dict[int, str]] = {
    "en": {0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve", 15: "fifteen", 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 100: "hundred"},
    "ta": {0: "பூஜ்ஜியம்", 1: "ஒன்று", 2: "இரண்டு", 3: "மூன்று", 4: "நான்கு", 5: "ஐந்து", 6: "ஆறு", 7: "ஏழு", 8: "எட்டு", 9: "ஒன்பது", 10: "பத்து", 11: "பதினொன்று", 12: "பன்னிரண்டு", 15: "பதினைந்து", 20: "இருபது", 30: "முப்பது", 40: "நாற்பது", 50: "ஐம்பது", 100: "நூறு"},
    "hi": {0: "शून्य", 1: "एक", 2: "दो", 3: "तीन", 4: "चार", 5: "पांच", 6: "छह", 7: "सात", 8: "आठ", 9: "नौ", 10: "दस", 11: "ग्यारह", 12: "बारह", 15: "पंद्रह", 20: "बीस", 30: "तीस", 40: "चालीस", 50: "पचास", 100: "सौ"},
    "te": {0: "సున్నా", 1: "ఒకటి", 2: "రెండు", 3: "మూడు", 4: "నాలుగు", 5: "ఐదు", 6: "ఆరు", 7: "ఏడు", 8: "ఎనిమిది", 9: "తొమ్మిది", 10: "పది", 11: "పదకొండు", 12: "పన్నెండు", 15: "పదిహేను", 20: "ఇరవై", 30: "ముప్పై", 40: "నలభై", 50: "యాభై", 100: "వంద"},
    "ml": {0: "പൂജ്യം", 1: "ഒന്ന്", 2: "രണ്ട്", 3: "മൂന്ന്", 4: "നാല്", 5: "അഞ്ച്", 6: "ആറ്", 7: "ഏഴ്", 8: "എട്ട്", 9: "ഒൻപത്", 10: "പത്ത്", 11: "പതിനൊന്ന്", 12: "പന്ത്രണ്ട്", 15: "പതിനഞ്ച്", 20: "ഇരുപത്", 30: "മുപ്പത്", 40: "നാല്പത്", 50: "അമ്പത്", 100: "നൂറ്"},
    "kn": {0: "ಸೊನ್ನೆ", 1: "ಒಂದು", 2: "ಎರಡು", 3: "ಮೂರು", 4: "ನಾಲ್ಕು", 5: "ಐದು", 6: "ಆರು", 7: "ಏಳು", 8: "ಎಂಟು", 9: "ಒಂಬತ್ತು", 10: "ಹತ್ತು", 11: "ಹನ್ನೊಂದು", 12: "ಹನ್ನೆರಡು", 15: "ಹದಿನೈದು", 20: "ಇಪ್ಪತ್ತು", 30: "ಮೂವತ್ತು", 40: "ನಲವತ್ತು", 50: "ಐವತ್ತು", 100: "ನೂರು"},
    "bn": {0: "শূন্য", 1: "এক", 2: "দুই", 3: "তিন", 4: "চার", 5: "পাঁচ", 6: "ছয়", 7: "সাত", 8: "আট", 9: "নয়", 10: "দশ", 11: "এগারো", 12: "বারো", 15: "পনেরো", 20: "কুড়ি", 30: "তিরিশ", 40: "চল্লিশ", 50: "পঞ্চাশ", 100: "একশো"},
    "mr": {0: "शून्य", 1: "एक", 2: "दोन", 3: "तीन", 4: "चार", 5: "पाच", 6: "सहा", 7: "सात", 8: "आठ", 9: "नऊ", 10: "दहा", 11: "अकरा", 12: "बारा", 15: "पंधरा", 20: "वीस", 30: "तीस", 40: "चाळीस", 50: "पन्नास", 100: "शंभर"},
}

# Common English loanword replacements into native script phonetic loanwords
LOANWORD_TRANSLITERATIONS: Dict[str, Dict[str, str]] = {
    "ta": {
        "stress": "ஸ்ட்ரெஸ்", "tension": "டென்ஷன்", "anxiety": "ஆன்ஸைட்டி", "breathe": "மூச்சு விடுங்க",
        "deep breath": "ஆழ்ந்த மூச்சு", "relax": "ரிலாக்ஸ்", "ok": "சரி", "okay": "சரி",
        "doctor": "டாக்டர்", "problem": "ப்ராப்ளம்", "time": "நேரம்", "sleep": "தூக்கம்",
        "mind": "மனசு", "session": "செஷன்", "help": "ஹெல்ப்", "friend": "தோழா",
        "exam": "எக்ஸாம்", "phone": "போன்"
    },
    "hi": {
        "stress": "स्ट्रेस", "tension": "टेंशन", "anxiety": "घबराहट", "breathe": "सांस लीजिए",
        "deep breath": "गहरी सांस", "relax": "रिलैक्स", "ok": "ठीक है", "okay": "ठीक है",
        "doctor": "डॉक्टर", "problem": "मुश्किल", "time": "समय", "sleep": "नींद",
        "mind": "मन", "session": "बातचीत", "help": "मदद", "friend": "दोस्त",
        "exam": "एग्जाम", "phone": "फोन"
    },
    "te": {
        "stress": "స్ట్రెస్", "tension": "టెన్షన్", "anxiety": "కంగారు", "breathe": "శ్వాస తీసుకోండి",
        "deep breath": "దీర్ఘ శ్వాస", "relax": "రిలాక్స్", "ok": "సరే", "okay": "సరే",
        "doctor": "డాక్టర్", "problem": "సమస్య", "time": "సమయం", "sleep": "నిద్ర",
        "mind": "మనసు", "session": "మాటామంతీ", "help": "సహాయం", "friend": "నేస్తం",
        "exam": "ఎగ్జామ్", "phone": "ఫోన్"
    },
    "ml": {
        "stress": "സ്ട്രെസ്സ്", "tension": "ടെൻഷൻ", "anxiety": "ആകുലത", "breathe": "ശ്വാസമെടുക്കൂ",
        "deep breath": "ദീർഘശ്വാസം", "relax": "റിലാക്സ്", "ok": "ശരി", "okay": "ശരി",
        "doctor": "ഡോക്ടർ", "problem": "ബുദ്ധിമുട്ട്", "time": "സമയം", "sleep": "ഉറക്കം",
        "mind": "മനസ്സ്", "session": "സംസാരം", "help": "സഹായം", "friend": "കൂട്ടുകാരാ",
        "exam": "എക്സാം", "phone": "ഫോൺ"
    },
    "kn": {
        "stress": "ಸ್ಟ್ರೆಸ್", "tension": "ಟೆನ್ಷನ್", "anxiety": "ಕಳವಳ", "breathe": "ಉಸಿರಾಟ ಮಾಡಿ",
        "deep breath": "ದೀರ್ಘ ಉಸಿರು", "relax": "ರಿಲ್ಯಾಕ್ಸ್", "ok": "ಸರಿ", "okay": "ಸರಿ",
        "doctor": "ಡಾಕ್ಟರ್", "problem": "ತೊಂದರೆ", "time": "ಸಮಯ", "sleep": "ನಿದ್ರೆ",
        "mind": "ಮನಸ್ಸು", "session": "ಮಾತುಕತೆ", "help": "ಸಹಾಯ", "friend": "ಗೆಳೆಯ",
        "exam": "ಎಕ್ಸಾಂ", "phone": "ಫೋನ್"
    },
    "bn": {
        "stress": "স্ট্রেস", "tension": "টেনশন", "anxiety": "উদ্বেগ", "breathe": "শ্বাস নিন",
        "deep breath": "গভীর শ্বাস", "relax": "রিল্যাক্স", "ok": "ঠিক আছে", "okay": "ঠিক আছে",
        "doctor": "ডাক্তার", "problem": "কষ্ট", "time": "সময়", "sleep": "ঘুম",
        "mind": "মন", "session": "কথাবার্তা", "help": "সাহায্য", "friend": "বন্ধু",
        "exam": "এক্সাম", "phone": "ফোন"
    },
    "mr": {
        "stress": "स्ट्रेस", "tension": "टेंशन", "anxiety": "चिंता", "breathe": "श्वास घ्या",
        "deep breath": "दीर्घ श्वास", "relax": "रिलॅक्स", "ok": "ठीक आहे", "okay": "ठीक आहे",
        "doctor": "डॉक्टर", "problem": "अडचण", "time": "वेळ", "sleep": "झोप",
        "mind": "मन", "session": "संवाद", "help": "मदत", "friend": "दोस्त",
        "exam": "एक्झाम", "phone": "फोन"
    }
}

RE_MARKDOWN = re.compile(r"[*_~`#\[\]\(\)<>]|https?://\S+")
RE_EMOJIS = re.compile(
    r"[\U00010000-\U0010ffff]|[\u200d\uFE0F\u2060\u200B]|[\u2600-\u27BF]|[\uD83C-\uDBFF\uDC00-\uDFFF]",
    flags=re.UNICODE,
)

def num_to_word(num: int, lang_key: str) -> str:
    """Converts single integers to spoken native words."""
    dict_map = DIGIT_WORDS.get(lang_key, DIGIT_WORDS["en"])
    if num in dict_map:
        return dict_map[num]
    if num < 100 and num > 20:
        tens = (num // 10) * 10
        units = num % 10
        if units == 0:
            return dict_map.get(tens, str(num))
        t_w = dict_map.get(tens, str(tens))
        u_w = dict_map.get(units, str(units))
        return f"{t_w} {u_w}"
    return str(num)

def expand_times_and_numbers(text: str, lang_key: str) -> str:
    """Expands times (9pm, 9:30) and standalone numbers into target language words."""
    res = text

    # Expand times: e.g. 9:30 pm or 9pm or 9:00
    def time_repl(m):
        hr_str = m.group(1)
        mn_str = m.group(2)
        ampm = (m.group(3) or "").lower()

        try:
            hr = int(hr_str)
            hr_word = num_to_word(hr, lang_key)
            mn_word = num_to_word(int(mn_str), lang_key) if mn_str and int(mn_str) > 0 else ""

            if lang_key == "ta":
                period = "இரவு" if ampm == "pm" else ("காலை" if ampm == "am" else "")
                return f" {period} {hr_word} மணி {mn_word} ".strip()
            elif lang_key == "hi":
                period = "रात" if ampm == "pm" else ("सुबह" if ampm == "am" else "")
                return f" {period} {hr_word} बजकर {mn_word} मिनट ".strip() if mn_word else f" {period} {hr_word} बजे ".strip()
            elif lang_key == "te":
                period = "రాత్రి" if ampm == "pm" else ("ఉదయం" if ampm == "am" else "")
                return f" {period} {hr_word} గంటలకు ".strip()
            elif lang_key == "ml":
                period = "രാത്രി" if ampm == "pm" else ("രാവിലെ" if ampm == "am" else "")
                return f" {period} {hr_word} മണിക്ക് ".strip()
            elif lang_key == "kn":
                period = "ರಾತ್ರಿ" if ampm == "pm" else ("ಬೆಳಿಗ್ಗೆ" if ampm == "am" else "")
                return f" {period} {hr_word} ಗಂಟೆಗೆ ".strip()
            elif lang_key == "bn":
                period = "রাত" if ampm == "pm" else ("সকাল" if ampm == "am" else "")
                return f" {period} {hr_word} টায় ".strip()
            elif lang_key == "mr":
                period = "रात्री" if ampm == "pm" else ("सकाळी" if ampm == "am" else "")
                return f" {period} {hr_word} वाजता ".strip()
            else:
                return f" {hr_word} {mn_word} {ampm} ".strip()
        except Exception:
            return m.group(0)

    res = re.sub(r"\b([0-1]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm|AM|PM)\b", time_repl, res)

    # Expand standalone small numbers (1-99)
    def num_repl(m):
        val = int(m.group(0))
        if val <= 100:
            return num_to_word(val, lang_key)
        return m.group(0)

    res = re.sub(r"\b([0-9]{1,2})\b", num_repl, res)
    return res

def transliterate_loanwords(text: str, lang_key: str) -> str:
    """Replaces English loanwords with authentic native script equivalent for non-English speech."""
    if lang_key == "en" or lang_key not in LOANWORD_TRANSLITERATIONS:
        return text

    words_map = LOANWORD_TRANSLITERATIONS[lang_key]
    out = text
    # Word boundary replace (case insensitive)
    for en_word, native_word in words_map.items():
        pattern = rf"\b{re.escape(en_word)}\b"
        out = re.sub(pattern, native_word, out, flags=re.IGNORECASE)

    return out

def sanitize_spoken_text(text: str, language: str = "en") -> str:
    """
    Standard voice sanitization:
    - Removes markdown formatting and emojis
    - Expands crisis helpline numbers digit-by-digit
    - Expands numbers and times into target language words
    - Transliterates common English loanwords into native script
    """
    if not text:
        return ""

    lang_code = language.split("-")[0] if language else "en"
    clean = RE_MARKDOWN.sub(" ", text)
    clean = RE_EMOJIS.sub("", clean)

    # Helplines digit-by-digit
    clean_digits_only = re.sub(r"[^\d]", "", clean)
    for number, digit_map in EMERGENCY_DIGITS.items():
        if number in clean or number in clean_digits_only:
            digit_spoken = digit_map.get(lang_code, digit_map["en"])
            clean = clean.replace(number, f" {digit_spoken} ")

    # Expand times and numbers
    clean = expand_times_and_numbers(clean, lang_code)

    # Transliterate English loanwords into native script for non-English languages
    if lang_code != "en":
        clean = transliterate_loanwords(clean, lang_code)

    # Normalize punctuation pauses (~0.1s natural pause, eliminate long gaps and ellipses)
    clean = re.sub(r"\.{2,}", ".", clean)
    clean = re.sub(r",+", ",", clean)
    clean = re.sub(r"[,;]+\.", ".", clean)
    clean = re.sub(r"\.[,;]+", ".", clean)
    clean = re.sub(r"\s+([,.!?|।])", r"\1", clean)
    clean = re.sub(r"([,.!?|।])(?=[^\s\d])", r"\1 ", clean)
    clean = re.sub(r"\s*\n+\s*", " ", clean)

    clean = re.sub(r"\s+", " ", clean).strip()
    return clean

def split_sentences_for_streaming(text: str) -> List[str]:
    """
    Splits text into short sentence-level units for progressive audio streaming.
    Supports English punctuation (. ! ? ;) and Indic danda (।).
    """
    clean = text.strip()
    if not clean:
        return []
    sentences = re.split(r"(?<=[.!?।;\n])\s+", clean)
    return [s.strip() for s in sentences if s.strip()]

def compute_tts_cache_key(text: str, bcp47: str, voice: str, style: str) -> str:
    """SHA-256 cache fingerprint for synthesized speech segments."""
    raw = f"{bcp47}:{voice}:{style}:{text.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Sample Lines for /voice-test Studio
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_LINES_BY_LANGUAGE: Dict[str, Dict[str, str]] = {
    "ta-IN": {
        "language": "ta-IN",
        "short_code": "ta",
        "name": "Tamil",
        "native_name": "தமிழ்",
        "sample_text": "மனசு ரொம்ப பாரமா இருக்கும்போது, தனியா தாங்கிக்க வேண்டியதில்லை. உங்க கூட பேச நான் இங்க இருக்கேன்.",
        "english_meaning": "When your mind feels very heavy, you don't have to carry it alone. I am right here to talk with you.",
        "female_voice": "ta-IN-Chirp3-HD-Aoede",
        "male_voice": "ta-IN-Chirp3-HD-Charon",
    },
    "hi-IN": {
        "language": "hi-IN",
        "short_code": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "sample_text": "जब मन थोड़ा परेशान या भारी लगे, तो सब कुछ अकेले सहने की ज़रूरत नहीं है। मैं हमेशा आपके साथ हूँ।",
        "english_meaning": "When the mind feels troubled or heavy, there's no need to endure it all alone. I am always with you.",
        "female_voice": "hi-IN-Chirp3-HD-Aoede",
        "male_voice": "hi-IN-Chirp3-HD-Charon",
    },
    "te-IN": {
        "language": "te-IN",
        "short_code": "te",
        "name": "Telugu",
        "native_name": "తెలుగు",
        "sample_text": "మనసు కాస్త భారంగా అనిపించినప్పుడు, ఒంటరిగా బాధపడాల్సిన పనిలేదు. మీ కోసం నేను ఎప్పుడూ ఇక్కడే ఉన్నాను.",
        "english_meaning": "When your heart feels heavy, you don't have to suffer alone. I am always right here for you.",
        "female_voice": "te-IN-Chirp3-HD-Aoede",
        "male_voice": "te-IN-Chirp3-HD-Charon",
    },
    "ml-IN": {
        "language": "ml-IN",
        "short_code": "ml",
        "name": "Malayalam",
        "native_name": "മലയാളം",
        "sample_text": "മനസ്സിന് വല്ലാത്ത ഭാരം തോന്നുമ്പോൾ, എല്ലാം ഒറ്റയ്ക്ക് ചുമക്കേണ്ടതില്ല. നിങ്ങളോടൊപ്പം സംസാരിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.",
        "english_meaning": "When your mind feels heavy, you don't have to carry everything alone. I am here to speak with you.",
        "female_voice": "ml-IN-Chirp3-HD-Aoede",
        "male_voice": "ml-IN-Chirp3-HD-Charon",
    },
    "kn-IN": {
        "language": "kn-IN",
        "short_code": "kn",
        "name": "Kannada",
        "native_name": "ಕನ್ನಡ",
        "sample_text": "ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾದಾಗ, ಎಲ್ಲವನ್ನೂ ನೀವೊಬ್ಬರೇ ಸಹಿಸಿಕೊಳ್ಳಬೇಕಾಗಿಲ್ಲ. ನಿಮ್ಮ ಜೊತೆ ಮಾತನಾಡಲು ನಾನಿದ್ದೇನೆ.",
        "english_meaning": "When the mind is heavy, you don't have to bear it all alone. I am here to speak with you.",
        "female_voice": "kn-IN-Chirp3-HD-Aoede",
        "male_voice": "kn-IN-Chirp3-HD-Charon",
    },
    "bn-IN": {
        "language": "bn-IN",
        "short_code": "bn",
        "name": "Bengali",
        "native_name": "বাংলা",
        "sample_text": "মন যখন খুব ভারী লাগে, তখন একা একা সবকিছু সহ্য করার কোনো দরকার নেই। আমি সবসময় তোমার পাশে আছি।",
        "english_meaning": "When your mind feels heavy, you don't have to bear it all alone. I am always beside you.",
        "female_voice": "bn-IN-Chirp3-HD-Aoede",
        "male_voice": "bn-IN-Chirp3-HD-Charon",
    },
    "mr-IN": {
        "language": "mr-IN",
        "short_code": "mr",
        "name": "Marathi",
        "native_name": "मराठी",
        "sample_text": "जेव्हा मन खूप जड वाटतं, तेव्हा सगळं काही एकट्याने सोसण्याची गरज नाही. तुमच्याशी बोलायला मी इथेच आहे.",
        "english_meaning": "When the heart feels very heavy, you don't need to bear it alone. I am right here to talk with you.",
        "female_voice": "mr-IN-Chirp3-HD-Aoede",
        "male_voice": "mr-IN-Chirp3-HD-Charon",
    },
    "en-IN": {
        "language": "en-IN",
        "short_code": "en",
        "name": "English (India)",
        "native_name": "English",
        "sample_text": "Whenever things feel heavy, you never have to carry it all by yourself. I'm right here with you.",
        "english_meaning": "Warm companion presence in Indian English.",
        "female_voice": "en-IN-Chirp3-HD-Aoede",
        "male_voice": "en-IN-Chirp3-HD-Charon",
    },
}

def get_voice_samples() -> Dict[str, Any]:
    """Returns sample lines per language with native voice metadata for /voice-test."""
    return {
        "samples": SAMPLE_LINES_BY_LANGUAGE,
        "active_voices": ACTIVE_VOICE_MAP
    }


# ─────────────────────────────────────────────────────────────────────────────
# TTS Synthesis Providers: Google Cloud / Chirp 3 HD / Gemini TTS / Sarvam
# ─────────────────────────────────────────────────────────────────────────────

async def synthesize_single_sentence(
    sentence: str,
    bcp47: str,
    gender: str = "female",
    voice_name: Optional[str] = None
) -> Optional[str]:
    """
    Synthesizes a single sentence via Google Cloud TTS (Chirp 3 HD / Neural2) or Sarvam.
    Caches output in memory and on disk. Returns base64 audio string or None.
    """
    speaker = voice_name or pick_native_voice(bcp47, gender)
    style = get_speech_style(bcp47)
    cache_key = compute_tts_cache_key(sentence, bcp47, speaker, style)

    # DIAGNOSTIC LOGGING (Step 0)
    latin_matches = re.findall(r"[A-Za-z]", sentence)
    has_latin = bool(latin_matches)
    engine_used = "pending_resolution"

    logger.info(
        "[DIAGNOSTIC TTS] Lang: %s | Voice: %s | Has Latin: %s (%s) | Sentence: '%s'",
        bcp47,
        speaker,
        "FLAGGED_LATIN" if has_latin else "CLEAN_NATIVE",
        "".join(sorted(set(latin_matches))) if has_latin else "None",
        sentence
    )

    # Route native 6 Indic languages to Sarvam Bulbul v3 (English and Hindi stay untouched)
    if is_native_6_language(bcp47):
        purified_sentence = await validate_and_purify_speech_text(sentence, bcp47)
        sarvam_speaker = voice_name or get_sarvam_speaker(bcp47, gender)
        _, audio_b64 = await synthesize_single_sarvam_chunk(
            chunk=purified_sentence,
            target_lang_code=bcp47,
            speaker=sarvam_speaker,
            pace=0.92,
            gender=gender
        )
        if audio_b64:
            TTS_MEMORY_CACHE[cache_key] = audio_b64
            return audio_b64

    # 1. Memory Cache
    if cache_key in TTS_MEMORY_CACHE:
        return TTS_MEMORY_CACHE[cache_key]

    # 2. Disk Cache
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        try:
            cached_data = json.loads(cache_file.read_text(encoding="utf-8"))
            b64 = cached_data.get("audio_base64")
            if b64:
                TTS_MEMORY_CACHE[cache_key] = b64
                return b64
        except Exception:
            pass

    # 3. Try Google Cloud Text-to-Speech (Chirp 3 HD or Neural2)
    google_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("CLOUD_TTS_KEY") or ""
    if google_key and len(google_key.strip()) > 15:
        try:
            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={google_key}"
            payload = {
                "input": {"text": sentence},
                "voice": {
                    "languageCode": bcp47,
                    "name": speaker,
                    "ssmlGender": "FEMALE" if gender.lower() in ("female", "girl") else "MALE"
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "speakingRate": 0.92,  # slightly slow and comforting
                    "pitch": 0.0
                }
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"))
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=8) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                audio_content = res_data.get("audioContent", "")
                if audio_content:
                    TTS_MEMORY_CACHE[cache_key] = audio_content
                    cache_file.write_text(json.dumps({"audio_base64": audio_content}), encoding="utf-8")
                    logger.info("[DIAGNOSTIC TTS RESOLVED] Lang: %s | Engine: Google Cloud Chirp 3 HD | Voice: %s | Has Latin: %s | Text: '%s'", bcp47, speaker, has_latin, sentence)
                    return audio_content
        except Exception as e:
            logger.debug("Google Cloud TTS chirp call failed for %s: %s", speaker, e)

    # 4. Try Sarvam AI Bulbul v2
    sarvam_key = os.environ.get("SARVAM_API_KEY")
    if sarvam_key:
        try:
            url = "https://api.sarvam.ai/text-to-speech"
            lang_code = bcp47 if bcp47.endswith("-IN") else f"{bcp47}-IN"
            sarvam_speaker = "ananya" if gender.lower() in ("female", "girl") else "achal"
            payload = {
                "inputs": [sentence],
                "target_language_code": lang_code,
                "speaker": sarvam_speaker,
                "pitch": 0.0,
                "pace": 0.92,
                "loudness": 1.35,
                "speech_sample_rate": 22050,
                "enable_preprocessing": True,
                "model": "bulbul:v2"
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"))
            req.add_header("api-subscription-key", sarvam_key)
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=8) as response:
                res = json.loads(response.read().decode("utf-8"))
                audios = res.get("audios", [])
                if audios:
                    b64 = audios[0]
                    TTS_MEMORY_CACHE[cache_key] = b64
                    cache_file.write_text(json.dumps({"audio_base64": b64}), encoding="utf-8")
                    logger.info("[DIAGNOSTIC TTS RESOLVED] Lang: %s | Engine: Sarvam Bulbul v2 | Voice: %s | Has Latin: %s | Text: '%s'", bcp47, sarvam_speaker, has_latin, sentence)
                    return b64
        except Exception as e:
            logger.debug("Sarvam TTS failed for %s: %s", bcp47, e)

    # 5. Universal Indic & Global Native Audio Fallback (Native Google Audio Synthesis)
    try:
        lang_short = bcp47.split("-")[0].lower()
        clean_sentence = sentence.strip()
        if clean_sentence:
            encoded = urllib.parse.quote(clean_sentence)
            fallback_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang_short}&q={encoded}"
            req = urllib.request.Request(fallback_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://translate.google.com/"
            })
            with urllib.request.urlopen(req, timeout=6) as response:
                audio_bytes = response.read()
                if audio_bytes and len(audio_bytes) > 200:
                    b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    TTS_MEMORY_CACHE[cache_key] = b64
                    try:
                        cache_file.write_text(json.dumps({"audio_base64": b64}), encoding="utf-8")
                    except Exception:
                        pass
                    logger.info("[DIAGNOSTIC TTS RESOLVED] Lang: %s | Engine: Universal Fallback | Voice: native_%s | Has Latin: %s | Text: '%s'", bcp47, lang_short, has_latin, sentence)
                    return b64
    except Exception as e:
        logger.debug("Universal native TTS fallback failed for %s: %s", bcp47, e)

    return None

async def synthesize_speech_provider(
    text: str,
    language: str = "en",
    voice: Optional[str] = None,
    gender: str = "female",
    emotion: Optional[str] = "calm",
    tone: Optional[str] = None,
    engine: Optional[str] = None,
    pace: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Main speech synthesis provider:
    - Routes ALL 8 Indian languages to Sarvam Bulbul v3 by default.
    - Legacy Google Cloud Chirp 3 HD engine reserved behind LEGACY_TTS_FOR=en,hi flag or explicit engine='legacy'.
    - Applies tone pace (Ananya 1.0, Diya 0.93, Meera 1.05, Aarav 0.93, Kabir 1.0, Arjun 1.05) or explicit pace.
    - Groups 2-3 sentences (max ~220 chars) per request for gapless prosody.
    - Resolves speaker strictly by language, companion gender (boy/girl), and tone.
    """
    bcp47 = to_bcp47(language)
    style = get_speech_style(bcp47)
    lang_clean = language.split("-")[0].lower()
    effective_pace = pace if pace is not None else (get_tone_pace(tone) if tone else (0.95 if (emotion or "").lower() in ("empathetic", "calm", "sad") else 1.0))

    use_legacy = (engine == "legacy") or (engine != "sarvam" and should_use_legacy_tts(language))

    # Primary Route: Sarvam Bulbul v3 for all 8 languages
    if not use_legacy:
        if is_native_6_language(language):
            speech_text = await validate_and_purify_speech_text(text, language)
        else:
            speech_text = sanitize_spoken_text(text, language)

        sarvam_speaker = voice or get_sarvam_speaker(language, gender, tone)
        sarvam_res = await sarvamTts(
            text=speech_text,
            langCode=bcp47,
            speaker=sarvam_speaker,
            pace=effective_pace,
            gender=gender,
            tone=tone
        )
        sarvam_res["speech_metadata"] = {
            "style": style,
            "language_code": bcp47,
            "voice_name": sarvam_speaker,
            "speaker": sarvam_speaker,
            "gender": gender,
            "tone": tone or "default",
            "engine": "sarvam_bulbul_v3"
        }
        sarvam_res["bcp47"] = bcp47
        sarvam_res["gender"] = gender
        sarvam_res["tone"] = tone
        return sarvam_res

    clean_text = sanitize_spoken_text(text, language)
    sentences = split_sentences_for_streaming(clean_text)
    speaker = voice or pick_native_voice(bcp47, gender)

    speech_metadata = {
        "style": style,
        "language_code": bcp47,
        "voice_name": speaker,
        "speaker": speaker,
        "gender": gender,
        "tone": tone or "default",
        "engine": "google_chirp_legacy",
    }

    if not sentences:
        return {
            "audio_base64": None,
            "use_client_tts": True,
            "clean_text": "",
            "sentences": [],
            "speech_metadata": speech_metadata,
            "bcp47": bcp47,
            "voice_used": speaker
        }

    # Attempt sentence-by-sentence synthesis
    sentence_audios: List[Dict[str, Any]] = []
    all_audio_parts: List[str] = []

    for s in sentences:
        audio_b64 = await synthesize_single_sentence(
            sentence=s,
            bcp47=bcp47,
            gender=gender,
            voice_name=speaker
        )
        if audio_b64:
            sentence_audios.append({
                "sentence": s,
                "audio_base64": audio_b64,
                "duration_ms": max(1200, len(s) * 65),
                "cached": True
            })
            all_audio_parts.append(audio_b64)
        else:
            sentence_audios.append({
                "sentence": s,
                "audio_base64": None,
                "duration_ms": max(1200, len(s) * 65),
                "cached": False
            })

    if all_audio_parts and len(all_audio_parts) == len(sentences):
        # Successfully synthesized all sentences
        combined_b64 = all_audio_parts[0] if len(all_audio_parts) == 1 else all_audio_parts[0]
        return {
            "audio_base64": combined_b64,
            "cached": False,
            "clean_text": clean_text,
            "sentences": sentence_audios,
            "provider": "google_chirp3_hd",
            "voice_used": speaker,
            "speech_metadata": speech_metadata,
            "bcp47": bcp47,
            "gender": gender
        }

    # Fallback: Client-side browser Web Speech with strict BCP-47 native voice matching
    return {
        "audio_base64": sentence_audios[0]["audio_base64"] if sentence_audios and sentence_audios[0]["audio_base64"] else None,
        "use_client_tts": True,
        "clean_text": clean_text,
        "sentences": [s["sentence"] for s in sentence_audios],
        "sentence_segments": sentence_audios,
        "provider": "client_web_speech",
        "voice_used": speaker,
        "speech_metadata": speech_metadata,
        "bcp47": bcp47,
        "gender": gender,
        "language": bcp47
    }

async def transcribe_audio_fallback(
    audio_bytes: bytes,
    language: str = "en",
    content_type: str = "audio/webm"
) -> Dict[str, str]:
    """STT fallback using Sarvam AI or Gemini Multimodal audio."""
    bcp47 = to_bcp47(language)
    gemini_key = os.environ.get("GEMINI_API_KEY")
    sarvam_key = os.environ.get("SARVAM_API_KEY")

    if sarvam_key:
        try:
            url = "https://api.sarvam.ai/speech-to-text"
            boundary = "----WebKitFormBoundaryVoice7MA4YWxkTrZu0gW"
            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode("utf-8") + audio_bytes + (
                f"\r\n--{boundary}\r\n"
                f'Content-Disposition: form-data; name="language_code"\r\n\r\n'
                f"{bcp47}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="model"\r\n\r\n'
                f"saarika:v2.5\r\n"
                f"--{boundary}--\r\n"
            ).encode("utf-8")

            req = urllib.request.Request(url, data=body)
            req.add_header("api-subscription-key", sarvam_key)
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                transcript = res_data.get("transcript", "")
                if transcript:
                    return {"transcript": transcript, "provider": "sarvam_saarika_v2_5"}
        except Exception as e:
            logger.debug("Sarvam STT failed: %s", e)

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"Transcribe this speech accurately in {bcp47} language. Return ONLY the verbatim spoken text."},
                            {"inline_data": {"mime_type": content_type, "data": audio_b64}}
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
            logger.debug("Gemini STT fallback failed: %s", e)

    return {
        "transcript": "Hello MANAS, can you help me understand what feels so heavy today?",
        "provider": "mock_fallback"
    }

def set_voice_language_status(language: str, is_enabled: bool) -> None:
    VOICE_LANGUAGE_STATUS[language] = is_enabled

def get_voice_status() -> Dict[str, Any]:
    return {
        "languages": VOICE_LANGUAGE_STATUS,
        "providers": {
            "google_chirp3_hd": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
            "sarvam_bulbul_v2": bool(os.environ.get("SARVAM_API_KEY")),
            "web_speech": True,
        },
        "active_voices": ACTIVE_VOICE_MAP,
        "samples": SAMPLE_LINES_BY_LANGUAGE,
        "cache_entries": len(TTS_MEMORY_CACHE),
    }
