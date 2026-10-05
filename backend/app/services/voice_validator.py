"""
voice_validator.py - Native Script Validation & Spoken Dialect Purity
─────────────────────────────────────────────────────────────────────────────
Targeted for the 6 Indic Native Languages:
- Tamil (ta): Chennai spoken Tamil
- Telugu (te): Spoken Telugu
- Kannada (kn): Bengaluru spoken Kannada
- Malayalam (ml): Spoken Malayalam
- Bengali (bn): Kolkata colloquial (cholito)
- Marathi (mr): Pune spoken Marathi

Validation rules:
1. Strips markdown, emojis, URLs.
2. Converts digits (0-100+) to native language words.
3. Conversational loanwords (exam, phone, stress, doctor, okay, time, relax, etc.)
   are represented in native script (e.g. ஸ்ட்ரெஸ், எக்ஸாம், டாக்டர், போன்) so
   native voice synthesizers pronounce them naturally.
4. If [A-Za-z] is detected, runs ONE quick rewrite call to gemini-3.8-flash
   (thinking LOW) to rewrite in 100% native script with spoken dialect.
5. If any Latin characters remain as last resort, transliterates them.
"""

import os
import re
import json
import logging
from typing import Dict, Any, Optional
import httpx

from .voice_config import is_native_6_language

logger = logging.getLogger("manas.voice_validator")

# Regex cleaners
RE_MARKDOWN = re.compile(r"[*_~`#\[\]\(\)<>]|https?://\S+")
RE_EMOJIS = re.compile(
    r"[\U00010000-\U0010ffff]|[\u200d\uFE0F\u2060\u200B]|[\u2600-\u27BF]|[\uD83C-\uDBFF\uDC00-\uDFFF]",
    flags=re.UNICODE,
)
RE_LATIN = re.compile(r"[A-Za-z]")

# Spoken style labels for rewrite instructions
DIALECT_TARGETS: Dict[str, str] = {
    "ta": "Chennai spoken Tamil (சென்னை பேச்சுத் தமிழ்)",
    "te": "Spoken Telugu (వాడుక తెలుగు)",
    "kn": "Bengaluru spoken Kannada (ಬೆಂಗಳೂರು ಆಡುಮಾತು ಕನ್ನಡ)",
    "ml": "Spoken Malayalam (സ്വാഭാവിക സംസാര ഭാഷ)",
    "bn": "Kolkata colloquial Bengali (কলকাতা চলিত কথ্য বাংলা)",
    "mr": "Pune spoken Marathi (पुणेरी बोलचालची मराठी)"
}

# Everyday loanwords natively written in regional script
NATURAL_SCRIPT_LOANWORDS: Dict[str, Dict[str, str]] = {
    "ta": {
        "stress": "ஸ்ட்ரெஸ்", "tension": "டென்ஷன்", "anxiety": "ஆன்ஸைட்டி",
        "exam": "எக்ஸாம்", "exams": "எக்ஸாம்ஸ்", "phone": "போன்", "mobile": "மொபைல்",
        "doctor": "டாக்டர்", "relax": "ரிலாக்ஸ்", "breathe": "மூச்சு விடுங்க",
        "deep breath": "ஆழ்ந்த மூச்சு", "ok": "சரி", "okay": "சரி",
        "time": "டைம்", "sleep": "தூக்கம்", "mind": "மனசு", "problem": "ப்ராப்ளம்",
        "session": "செஷன்", "help": "ஹெல்ப்", "friend": "நண்பா", "friends": "பிரெண்ட்ஸ்"
    },
    "te": {
        "stress": "స్ట్రెస్", "tension": "టెన్షన్", "anxiety": "యాంగ్జైటీ",
        "exam": "ఎగ్జామ్", "exams": "ఎగ్జామ్స్", "phone": "ఫోన్", "mobile": "మొబైల్",
        "doctor": "డాక్టర్", "relax": "రిలాక్స్", "breathe": "శ్వాస తీసుకోండి",
        "deep breath": "దీర్ఘ శ్వాస", "ok": "సరే", "okay": "సరే",
        "time": "టైమ్", "sleep": "నిద్ర", "mind": "మనసు", "problem": "ప్రాబ్లమ్",
        "session": "సెషన్", "help": "హెల్ప్", "friend": "ఫ్రెండ్", "friends": "ఫ్రెండ్స్"
    },
    "kn": {
        "stress": "ಸ್ಟ್ರೆಸ್", "tension": "ಟೆನ್ಷನ್", "anxiety": "ಆಂಗ್ಸೈಟಿ",
        "exam": "ಎಕ್ಸಾಂ", "exams": "ಎಕ್ಸಾಮ್ಸ್", "phone": "ಫೋನ್", "mobile": "ಮೊಬೈಲ್",
        "doctor": "ಡಾಕ್ಟರ್", "relax": "ರಿಲ್ಯಾಕ್ಸ್", "breathe": "ಉಸಿರಾಟ ಮಾಡಿ",
        "deep breath": "ದೀರ್ಘ ಉಸಿರು", "ok": "ಸರಿ", "okay": "ಸರಿ",
        "time": "ಟೈಮ್", "sleep": "ನಿದ್ರೆ", "mind": "ಮನಸ್ಸು", "problem": "ಪ್ರಾಬ್ಲಮ್",
        "session": "ಸೆಷನ್", "help": "ಹೆಲ್ಪ್", "friend": "ಫ್ರೆಂಡ್", "friends": "ಫ್ರೆಂಡ್ಸ್"
    },
    "ml": {
        "stress": "സ്ട്രെസ്സ്", "tension": "ടെൻഷൻ", "anxiety": "ആങ്സൈറ്റി",
        "exam": "എക്സാം", "exams": "എക്സാംസ്", "phone": "ഫോൺ", "mobile": "മൊബൈൽ",
        "doctor": "ഡോക്ടർ", "relax": "റിലാക്സ്", "breathe": "ശ്വാസമെടുക്കൂ",
        "deep breath": "ദീർഘശ്വാസം", "ok": "ശരി", "okay": "ശരി",
        "time": "ടൈം", "sleep": "ഉറക്കം", "mind": "മനസ്സ്", "problem": "പ്രോബ്ലം",
        "session": "സെഷൻ", "help": "ഹെൽപ്പ്", "friend": "ഫ്രണ്ട്", "friends": "ഫ്രണ്ട്സ്"
    },
    "bn": {
        "stress": "স্ট্রেস", "tension": "টেনশন", "anxiety": "অ্যাংজাইটি",
        "exam": "এক্সাম", "exams": "এক্সামস", "phone": "ফোন", "mobile": "মোবাইল",
        "doctor": "ডাক্তার", "relax": "রিল্যাক্স", "breathe": "শ্বাস নাও",
        "deep breath": "গভীর শ্বাস", "ok": "ঠিক আছে", "okay": "ঠিক আছে",
        "time": "টাইম", "sleep": "ঘুম", "mind": "মন", "problem": "প্রবলেম",
        "session": "সেশন", "help": "হেল্প", "friend": "বন্ধু", "friends": "ফ্রেন্ডস"
    },
    "mr": {
        "stress": "स्ट्रेस", "tension": "टेंशन", "anxiety": "अँग्झायटी",
        "exam": "एक्झाम", "exams": "एक्झाम्स", "phone": "फोन", "mobile": "मोबाइल",
        "doctor": "डॉक्टर", "relax": "रिलॅक्स", "breathe": "श्वास घ्या",
        "deep breath": "दीर्घ श्वास", "ok": "ठीक आहे", "okay": "ठीक आहे",
        "time": "टाइम", "sleep": "झोप", "mind": "मन", "problem": "प्रॉब्लेम",
        "session": "सत्र", "help": "मदत", "friend": "दोस्त", "friends": "फ्रेंड्स"
    }
}

# Digits to native words
DIGIT_MAP: Dict[str, Dict[int, str]] = {
    "ta": {
        0: "பூஜ்ஜியம்", 1: "ஒன்று", 2: "இரண்டு", 3: "மூன்று", 4: "நான்கு", 5: "ஐந்து",
        6: "ஆறு", 7: "ஏழு", 8: "எட்டு", 9: "ஒன்பது", 10: "பத்து", 11: "பதினொன்று",
        12: "பன்னிரண்டு", 15: "பதினைந்து", 20: "இருபது", 25: "இருபத்தைந்து",
        30: "முப்பது", 40: "நாற்பது", 50: "ஐம்பது", 100: "நூறு"
    },
    "te": {
        0: "సున్నా", 1: "ఒకటి", 2: "రెండు", 3: "మూడు", 4: "నాలుగు", 5: "ఐదు",
        6: "ఆరు", 7: "ఏడు", 8: "ఎనిమిది", 9: "తొమ్మిది", 10: "పది", 11: "పదకొండు",
        12: "పన్నెండు", 15: "పదిహేను", 20: "ఇరవై", 25: "ఇరవై ఐదు",
        30: "ముప్పై", 40: "నలభై", 50: "యాభై", 100: "వంద"
    },
    "kn": {
        0: "ಸೊನ್ನೆ", 1: "ಒಂದು", 2: "ಎರಡು", 3: "ಮೂರು", 4: "ನಾಲ್ಕು", 5: "ಐದು",
        6: "ಆರು", 7: "ಏಳು", 8: "ಎಂಟು", 9: "ಒಂಬತ್ತು", 10: "ಹತ್ತು", 11: "ಹನ್ನೊಂದು",
        12: "ಹನ್ನೆರಡು", 15: "ಹದಿನೈದು", 20: "ಇಪ್ಪತ್ತು", 25: "ಇಪ್ಪತ್ತೈದು",
        30: "ಮೂವತ್ತು", 40: "ನಲವತ್ತು", 50: "ಐವತ್ತು", 100: "ನೂರು"
    },
    "ml": {
        0: "പൂജ്യം", 1: "ഒന്ന്", 2: "രണ്ട്", 3: "മൂന്ന്", 4: "നാല്", 5: "അഞ്ച്",
        6: "ആറ്", 7: "ഏഴ്", 8: "എട്ട്", 9: "ഒൻപത്", 10: "പത്ത്", 11: "പതിനൊന്ന്",
        12: "പന്ത്രണ്ട്", 15: "പതിനഞ്ച്", 20: "ഇരുപത്", 25: "ഇരുപത്തിയഞ്ച്",
        30: "മുപ്പത്", 40: "നാല്പത്", 50: "അമ്പത്", 100: "നൂറ്"
    },
    "bn": {
        0: "শূন্য", 1: "এক", 2: "দুই", 3: "তিন", 4: "চার", 5: "পাঁচ",
        6: "ছয়", 7: "সাত", 8: "আট", 9: "নয়", 10: "দশ", 11: "এগারো",
        12: "বারো", 15: "পনেরো", 20: "কুড়ি", 25: "পঁচিশ",
        30: "তিরিশ", 40: "চল্লিশ", 50: "পঞ্চাশ", 100: "একশো"
    },
    "mr": {
        0: "शून्य", 1: "एक", 2: "दोन", 3: "तीन", 4: "चार", 5: "पाच",
        6: "सहा", 7: "सात", 8: "आठ", 9: "नऊ", 10: "दहा", 11: "अकरा",
        12: "बारा", 15: "पंधरा", 20: "वीस", 25: "पंचवीस",
        30: "तीस", 40: "चाळीस", 50: "पन्नास", 100: "शंभर"
    }
}

# Simple phonetic fallback mapping if single English words escape rewrite
FALLBACK_PHONETIC: Dict[str, Dict[str, str]] = {
    "ta": {
        "hey": "ஹேய்", "hi": "ஹாய்", "hello": "ஹலோ", "ok": "சரி",
        "yeah": "ஆமா", "yes": "ஆம்", "no": "இல்லை"
    },
    "te": {
        "hey": "హేయ్", "hi": "హాయ్", "hello": "హలో", "ok": "సరే",
        "yeah": "అవును", "yes": "అవును", "no": "కాదు"
    },
    "kn": {
        "hey": "ಹೇಯ್", "hi": "ಹಾಯ್", "hello": "ಹಲೋ", "ok": "ಸರಿ",
        "yeah": "ಹೌದು", "yes": "ಹೌದು", "no": "ಇಲ್ಲ"
    },
    "ml": {
        "hey": "ഹേയ്", "hi": "ഹായ്", "hello": "ഹലോ", "ok": "ശരി",
        "yeah": "അതെ", "yes": "അതെ", "no": "അല്ല"
    },
    "bn": {
        "hey": "হেই", "hi": "হাই", "hello": "হ্যালো", "ok": "ঠিক আছে",
        "yeah": "হ্যাঁ", "yes": "হ্যাঁ", "no": "না"
    },
    "mr": {
        "hey": "हे", "hi": "हाय", "hello": "हॅलो", "ok": "ठीक आहे",
        "yeah": "हो", "yes": "हो", "no": "नाही"
    }
}

def convert_digits_to_words(text: str, lang_code: str) -> str:
    """Converts standalone digits in text to native words."""
    if lang_code not in DIGIT_MAP:
        return text

    d_map = DIGIT_MAP[lang_code]
    def _repl(m):
        try:
            val = int(m.group(0))
            if val in d_map:
                return f" {d_map[val]} "
            if val < 100:
                tens = (val // 10) * 10
                units = val % 10
                t_str = d_map.get(tens, str(tens))
                u_str = d_map.get(units, str(units))
                return f" {t_str} {u_str} "
        except Exception:
            pass
        return m.group(0)

    return re.sub(r"\b\d{1,3}\b", _repl, text)

def apply_script_loanwords(text: str, lang_code: str) -> str:
    """Replaces common spoken loanwords with their native-script representations."""
    if lang_code not in NATURAL_SCRIPT_LOANWORDS:
        return text

    words = NATURAL_SCRIPT_LOANWORDS[lang_code]
    out = text
    for en, native in words.items():
        pattern = rf"\b{re.escape(en)}\b"
        out = re.sub(pattern, native, out, flags=re.IGNORECASE)
    return out

async def quick_gemini_native_rewrite(text: str, language: str) -> str:
    """
    Executes ONE quick rewrite call to gemini-3.8-flash (thinking LOW):
    'Rewrite fully in {language} script, spoken style, no Latin letters'
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    if not api_key:
        return text

    lang_code = language.split("-")[0].lower()
    dialect = DIALECT_TARGETS.get(lang_code, lang_code)
    prompt = (
        f"You are a native conversational editor. Rewrite the following text strictly into pure {dialect}.\n"
        f"MANDATORY REQUIREMENTS:\n"
        f"1. 100% in {dialect} native script. ABSOLUTELY ZERO Latin letters ([A-Za-z]) and ZERO English phrases.\n"
        f"2. Write in a warm, friendly, natural everyday spoken style the way a young local speaks to a close friend.\n"
        f"3. If people commonly use an English loanword (exam, phone, stress, doctor), write it phonetically in the native script (e.g. Tamil ஸ்ட்ரெஸ், Telugu స్ట్రెస్, Bengali স্ট্রেস).\n"
        f"4. Return ONLY the rewritten text, with no explanations, quotes, or JSON.\n\n"
        f"Input Text:\n{text.strip()}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 300,
            "thinkingConfig": {
                "thinkingLevel": "LOW"
            }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=4.5) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        rewritten = parts[0]["text"].strip()
                        # Clean any surrounding quotes
                        rewritten = re.sub(r'^["\']|["\']$', '', rewritten)
                        return rewritten
    except Exception as e:
        logger.debug("Quick Gemini native rewrite failed: %s", e)

    return text

def apply_last_resort_transliteration(text: str, lang_code: str) -> str:
    """As an absolute last resort, transliterates any lingering Latin words or removes them."""
    if lang_code in FALLBACK_PHONETIC:
        for en, native in FALLBACK_PHONETIC[lang_code].items():
            text = re.sub(rf"\b{re.escape(en)}\b", native, text, flags=re.IGNORECASE)

    # If any Latin letters remain, strip single dangling Latin characters or replace
    text = re.sub(r"\b[A-Za-z]{1,2}\b", "", text)
    # Remove any remaining Latin characters
    text = re.sub(r"[A-Za-z]+", "", text)
    return re.sub(r"\s+", " ", text).strip()

async def validate_and_purify_speech_text(
    speech_text: str,
    language: str
) -> str:
    """
    Full Validator Pipeline for Speech Text:
    - Only applies strict native rules to the 6 target languages: ta, te, kn, ml, bn, mr.
    - English and Hindi are left untouched.
    - If Latin letters exist in target languages:
      1. Converts loanwords to native script
      2. Converts digits to native words
      3. Calls Gemini rewrite if Latin remains
      4. Re-validates and applies last-resort cleanup
    """
    if not speech_text or not speech_text.strip():
        return ""

    lang_code = language.split("-")[0].lower()
    if not is_native_6_language(lang_code):
        # English, Hindi and other non-target languages untouched
        return speech_text.strip()

    # Step 1: Strip markdown, emojis, URLs
    clean = RE_MARKDOWN.sub(" ", speech_text)
    clean = RE_EMOJIS.sub("", clean)

    # Step 2: Convert digits to native words
    clean = convert_digits_to_words(clean, lang_code)

    # Step 3: Replace common conversational loanwords with native script equivalents
    clean = apply_script_loanwords(clean, lang_code)
    clean = re.sub(r"\s+", " ", clean).strip()

    # Step 4: Check for Latin letters [A-Za-z]
    if RE_LATIN.search(clean):
        logger.info("[VOICE VALIDATOR] Flagged Latin letters in %s text: '%s'. Executing Gemini LOW rewrite...", lang_code, clean)
        rewritten = await quick_gemini_native_rewrite(clean, lang_code)
        if rewritten and rewritten.strip():
            clean = rewritten.strip()
            # Post-rewrite clean: re-convert any digits or loanwords
            clean = convert_digits_to_words(clean, lang_code)
            clean = apply_script_loanwords(clean, lang_code)

    # Step 5: Last-resort fallback if Latin characters still linger
    if RE_LATIN.search(clean):
        logger.warning("[VOICE VALIDATOR] Latin characters lingered after rewrite for %s. Applying last-resort transliteration/filter.", lang_code)
        clean = apply_last_resort_transliteration(clean, lang_code)

    return clean.strip()
