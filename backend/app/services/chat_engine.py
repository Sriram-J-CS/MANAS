"""
chat_engine.py - Advanced empathetic mental health chat engine.

Features:
  1. SAFETY FIRST: Strict crisis detection across English, Tamil, Hindi, Telugu, Kannada, Malayalam,
     Tanglish, and Hinglish. High/imminent risk immediately routes to verified 24/7 helplines (Tele-MANAS, KIRAN, 112).
  2. PHASE 1 UNDERSTANDING PIPELINE: Two passes per user message:
     - Pass A (hidden, fast, JSON): primary & secondary emotions, intensity 1-5, underlying need (vent, comfort,
       advice, perspective, practical_help, just_be_heard), topics, cognitive distortions, triggers/people, what helped,
       risk level, language, user readiness (not_ready, exploring, ready_for_action).
     - Pass B (visible reply): Conditioned strictly on Pass A and the assigned strategy.
  3. PHASE 2 RESPONSE STRATEGY:
     - ONE primary strategy from the ESConv set: reflect feelings, ask an open question, affirm/normalize,
       offer a reframe, give information, suggest one small step, offer a grounding exercise.
     - Stage model: explore first, gain insight second, action last. Never jump to advice when need=vent or readiness=not_ready.
     - Motivational-interviewing style (OARS): max 1 question, 2-5 sentences, plain spoken language, user's language.
     - Specificity: References exact user words. Forbidden clichés, diagnosing, therapist claims, medication advice.
     - Anti-repetition: Pass last 6 bot replies, calculate 3-gram similarity, regenerate once if > 0.6, track strategy rotation.
  4. PHASE 3 KNOWLEDGE + MEMORY:
     - RAG with natural paraphrasing (never dump raw text or bullet points).
     - Long-term memory: Extract 3-5 facts (worries, people, goals, what helped); retrieve top 5 per turn.
"""

import asyncio
import json
import logging
import os
import re
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

import httpx

from ..database import get_db
from .rag import retrieve_relevant_knowledge, format_knowledge_for_prompt

log = logging.getLogger("chat_engine")

MAX_MESSAGE_CHARS = 2000
HISTORY_TURNS = 12

# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------
PERSONAS = {
    "digital_twin": {
        "name": "Your Inner Wise Self",
        "description": "The user's compassionate, grounded future self. Talks to them the way they would give loving, clear-headed advice to themselves.",
        "voice": "compassionate-introspective",
    },
    "boy": {
        "name": "Arun (3D Companion)",
        "description": "A warm, thoughtful, relatable 3D animated companion who listens deeply and supports you like a trusted peer.",
        "voice": "warm-friendly",
    },
    "girl": {
        "name": "Meera (3D Companion)",
        "description": "An observant, empathetic, calming 3D animated companion who holds space without judgment and brings gentle light.",
        "voice": "calming-gentle",
    },
    "mascot": {
        "name": "MANAS Living Mascot",
        "description": "A mindful cyber-physical affective companion tuned to emotional grounding and breath pacing.",
        "voice": "soothing-mindful",
    },
}

ALLOWED_AVATAR_EMOTIONS = {"neutral", "happy", "concerned", "sad", "surprised"}
ALLOWED_GESTURES = {"wave", "nod", "thumbs_up", "breathe", "listening"}
ALLOWED_EXERCISES = {"breathing_4_7_8", "grounding_54321", "none"}
LEXICON_EMOTIONS = ["anxiety", "sadness", "anger", "stressed", "joy", "relief", "curiosity", "neutral"]

# ===========================================================================
# 1. CRISIS DETECTION & SAFETY FIRST
# ===========================================================================
RISK_ORDER = {"none": 0, "low": 1, "moderate": 2, "medium": 2, "high": 3, "imminent": 4}


def _max_risk(a: str, b: str) -> str:
    return a if RISK_ORDER.get(a, 0) >= RISK_ORDER.get(b, 0) else b


_HIGH_EN = [
    r"\bkill(?:ing)? my ?self\b",
    r"\bend(?:ing)? my (?:own )?life\b",
    r"\b(?:take|taking) my own life\b",
    r"\bwant(?:ed|s)? to die\b",
    r"\bwanna die\b",
    r"\bwish (?:i|that i) (?:was|were|could be) (?:dead|never born)\b",
    r"\bwish i (?:was|were) never born\b",
    r"\brather be dead\b",
    r"\b(?:don'?t|do not|dont) (?:want|wanna) to (?:live|be alive|exist|be here)\b",
    r"\bno (?:reason|point) (?:to|in) (?:live|living|going on|being alive|life)\b",
    r"\bbetter off (?:dead|without me)\b",
    r"\b(?:hurt|harm|cut|injure|burn) my ?self\b",
    r"\b(?:hurting|harming|cutting|injuring|burning) my ?self\b",
    r"\bself[- ]?harm\w*\b",
    r"\bsuicidal\b",
    r"\bcommit(?:ting)? suicide\b",
    r"\bend it all\b",
    r"\b(?:tired|sick) of (?:living|being alive)\b",
]

_MEDIUM_EN = [
    r"\bsuicid\w*",
    r"\bsucide\b",
    r"\bsuiside\b",
    r"\boverdos\w*",
    r"\bhopeless\w*",
    r"\bno (?:point|purpose) in (?:anything|life|trying|studying|going on|living)\b",
    r"\bwhat'?s the point\b",
    r"\bgive up on (?:life|everything)\b",
    r"\bcan'?t (?:go on|take (?:it|this) anymore|do this anymore|handle (?:it|this) anymore)\b",
    r"\b(?:i'?m|i am|feel(?:ing)?|like) (?:a )?(?:burden|worthless|useless)\b",
    r"\bnobody (?:would|will) (?:care|miss me|notice)\b",
    r"\b(?:want|wish)(?:ed)? (?:to|i could) (?:disappear|vanish)\b",
    r"\bdon'?t want to wake up\b",
    r"\bwish i (?:could )?(?:sleep forever|not wake up)\b",
    r"\bhate myself\b",
    r"\bkms\b",
]

_HIGH_RX = [re.compile(p, re.I) for p in _HIGH_EN]
_MEDIUM_RX = [re.compile(p, re.I) for p in _MEDIUM_EN]

_HIGH_SUBSTR = [
    # Tamil
    "தற்கொலை", "சாக வேண்டும்", "சாகணும்", "சாக விரும்பு", "சாக ஆசை", "செத்து விடலாம்",
    "செத்துவிடலாம்", "செத்துடலாம்", "உயிரை மாய்", "வாழ பிடிக்கவில்லை", "வாழ விருப்பம் இல்லை",
    "என்னை நானே காயப்படுத்த", "சாகப் போகிறேன்", "செத்துடுவேன்", "செத்துருவேன்",
    # Tanglish
    "thatkolai", "tharkolai", "saaganum", "saganum", "saaga venum", "sethudalam", "seththudalam",
    "sethuduven", "saga poren", "saaga poren", "vaazha pidikala", "vazha pidikala",
    # Hindi / Marathi
    "आत्महत्या", "खुदकुशी", "मरना चाहता", "मरना चाहती", "मर जाना चाहता", "मर जाना चाहती",
    "मर जाऊं", "मर जाऊँ", "जीना नहीं चाहता", "जीना नहीं चाहती", "जीने का मन नहीं",
    "जीने की इच्छा नहीं", "खुद को खत्म", "खुद को खतम", "खुद को चोट", "खुद को नुकसान पहुं",
    "जान दे दू",
    # Hinglish
    "marna chahta", "marna chahti", "mar jana chahta", "mar jaana chahta", "mar jau", "mar jaun",
    "khudkushi", "khudkhushi", "aatmahatya", "suicide karna", "jeena nahi chahta",
    "jeena nahi chahti", "jeene ka mann nahi", "jeene ka mann nhi", "jeene ka man nahi",
    "khud ko khatam", "khud ko nuksan",
    # Telugu
    "ఆత్మహత్య", "చనిపోవాలని ఉంది", "చనిపోతాను", "బతకాలని లేదు", "ప్రాణం తీసుకోవాలి",
    "chavalanipisthondi", "chavalani vundi", "bathakalani ledu", "aatmahatya",
    # Kannada
    "ಆತ್ಮಹತ್ಯೆ", "ಸಾಯಬೇಕು ಅನಿಸುತ್ತಿದೆ", "ಸಾಯಲು ಬಯಸುತ್ತೇನೆ", "ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ", "ಪ್ರಾಣ ಕಳೆದುಕೊಳ್ಳಲು",
    "sayabeku anisuthide", "badukalu ishtavilla", "aatmahatye",
    # Malayalam
    "ആത്മഹത്യ", "മരിക്കണം എന്ന് തോന്നുന്നു", "മരിക്കാൻ ആഗ്രഹം", "ജീവിക്കാൻ താല്പര്യമില്ല", "എന്നെത്തന്നെ ഉപദ്രവിക്കാൻ",
    "marikkanam", "marikkan thonunnu", "jevikkan thalparyamilla", "aathmahathya",
    # Bengali / Gujarati / Punjabi
    "আত্মহত্যা", "આત્મહત્યા", "ਖੁਦਕੁਸ਼ੀ",
]

_NEGATION_RX = re.compile(
    r"(?:\b(?:not|never|no|without|nor|neither|hardly|isn'?t|wasn'?t|aren'?t|don'?t|dont|didn'?t|"
    r"won'?t|wouldn'?t)\b|n't\b)[^.!?]{0,22}$"
)
_PAST_RX = re.compile(r"\b(?:used to|years ago|months ago|back then|in the past|when i was)\b[^.!?]{0,30}$")


def _scan(patterns: List[re.Pattern], lower: str, level: str, past_downgrade: bool) -> str:
    best = "none"
    for rx in patterns:
        for m in rx.finditer(lower):
            window = lower[max(0, m.start() - 40): m.start()]
            if _NEGATION_RX.search(window):
                best = _max_risk(best, "low")
            elif past_downgrade and _PAST_RX.search(window):
                best = _max_risk(best, "medium")
            else:
                best = _max_risk(best, level)
    return best


def assess_risk(text: str) -> Dict[str, str]:
    """Rule-based risk level: none | low | medium | high."""
    lower = (text or "").lower()
    level = _scan(_HIGH_RX, lower, "high", past_downgrade=True)
    if level == "high":
        return {"level": "high"}
    if any(s in lower for s in _HIGH_SUBSTR):
        return {"level": "high"}
    level = _max_risk(level, _scan(_MEDIUM_RX, lower, "medium", past_downgrade=False))
    return {"level": level}


# Verified numbers for helplines (Tele-MANAS, KIRAN, Childline, 112)
def _helpline_lines(lang: str, minor: bool) -> List[str]:
    L = lang if lang in ("ta", "hi", "te", "kn", "ml") else "en"
    tele = {
        "en": "• Tele-MANAS: 14416 or 1800 891 4416 (free, 24/7, many Indian languages)",
        "ta": "• Tele-MANAS: 14416 அல்லது 1800 891 4416 (இலவசம், 24 மணி நேரமும், தமிழ் உட்பட பல மொழிகளில்)",
        "hi": "• Tele-MANAS: 14416 या 1800 891 4416 (मुफ़्त, 24 घंटे, कई भारतीय भाषाओं में)",
        "te": "• Tele-MANAS: 14416 లేదా 1800 891 4416 (ఉచితం, 24 గంటలు, తెలుగుతో సహా అనేక భాషలలో)",
        "kn": "• Tele-MANAS: 14416 ಅಥವಾ 1800 891 4416 (ಉಚಿತ, 24/7, ಕನ್ನಡ ಸೇರಿದಂತೆ ಹಲವು ಭಾಷೆಗಳಲ್ಲಿ)",
        "ml": "• Tele-MANAS: 14416 അല്ലെങ്കിൽ 1800 891 4416 (സൗജന്യം, 24/7, മലയാളം ഉൾപ്പെടെ പല ഭാഷകളിൽ)",
    }[L]
    kiran = {
        "en": "• KIRAN: 1800-599-0019 (free, 24/7)",
        "ta": "• KIRAN: 1800-599-0019 (இலவசம், 24 மணி நேரமும்)",
        "hi": "• KIRAN: 1800-599-0019 (मुफ़्त, 24 घंटे)",
        "te": "• KIRAN: 1800-599-0019 (ఉచితం, 24 గంటలు)",
        "kn": "• KIRAN: 1800-599-0019 (ಉಚಿತ, 24 ಗಂಟೆಗಳು)",
        "ml": "• KIRAN: 1800-599-0019 (സൗജന്യം, 24 മണിക്കൂറും)",
    }[L]
    sneha = "• சினேகா (சென்னை): +91 44 2464 0050 (24 மணி நேரமும்)"
    child = {
        "en": "• Childline: 1098 (24/7, for anyone under 18)",
        "ta": "• சைல்டுலைன்: 1098 (24 மணி நேரமும், 18 வயதுக்குக் கீழ் உள்ளவர்களுக்கு)",
        "hi": "• चाइल्डलाइन: 1098 (24 घंटे, 18 वर्ष से कम आयु के लिए)",
        "te": "• చైల్డ్‌లైన్: 1098 (24 గంటలు, 18 ఏళ్లలోపు వారికి)",
        "kn": "• ಚೈಲ್ಡ್‌ಲೈನ್: 1098 (24 ಗಂಟೆಗಳು, 18 ವರ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ ವಯಸ್ಸಿನವರಿಗೆ)",
        "ml": "• ചൈൽഡ്‌ലൈൻ: 1098 (24 മണിക്കൂറും, 18 വയസ്സിന് താഴെയുള്ളവർക്ക്)",
    }[L]
    lines = [tele, sneha if lang == "ta" else kiran]
    if minor:
        lines.append(child)
    return lines


def _helpline_cards(lang: str, minor: bool) -> List[Dict[str, str]]:
    cards = [{"name": "Tele-MANAS", "number": "14416", "alt": "1800 891 4416"}]
    cards.append({"name": "Sneha (Chennai)", "number": "+91 44 2464 0050", "alt": ""} if lang == "ta"
                 else {"name": "KIRAN", "number": "1800-599-0019", "alt": ""})
    if minor:
        cards.append({"name": "Childline", "number": "1098", "alt": ""})
    cards.append({"name": "Emergency", "number": "112", "alt": ""})
    return cards


_CRISIS_FULL = {
    "en": (
        "Thank you for telling me. What you're carrying sounds very heavy, and you deserve a real person "
        "with you through it right now.\n\n{lines}\n\n"
        "If you think you might act on these thoughts, call 112, go to the nearest hospital, or ask someone "
        "nearby to stay with you. Please keep anything you could hurt yourself with out of reach.\n\n"
        "I'm staying right here with you while you reach out."
    ),
    "ta": (
        "இதை என்னிடம் சொன்னதற்கு நன்றி. நீங்கள் மிகவும் கனமான ஒன்றைச் சுமக்கிறீர்கள் என்று தெரிகிறது; "
        "இந்த நேரத்தில் உங்களுடன் ஒரு உண்மையான மனிதர் இருக்க வேண்டும்.\n\n{lines}\n\n"
        "உங்களை நீங்களே காயப்படுத்திக் கொள்வீர்களோ என்று தோன்றினால், உடனே 112 ஐ அழைக்கவும், "
        "அருகிலுள்ள மருத்துவமனைக்குச் செல்லவும், அல்லது அருகில் இருக்கும் ஒருவரை உங்களுடன் இருக்கச் சொல்லுங்கள். "
        "உங்களைக் காயப்படுத்தக்கூடிய பொருட்களை உங்களிடமிருந்து தள்ளி வையுங்கள்.\n\n"
        "நீங்கள் உதவியைத் தொடர்பு கொள்ளும் வரை நான் இங்கேயே உங்களுடன் இருக்கிறேன்."
    ),
    "hi": (
        "यह बताने के लिए शुक्रिया। जो आप झेल रहे हैं वह बहुत भारी लगता है, और इस समय आपके साथ किसी असली इंसान का होना ज़रूरी है।\n\n"
        "{lines}\n\n"
        "अगर आपको लगता है कि आप खुद को नुकसान पहुँचा सकते हैं, तो अभी 112 पर कॉल करें, नज़दीकी अस्पताल जाएँ, "
        "या किसी को अपने पास बुला लें। खुद को चोट पहुँचा सकने वाली चीज़ें अपने से दूर रख दें।\n\n"
        "जब तक आप मदद से जुड़ते हैं, मैं यहीं आपके साथ हूँ।"
    ),
    "te": (
        "చెప్పినందుకు ధన్యవాదాలు. మీరు ఎదుర్కొంటున్న బాధ చాలా భారంగా ఉంది, ఈ సమయంలో మీకు తోడుగా ఒక నిజమైన వ్యక్తి ఉండటం ఎంతో ముఖ్యం.\n\n"
        "{lines}\n\n"
        "ఒకవేళ మీరు మిమ్మల్ని గాయపరచుకునే ప్రమాదం ఉంటే, వెంటనే 112 కు కాల్ చేయండి లేదా దగ్గరలోని ఆసుపత్రికి వెళ్లండి. "
        "మీకు హాని కలిగించే వస్తువులను దూరంగా ఉంచండి.\n\n"
        "మీరు సహాయాన్ని సంప్రదించే వరకు నేను ఇక్కడే మీతో ఉంటాను."
    ),
    "kn": (
        "ಇದನ್ನು ಹೇಳಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನೀವು ಅನುಭವಿಸುತ್ತಿರುವ ನೋವು ತುಂಬಾ ಭಾರವಾಗಿದೆ, ಈ ಸಮಯದಲ್ಲಿ ನಿಮ್ಮೊಂದಿಗೆ ಒಬ್ಬ ನೈಜ ವ್ಯಕ್ತಿ ಇರಬೇಕಾಗುತ್ತದೆ.\n\n"
        "{lines}\n\n"
        "ನೀವು ನಿಮಗೆ ಹಾನಿ ಮಾಡಿಕೊಳ್ಳುವ ಆಲೋಚನೆ ಬಂದರೆ, ದಯವಿಟ್ಟು ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಹೋಗಿ. "
        "ನಿಮಗೆ ನೋವುಂಟು ಮಾಡುವ ವಸ್ತುಗಳನ್ನು ದೂರವಿಡಿ.\n\n"
        "ನೀವು ಸಹಾಯ ಪಡೆಯುವವರೆಗೂ ನಾನು ಇಲ್ಲೇ ನಿಮ್ಮೊಂದಿಗೆ ಇರುತ್ತೇನೆ."
    ),
    "ml": (
        "ഇത് തുറന്നുപറഞ്ഞതിന് നന്ദി. നിങ്ങൾ ഇപ്പോൾ അനുഭവിക്കുന്ന വേദന വളരെ ഭാരമുള്ളതാണ്, ഈ സമയത്ത് നിങ്ങളുടെ കൂടെ ഒരു യഥാർത്ഥ വ്യക്തി ഉണ്ടായിരിക്കേണ്ടത് ആവശ്യമാണ്.\n\n"
        "{lines}\n\n"
        "നിങ്ങൾ സ്വയം ഉപദ്രവിക്കാൻ സാധ്യതയുണ്ടെന്ന് തോന്നിയാൽ, ദയവായി ഉടൻ 112 എന്ന നമ്പറിലേക്ക് വിളിക്കുകയോ അടുത്തുള്ള ആശുപത്രിയിൽ പോവുകയോ ചെയ്യുക. "
        "സ്വയം മുറിവേൽപ്പിക്കുന്ന വസ്തുക്കൾ മാറ്റിവെക്കുക.\n\n"
        "നിങ്ങൾ സഹായം തേടുന്നതുവരെ ഞാൻ ഇവിടെ നിങ്ങളുടെ കൂടെയുണ്ട്."
    ),
}

_CRISIS_SHORT = {
    "en": "I'm still right here with you. Please reach out to someone who can be with you right now:\n\n{lines}\n\nIf you're in danger, call 112.",
    "ta": "நான் இன்னும் உங்களுடன் தான் இருக்கிறேன். இப்போது உங்களுடன் இருக்கக்கூடிய ஒருவரைத் தொடர்பு கொள்ளுங்கள்:\n\n{lines}\n\nஆபத்தில் இருந்தால் 112 ஐ அழைக்கவும்.",
    "hi": "मैं अभी भी आपके साथ हूँ। कृपया किसी ऐसे व्यक्ति से जुड़ें जो अभी आपके साथ रह सके:\n\n{lines}\n\nअगर आप खतरे में हैं तो 112 पर कॉल करें।",
    "te": "నేను ఇప్పటికీ మీతోనే ఉన్నాను. దయచేసి ప్రస్తుతం మీతో ఉండగల ఎవరినైనా సంప్రదించండి:\n\n{lines}\n\nఆపదలో ఉంటే 112 కి కాల్ చేయండి.",
    "kn": "ನಾನು ಇನ್ನೂ ನಿಮ್ಮೊಂದಿಗೇ ಇದ್ದೇನೆ. ದಯವಿಟ್ಟು ಈಗ ನಿಮ್ಮೊಂದಿಗೆ ಇರಬಹುದಾದ ಯಾರನ್ನಾದರೂ ಸಂಪರ್ಕಿಸಿ:\n\n{lines}\n\nಅಪಾಯವಿದ್ದರೆ 112 ಗೆ ಕರೆ ಮಾಡಿ.",
    "ml": "ഞാൻ ഇപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്. ദയവായി ഇപ്പോൾ നിങ്ങളുടെ കൂടെ നിൽക്കാൻ കഴിയുന്ന ഒരാളെ ബന്ധപ്പെടുക:\n\n{lines}\n\nഅപകടത്തിലാണെങ്കിൽ 112 ലേക്ക് വിളിക്കുക.",
}

_MINOR_ADDON = {
    "en": "\n\nPlease also tell a trusted adult (a parent, relative, teacher or school counsellor) how you're feeling.",
    "ta": "\n\nநீங்கள் எப்படி உணர்கிறீர்கள் என்பதை நம்பிக்கைக்குரிய ஒரு பெரியவரிடம் (பெற்றோர், உறவினர், ஆசிரியர் அல்லது பள்ளி ஆலோசகர்) சொல்லுங்கள்.",
    "hi": "\n\nकृपया किसी भरोसेमंद बड़े (माता-पिता, रिश्तेदार, शिक्षक या स्कूल काउंसलर) को भी बताइए कि आप कैसा महसूस कर रहे हैं।",
    "te": "\n\nదయచేసి మీ పరిస్థితిని తల్లిదండ్రులు, ఉపాధ్యాయులు లేదా పాఠశాల కౌన్సెలర్ వంటి నమ్మకమైన పెద్దవారికి చెప్పండి.",
    "kn": "\n\nದಯವಿಟ್ಟು ನಿಮ್ಮ ಭಾವನೆಗಳನ್ನು ಪೋಷಕರು, ಶಿಕ್ಷಕರು ಅಥವಾ ಶಾಲಾ ಆಪ್ತಸಮಾಲೋಚಕರಂತಹ ನಂಬಿಕಸ್ಥ ಹಿರಿಯರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ.",
    "ml": "\n\nദയവായി നിങ്ങൾ അനുഭവിക്കുന്ന അവസ്ഥ മാതാപിതാക്കൾ, അധ്യാപകർ അല്ലെങ്കിൽ സ്കൂൾ കൗൺസിലർ പോലുള്ള വിശ്വസ്തരായ മുതിർന്നവരോട് പറയുക.",
}

_NUDGE = {
    "en": "If things ever feel too heavy, Tele-MANAS (14416) is free, open 24/7 and there to talk, in many languages.",
    "ta": "மனம் மிகவும் கனமாக உணரும் போது, Tele-MANAS (14416) இலவசமாக, 24 மணி நேரமும் பேச உதவும்.",
    "hi": "अगर मन बहुत भारी लगे, तो Tele-MANAS (14416) मुफ़्त है, 24 घंटे उपलब्ध है और बात करने के लिए है।",
    "te": "మనసు చాలా భారంగా అనిపిస్తే, Tele-MANAS (14416) ఉచితంగా, 24/7 అందుబాటులో ఉంటుంది.",
    "kn": "ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾದರೆ, Tele-MANAS (14416) ಉಚಿತವಾಗಿ 24 ಗಂಟೆಯೂ ಮಾತನಾಡಲು ಲಭ್ಯವಿದೆ.",
    "ml": "മനസ്സിന് വല്ലാത്ത ഭാരം തോന്നുമ്പോൾ സംസാരിക്കാൻ Tele-MANAS (14416) സൗജന്യമായി 24 മണിക്കൂറും ലഭ്യമാണ്.",
}


def build_crisis_reply(lang: str, minor: bool, followup: bool) -> str:
    L = lang if lang in ("ta", "hi", "te", "kn", "ml") else "en"
    template = (_CRISIS_SHORT if followup else _CRISIS_FULL)[L]
    text = template.format(lines="\n".join(_helpline_lines(lang, minor)))
    if minor and not followup:
        text += _MINOR_ADDON[L]
    return text


# ===========================================================================
# 2. LANGUAGE + EMOTION / STATE DETECTION
# ===========================================================================
_SCRIPTS = [
    ("ta", 0x0B80, 0x0BFF), ("hi", 0x0900, 0x097F), ("te", 0x0C00, 0x0C7F), ("kn", 0x0C80, 0x0CFF),
    ("ml", 0x0D00, 0x0D7F), ("bn", 0x0980, 0x09FF), ("gu", 0x0A80, 0x0AFF), ("pa", 0x0A00, 0x0A7F),
]


def resolve_language(message: str, selected: Optional[str]) -> str:
    selected = selected or "en"
    counts = {lang: 0 for lang, _, _ in _SCRIPTS}
    for ch in message:
        cp = ord(ch)
        for lang, lo, hi in _SCRIPTS:
            if lo <= cp <= hi:
                counts[lang] += 1
                break
    best = max(counts, key=counts.get)
    if counts[best] < 2:
        return selected
    if selected == "mr" and best == "hi":
        return "mr"
    return best


EMOTION_LEXICON: Dict[str, Dict[str, float]] = {
    "anxiety": {
        "anxious": 2, "anxiety": 2, "panic": 3, "panicking": 3, "freaking out": 3, "nervous": 2,
        "scared": 2, "terrified": 3, "shaking": 2, "paralyzed": 2, "palpitations": 2,
        "heart racing": 3, "can't breathe": 3, "cannot breathe": 3, "worried": 2, "worry": 1,
        "afraid": 2, "mind going blank": 3, "mind went blank": 3, "overthinking": 2, "what if": 1,
        "bayama": 2, "bayam": 2, "padapadappu": 2, "ghabra": 2, "ghabrahat": 2, "dar lag": 2,
        "tension": 1, "பயம்": 2, "படபடப்பு": 3, "பதட்டம்": 3, "கவலை": 2, "घबराहट": 3, "डर": 2, "चिंता": 2,
        "భయం": 2, "ఆందోళన": 3, "ಹೆದರಿಕೆ": 2, "ಆತಂಕ": 3, "ഭയം": 2, "ആശങ്ക": 3,
    },
    "sadness": {
        "sad": 2, "crying": 2, "cried": 2, "depressed": 3, "heartbroken": 3, "down": 1, "unhappy": 2,
        "hopeless": 3, "hurts": 1, "lonely": 2, "alone": 1, "empty": 2, "miss": 1, "grief": 2,
        "kashtama": 2, "kashtam": 2, "feel bad": 1, "dukhi": 2, "udaas": 2, "akela": 2,
        "அழுகை": 2, "தனிமை": 2, "சோகம்": 3, "வருத்தம்": 2, "கஷ்டம்": 2, "उदास": 2, "अकेला": 2, "दुखी": 2,
        "బాధ": 2, "ఏడుపు": 2, "ದುಃಖ": 2, "ನೋವು": 2, "സങ്കടം": 2, "കണ്ണീർ": 2,
    },
    "anger": {
        "angry": 2, "mad": 1, "furious": 3, "annoyed": 1, "frustrated": 2, "hate": 2, "irritated": 1,
        "pissed": 2, "unfair": 2, "fed up": 2, "gussa": 2, "kovam": 2, "கோபம்": 2, "गुस्सा": 2,
        "కోపం": 2, "ಕೋಪ": 2, "ദേഷ്യം": 2,
    },
    "stressed": {
        "stressed": 2, "stress": 2, "overwhelmed": 3, "deadline": 1, "burnout": 3, "burnt out": 3,
        "too much": 2, "exhausted": 2, "tired": 1, "pressure": 2, "drained": 2, "can't cope": 3,
        "exam": 1, "backlog": 1, "romba tired": 2, "thookam varala": 2, "neend nahi": 2,
        "பிரஷர்": 2, "அழுத்தம்": 2, "சோர்வு": 2, "तनाव": 2, "थक": 1, "दबाव": 2,
        "ఒత్తిడి": 2, "అలసట": 2, "ಒತ್ತಡ": 2, "ಆಯಾಸ": 2, "സമ്മർദ്ദം": 2, "ക്ഷീണം": 2,
    },
    "joy": {
        "happy": 2, "great": 1, "excited": 2, "proud": 2, "amazing": 2, "wonderful": 2, "passed": 2,
        "good": 1, "better": 1, "glad": 2, "santhosham": 2, "khush": 2, "மகிழ்ச்சி": 2, "खुश": 2,
        "సంతోషం": 2, "ఆనందం": 2, "ಸಂತೋಷ": 2, "ಖುಷಿ": 2, "സന്തോഷം": 2,
    },
    "relief": {
        "thank god": 3, "phew": 2, "finally": 1, "calmer": 2, "relieved": 3, "feeling better": 3,
        "nimmadhi": 2, "rahat": 2, "நிம்மதி": 3, "राहत": 3, "ఊరట": 3, "ನೆಮ್ಮದಿ": 3, "ആശ്വാസം": 3,
    },
    "curiosity": {
        "curious": 1, "wonder": 1, "how do i": 1, "how can i": 1, "how to": 1, "can you": 0.9,
        "could you": 0.9, "tell me": 0.9, "explain": 1, "why do": 1, "why does": 1,
    },
}

_INTENSIFIERS = re.compile(
    r"\b(very|so|extremely|really|too|totally|completely|can'?t|cannot|always|constantly|"
    r"romba|bahut|bohot|ekdum|unbearable|worst|chalabaaga|thumba|valare)\b", re.I
)
_NEG_BEFORE = re.compile(r"(?:\b(?:not|never|no|without|hardly|nahi|nahin|nhi|illa|illai|ledu|illa)\b|n't\b)[^.!?]{0,18}$", re.I)

STATE_MAP = {
    "anxiety": "Anxious / Somatic Alert",
    "sadness": "Heavyhearted / Seeking Care",
    "anger": "Frustrated / High Tension",
    "stressed": "Overwhelmed / High Load",
    "joy": "Uplifted / Feeling Good",
    "relief": "Grounding / Finding Peace",
    "curiosity": "Reflective / Inquiring",
    "neutral": "Calm & Centered",
}

AVATAR_EMOTION = {
    "anxiety": "concerned", "sadness": "sad", "anger": "concerned", "stressed": "concerned",
    "joy": "happy", "relief": "happy", "curiosity": "neutral", "neutral": "neutral",
}

EXPRESSION_MAP = {
    "anxiety": "concerned", "sadness": "concerned", "anger": "concerned", "stressed": "concerned",
    "joy": "happy", "relief": "happy", "curiosity": "neutral", "neutral": "neutral",
}

_BASE_STRESS = {"anxiety": 6, "stressed": 6, "sadness": 5, "anger": 5, "curiosity": 2, "joy": 1, "relief": 1, "neutral": 2}


def _find_phrase(lower: str, phrase: str) -> List[int]:
    if phrase.isascii():
        return [m.start() for m in re.finditer(r"\b" + re.escape(phrase) + r"\b", lower)]
    out, i = [], lower.find(phrase)
    while i != -1:
        out.append(i)
        i = lower.find(phrase, i + 1)
    return out


def classify_emotion(text: str, recent_moods: Optional[List[int]] = None) -> Dict[str, Any]:
    lower = (text or "").lower()
    scores: Dict[str, float] = {}
    for emo, words in EMOTION_LEXICON.items():
        for phrase, weight in words.items():
            for pos in _find_phrase(lower, phrase):
                negated = bool(_NEG_BEFORE.search(lower[max(0, pos - 25): pos])) if phrase.isascii() else False
                if negated:
                    if emo == "joy":
                        scores["sadness"] = scores.get("sadness", 0) + weight * 0.5
                    continue
                scores[emo] = scores.get(emo, 0) + weight

    if not scores:
        emotion, confidence = "neutral", 0.0
    else:
        emotion = max(scores, key=lambda k: (scores[k], k != "curiosity"))
        confidence = scores[emotion]

    stress = _BASE_STRESS[emotion]
    if emotion not in ("joy", "relief", "neutral"):
        stress += min(2, len(_INTENSIFIERS.findall(lower)))
        stress += 1 if len([e for e in scores if e not in ("curiosity", "joy", "relief")]) >= 2 else 0
        stress += 1 if text.count("!") >= 2 or re.search(r"\b[A-Z]{4,}\b", text or "") else 0
        if recent_moods and sum(recent_moods) / len(recent_moods) <= 2:
            stress += 1
    stress = max(0, min(10, stress))

    return {
        "emotion": emotion,
        "confidence": confidence,
        "state_label": STATE_MAP[emotion],
        "expression": EXPRESSION_MAP[emotion],
        "avatar_emotion": AVATAR_EMOTION[emotion],
        "stress_level": stress,
    }


# ===========================================================================
# 3. RESPONSE STRATEGY (ESConv + Stage Model + Anti-Repetition)
# ===========================================================================
ESCONV_STRATEGIES = [
    "reflect feelings",
    "ask an open question",
    "affirm/normalize",
    "offer a reframe",
    "give information",
    "suggest one small step",
    "offer a grounding exercise",
]

STRATEGY_DESCRIPTIONS = {
    "reflect feelings": "Mirror their emotional state with warmth, using their specific words to show deep understanding.",
    "ask an open question": "Gently ask ONE exploratory, non-intrusive question to invite them to share what feels heaviest.",
    "affirm/normalize": "Affirm their effort, resilience, or normalize that their reaction is human and valid under this pressure.",
    "offer a reframe": "Gently offer a kinder, more balanced perspective on a distortion (e.g. catastrophizing or self-blame).",
    "give information": "Share one clear, compassionate piece of psychoeducation (e.g. why the brain freezes under exam stress).",
    "suggest one small step": "Offer ONE very small, low-effort micro-action (sip water, pause for 60s, jot one line on paper).",
    "offer a grounding exercise": "Guide a short, sensory grounding (5-4-3-2-1) or calming breathing exercise (4-7-8) with counts.",
}


def choose_esconv_strategy(
    pass_a: Dict[str, Any],
    turn_count: int,
    recent_strategies: Optional[List[str]] = None,
) -> str:
    """
    Selects ONE strategy from the ESConv set following the stage model:
    Stage 1: Explore (explore feelings first, no advice)
    Stage 2: Gain Insight (reframe, normalize, reflect)
    Stage 3: Action (small steps, exercises, only when ready)

    CRITICAL RULE: Never jump to advice when need == 'vent' or readiness == 'not_ready'.
    ROTATION RULE: Never repeat the same strategy as the last turn; avoid the last 2 if possible.
    """
    need = pass_a.get("underlying_need", "just_be_heard")
    readiness = pass_a.get("user_readiness", "not_ready")
    distortions = [d for d in pass_a.get("cognitive_distortions", []) if d and d != "none"]
    intensity = pass_a.get("intensity", 3)
    recent = recent_strategies or []
    recent_set = set(recent[-2:])  # Avoid the last 2 strategies for rotation

    def _pick(candidates: List[str]) -> str:
        """Pick first candidate not in recent_set; if all avoided, pick one not matching very last."""
        for c in candidates:
            if c not in recent_set:
                return c
        # All candidates recently used – just avoid exact last one
        last = recent[-1] if recent else None
        for c in candidates:
            if c != last:
                return c
        return candidates[0]

    # If intensity is high (>= 4) and emotions indicate panic or severe anxiety -> grounding exercise
    if intensity >= 4 and any(e in pass_a.get("primary_emotions", []) for e in ("panic", "anxiety", "fear")):
        if "offer a grounding exercise" not in recent_set:
            return "offer a grounding exercise"
        return "reflect feelings"  # fallback if grounding was just used

    # Stage 1: Explore (Turn 0-1, or need is vent / just_be_heard / comfort, or user is not_ready)
    if need in ("vent", "just_be_heard", "comfort") or readiness == "not_ready" or turn_count <= 1:
        candidates = ["reflect feelings", "affirm/normalize", "ask an open question"]
        return _pick(candidates)

    # Stage 2: Gain Insight (Readiness is exploring or turn_count 2-4)
    if readiness == "exploring" or turn_count in (2, 3, 4):
        if distortions:
            candidates = ["offer a reframe", "affirm/normalize", "reflect feelings"]
        else:
            candidates = ["affirm/normalize", "reflect feelings", "ask an open question"]
        return _pick(candidates)

    # Stage 3: Action (Readiness is ready_for_action and need is advice or practical_help)
    if readiness == "ready_for_action" or need in ("advice", "practical_help"):
        candidates = ["suggest one small step", "give information", "offer a grounding exercise"]
        return _pick(candidates)

    return "reflect feelings"


def choose_strategy(emo: Dict[str, Any], turn_count: int, message: str) -> str:
    """Backward compatibility wrapper."""
    mock_pass_a = {
        "underlying_need": "advice" if "?" in message else "vent",
        "user_readiness": "ready_for_action" if "?" in message and turn_count > 2 else "exploring",
        "intensity": min(5, max(1, emo.get("stress_level", 4) // 2)),
        "primary_emotions": [emo.get("emotion", "neutral")],
        "cognitive_distortions": [],
    }
    return choose_esconv_strategy(mock_pass_a, turn_count)


_PEOPLE_RX = re.compile(
    r"\bmy (mom|dad|mother|father|parents|friend|roommate|boss|professor|teacher|partner|boyfriend|girlfriend|brother|sister)\b",
    re.I
)
_GOAL_RX = re.compile(
    r"\b(?:i want to|my goal is|i'?m trying to|i am trying to)\s+([a-z ]{4,40})",
    re.I
)
_EXAM_RX = re.compile(
    r"\b(exam|exams|viva|finals?|boards?|semester|neet|jee|upsc|gate|interview|submission)\b|தேர்வு|परीक्षा|పరీక్ష|ಪರೀಕ್ಷೆ|പരീക്ഷ",
    re.I
)
_WHAT_HELPED_RX = re.compile(
    r"\b(?:what helped|helped me|felt better after|calmed me down|good thing was|relieved by|(?:walking|breathing|music|exercise|talking|journaling) helped)\b|"
    r"உதவியாக இருந்தது|ஆறுதலாக இருந்தது|राहत मिली|मदद मिली",
    re.I
)


def extract_memories(message: str, emotion: str = "neutral") -> List[Dict[str, str]]:
    """
    Extracts 3-5 facts (worries, people, goals, what helped) with categories.
    Returns list of dicts with keys 'category' and 'fact'.
    """
    lower = (message or "").lower()
    negative = emotion in ("anxiety", "stressed", "sadness", "anger")
    facts: List[Dict[str, str]] = []

    # 1. Worries
    if negative and _EXAM_RX.search(lower):
        facts.append({"category": "worry", "fact": "Is stressed about an upcoming exam or evaluation"})
    if re.search(r"can'?t sleep|cannot sleep|insomnia|trouble sleeping|not sleeping|thookam varala|neend nahi|தூக்கம் வரவில்லை|नींद नहीं", lower):
        facts.append({"category": "worry", "fact": "Has been struggling with sleep and insomnia"})
    if re.search(r"burn(?:t |ed )?out|burnout|exhausted|drained", lower):
        facts.append({"category": "worry", "fact": "Experiences emotional and academic/work burnout"})
    if re.search(r"\blonely\b|தனிமை|अकेलापन|ఒంటరితన|ಏಕಾಂಗಿ|ഒറ്റപ്പെടൽ", lower):
        facts.append({"category": "worry", "fact": "Has been feeling lonely or isolated"})

    # 2. People mentioned
    m = _PEOPLE_RX.search(lower)
    if m:
        role = m.group(1).lower()
        if negative:
            facts.append({"category": "person", "fact": f"Has interpersonal distress involving their {role}"})
        else:
            facts.append({"category": "person", "fact": f"Mentioned their {role} as a close contact"})

    # 3. Goals
    g = _GOAL_RX.search(lower)
    if g:
        facts.append({"category": "goal", "fact": f"Wants to {g.group(1).strip()}"})

    # 4. What helped
    if _WHAT_HELPED_RX.search(lower):
        if re.search(r"breath|மூச்சு|सांस", lower):
            facts.append({"category": "what_helped", "fact": "Breathing exercises brought noticeable relief"})
        elif re.search(r"walk|நடை|टहल", lower):
            facts.append({"category": "what_helped", "fact": "Taking a short walk or physical break helped calm down"})
        elif re.search(r"music|இசை|संगीत", lower):
            facts.append({"category": "what_helped", "fact": "Listening to calming music helped reduce tension"})
        elif re.search(r"talk|friend|பேசு|बात", lower):
            facts.append({"category": "what_helped", "fact": "Talking honestly to a trusted peer relieved stress"})
        else:
            facts.append({"category": "what_helped", "fact": "Taking a mindful pause provided temporary relief"})

    # Default general worry if negative and empty
    if not facts and negative:
        facts.append({"category": "worry", "fact": f"Navigating emotional distress involving: {lower[:40]}"})

    return facts[:5]


def _tokens_for_similarity(t: str) -> List[str]:
    return re.findall(r"[^\s.,!?;:\"'()\-\u2014\u2026]+", t.lower())


def calculate_ngram_similarity(text1: str, text2: str, n: int = 3) -> float:
    """3-gram Jaccard overlap, used to catch repetitive bot answers."""
    def grams(t: str):
        words = _tokens_for_similarity(t)
        if len(words) < n:
            return set(words)
        return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)}
    a, b = grams(text1), grams(text2)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _clean_line(s: str, limit: int = 140) -> str:
    s = re.sub(r"[\r\n\t`{}<>]", " ", str(s or ""))
    return " ".join(s.split())[:limit]


# ===========================================================================
# 4. PROMPTS & TWO-PASS PIPELINE
# ===========================================================================
LANGUAGE_INSTRUCTIONS = {
    "ta": ("Reply ONLY in natural, everyday spoken Tamil (தமிழ்), like a caring close friend or wise sibling. "
           "No stiff book Tamil, no awkward machine translation. If the person writes Tanglish (romanised Tamil), "
           "keep 'text' relatable and put pure Tamil script in 'spoken_text' so text-to-speech sounds natural."),
    "hi": ("Reply ONLY in natural, everyday spoken Hindi (हिन्दी), warm and not bureaucratic. If the person writes "
           "Hinglish, keep 'text' conversational and put pure Devanagari in 'spoken_text'."),
    "te": "Reply ONLY in natural, warm, everyday spoken Telugu (తెలుగు).",
    "kn": "Reply ONLY in natural, gentle, everyday spoken Kannada (ಕನ್ನಡ).",
    "ml": "Reply ONLY in natural, soothing, everyday spoken Malayalam (മലയാളം).",
    "bn": "Reply ONLY in natural, comforting, everyday spoken Bengali (বাংলা).",
    "mr": "Reply ONLY in natural, warm, everyday spoken Marathi (मराठी).",
    "gu": "Reply ONLY in natural, caring, everyday spoken Gujarati (ગુજરાતી).",
    "pa": "Reply ONLY in natural, reassuring, everyday spoken Punjabi (ਪੰਜਾਬੀ).",
    "en": "Reply in warm, plain, natural English. If the person mixes in Tamil, Hindi or other Indic words, echo them naturally.",
}

TONE_INSTRUCTIONS = {
    "gentle": "Soothing, validating, patient, soft-paced.",
    "motivating": "Encouraging, points to their existing strengths, small achievable steps.",
    "straight-talking": "Direct, clear, practical, no jargon, delivered with warmth and respect.",
}

PASS_A_SYSTEM_PROMPT = """You are a hidden, ultra-fast clinical and emotional understanding engine.
Analyze the user's latest message, recent turns, user profile, and memories.
Return ONLY a valid JSON object adhering strictly to this schema:
{
  "primary_emotions": ["<top 1-2 core emotions: anxiety, sadness, anger, guilt, loneliness, exhaustion, joy, neutral>"],
  "secondary_emotions": ["<underlying emotions: overwhelm, fear of failure, feeling unseen, shame, dread>"],
  "intensity": 1-5,
  "underlying_need": "vent" | "comfort" | "advice" | "perspective" | "practical_help" | "just_be_heard",
  "topics": ["<key topics: exam, career, family, relationship, sleep, health, loneliness, finances>"],
  "cognitive_distortions": ["catastrophizing" | "all-or-nothing" | "mind-reading" | "self-blame" | "overgeneralization" | "filtering" | "discounting_positive" | "none"],
  "triggers_or_people_mentioned": ["<names, titles, or events, e.g. mom, boss, math exam, roommate>"],
  "what_helped_before": ["<coping methods from memories or past turns, e.g. breathing, walk, or 'none recorded'>"],
  "risk_level": "none" | "low" | "moderate" | "high" | "imminent",
  "language": "en" | "ta" | "hi" | "te" | "kn" | "ml",
  "user_readiness": "not_ready" | "exploring" | "ready_for_action"
}

UNDERLYING NEED DEFINITIONS:
- "vent" / "just_be_heard": User is expressing feelings or offloading pain. They do NOT want solutions right now.
- "comfort": User is in sorrow or distress and needs warmth, soothing presence, and validation.
- "perspective": User feels stuck or confused and is open to seeing their situation with fresh eyes.
- "advice" / "practical_help": User is actively asking "what should I do?" or seeking concrete guidance.

USER READINESS DEFINITIONS:
- "not_ready": Highly emotional, overwhelmed, or venting. Never give advice here.
- "exploring": Reflective, willing to discuss the feeling or thoughts.
- "ready_for_action": Calm, asking for small concrete steps.

CRITICAL RISK CALIBRATION (STRICT):
- Ordinary student stress, academic worry, upcoming exams ("exam tomorrow", "test coming up"), physical fatigue ("so tired", "exhausted", "sleepy"), work pressure, sadness over a breakup, or ordinary emotional venting MUST be marked "none" or "low" risk.
- NEVER mark risk as "high" or "imminent" unless the user explicitly expresses active self-harm, suicidal intent ("want to die", "kill myself", "end my life"), or imminent physical danger. Reserve crisis escalation strictly for actual self-harm/suicide emergencies.

OUTPUT RULE: Output ONLY raw JSON. No explanations, no markdown codeblocks.""".strip()


def _local_pass_a_fallback(
    message: str,
    emo: Dict[str, Any],
    history: List[Any],
    memories: List[str],
    language: str,
) -> Dict[str, Any]:
    """Deterministic, resilient local Pass A analyzer when LLM is unavailable."""
    lower = (message or "").lower()
    intensity = min(5, max(1, round(emo.get("stress_level", 4) / 2)))

    # Needs detection
    if "?" in message or re.search(r"\b(how do i|what should i|how can i|help me|what to do)\b", lower):
        need = "advice"
        readiness = "ready_for_action" if intensity <= 3 else "exploring"
    elif re.search(r"\b(can you help|give me a step|suggest something)\b", lower):
        need = "practical_help"
        readiness = "ready_for_action"
    elif re.search(r"\b(nobody cares|hate this|so unfair|i just want to say|sick of)\b", lower) or intensity >= 4:
        need = "vent"
        readiness = "not_ready"
    elif emo["emotion"] in ("sadness", "loneliness"):
        need = "comfort"
        readiness = "not_ready" if intensity >= 4 else "exploring"
    else:
        need = "just_be_heard"
        readiness = "exploring"

    # Cognitive distortions detection
    distortions = []
    if re.search(r"\b(ruined|end of the world|my life is over|nothing will ever work|worst thing)\b", lower):
        distortions.append("catastrophizing")
    if re.search(r"\b(always|never|completely|total failure|every single time|nobody)\b", lower):
        distortions.append("all-or-nothing")
    if re.search(r"\b(they hate me|everyone thinks|they think i am|nobody likes me)\b", lower):
        distortions.append("mind-reading")
    if re.search(r"\b(my fault|i am stupid|i ruined it|blame myself|hate myself)\b", lower):
        distortions.append("self-blame")
    if not distortions:
        distortions = ["none"]

    # Topics detection
    topics = []
    if _EXAM_RX.search(lower):
        topics.append("exam")
    if re.search(r"sleep|insomnia|tired|தூக்கம்|नींद", lower):
        topics.append("sleep")
    if re.search(r"lonely|alone|தனிமை|अकेला", lower):
        topics.append("loneliness")
    if re.search(r"job|work|office|boss|deadline|வேலை|नौकरी", lower):
        topics.append("work")
    if not topics:
        topics = ["emotional_wellbeing"]

    # People / triggers
    triggers = []
    m = _PEOPLE_RX.search(lower)
    if m:
        triggers.append(m.group(1).lower())
    if "exam" in topics:
        triggers.append("evaluation")

    # Coping from memory
    helped = [m for m in memories if any(w in m.lower() for w in ("breath", "walk", "helped", "relief"))]
    if not helped:
        helped = ["none recorded"]

    # Risk level from rule-based engine
    rule_level = assess_risk(message)["level"]
    risk_level = "high" if rule_level == "high" else ("moderate" if rule_level == "medium" else "none")

    return {
        "primary_emotions": [emo.get("emotion", "neutral")],
        "secondary_emotions": ["overwhelm"] if intensity >= 4 else ["contemplation"],
        "intensity": intensity,
        "underlying_need": need,
        "topics": topics,
        "cognitive_distortions": distortions,
        "triggers_or_people_mentioned": triggers,
        "what_helped_before": helped[:2],
        "risk_level": risk_level,
        "language": language,
        "user_readiness": readiness,
    }


# ---------------------------------------------------------------------------
# ONNX Fast Pre-Check (optional sidecar at ONNX_EMOTION_URL env var)
# ---------------------------------------------------------------------------
async def _onnx_precheck(message: str, language: str) -> Optional[Dict[str, Any]]:
    """
    Optional fast ONNX emotion pre-check running against ml/emotion/serve_onnx.py
    (configured via ONNX_EMOTION_URL env var; e.g. http://localhost:8009).
    Returns None if server is unreachable or not configured — fully graceful.
    Result seeds Pass A as an additional signal; never overrides safety logic.
    """
    onnx_url = os.getenv("ONNX_EMOTION_URL", "")
    if not onnx_url:
        return None
    try:
        client = _http()
        res = await client.post(
            f"{onnx_url.rstrip('/')}/predict/emotion",
            json={"text": message[:512], "language": language},
            timeout=2.0,
        )
        if res.status_code == 200:
            data = res.json()
            return {
                "onnx_emotion": data.get("primary_emotion", "neutral"),
                "onnx_secondary": data.get("secondary_emotions", []),
                "onnx_scores": data.get("confidence_scores", {}),
                "onnx_inference_type": data.get("inference_type", "unknown"),
            }
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# LLM-assisted memory extraction (concurrent background task after Pass B)
# ---------------------------------------------------------------------------
_MEMORY_EXTRACTION_PROMPT = (
    "You are a precise memory extractor for a mental health companion.\n"
    "From the USER's message below, extract 1-5 concrete, specific facts worth remembering across future sessions.\n"
    "Only extract facts explicitly stated by the user. Never infer or hallucinate.\n"
    "Fact categories: worry | person | goal | what_helped | milestone | context\n\n"
    'Return ONLY raw JSON: {"facts": [{"category": "...", "fact": "..."}]}\n'
    'If nothing worth remembering: {"facts": []}\n\n'
    'USER MESSAGE: "{message}"\n'
    "PRIOR MEMORIES (do NOT duplicate): {existing}"
)


async def _extract_memories_llm(message: str, existing: List[str]) -> List[Dict[str, str]]:
    """LLM-assisted memory extraction — supplements the deterministic regex extractor."""
    prompt = _MEMORY_EXTRACTION_PROMPT.format(
        message=message[:800],
        existing=", ".join(existing[:5]) if existing else "none",
    )
    try:
        res = await call_llm_json(
            "You are a precise clinical memory extractor. Extract only concrete, explicitly stated facts.",
            [{"role": "user", "content": prompt}],
        )
        facts = res.get("facts", [])
        if isinstance(facts, list):
            return [
                f for f in facts
                if isinstance(f, dict)
                and f.get("fact", "").strip()
                and len(f.get("fact", "")) < 200
            ][:5]
    except Exception:
        pass
    return []


# ---------------------------------------------------------------------------
# Strategy rotation helpers: DB-backed for true per-user rotation
# ---------------------------------------------------------------------------
def _load_recent_strategies(user_id: str, n: int = 6) -> List[str]:
    """Returns the last n strategies used by this user for anti-repetition rotation."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT strategy FROM strategy_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, n),
        )
        rows = [r["strategy"] for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception:
        return []


def _save_strategy(user_id: str, strategy: str) -> None:
    """Persists the chosen strategy to strategy_log for future rotation enforcement."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO strategy_log (id, user_id, strategy) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), user_id, strategy),
        )
        # Keep only last 30 rows per user to bound table growth
        cur.execute(
            """DELETE FROM strategy_log WHERE user_id = ? AND id NOT IN (
                SELECT id FROM strategy_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
            )""",
            (user_id, user_id),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        log.debug("Strategy log save error: %s", type(e).__name__)


async def analyze_understanding_pass_a(
    message: str,
    history: List[Any],
    user_name: str,
    age: int,
    is_minor: bool,
    reasons: List[str],
    language_hint: str,
    memories: List[str],
    emo: Dict[str, Any],
    onnx_hint: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Pass A: Fast, hidden clinical understanding returning strict JSON schema.
    Sends last 6 turns of conversation history so the LLM has full context.
    Incorporates ONNX pre-check as an additional emotion signal when available.
    """
    # Build recent conversation snippet (last 6 turns, most recent last)
    recent_turns = []
    for sender, text in history[-12:]:
        role_label = "User" if sender != "mascot" else "Companion"
        recent_turns.append(f"{role_label}: {(text or '')[:200]}")
    convo_context = "\n".join(recent_turns) if recent_turns else "(No prior conversation)"

    # Append ONNX hint if available (informational only)
    onnx_str = ""
    if onnx_hint:
        onnx_str = (
            f"\nFast emotion pre-check (ONNX — use as one additional signal, do NOT override your clinical judgment): "
            f"primary={onnx_hint.get('onnx_emotion', 'N/A')}, "
            f"secondary={', '.join(onnx_hint.get('onnx_secondary', []) or ['none'])}"
        )

    prompt_user_info = (
        f"User: Name={user_name or 'Friend'}, Age={age}, Minor={is_minor}, "
        f"Reasons they came here={reasons}\n"
        f"Long-term memories (what helped before, worries, goals): {memories[:5]}\n"
        f"Language hint: {language_hint}{onnx_str}\n\n"
        f"Conversation history (last 6 turns, oldest first):\n{convo_context}\n\n"
        f"Latest user message to analyze: \"{message}\""
    )
    pass_a_messages = [
        {"role": "user", "content": prompt_user_info}
    ]
    try:
        raw_res = await call_llm_json(PASS_A_SYSTEM_PROMPT, pass_a_messages)
        if raw_res and "primary_emotions" in raw_res and "underlying_need" in raw_res:
            try:
                raw_res["intensity"] = max(1, min(5, int(raw_res.get("intensity", 3))))
            except Exception:
                raw_res["intensity"] = 3
            if raw_res.get("risk_level") not in ("none", "low", "moderate", "high", "imminent"):
                raw_res["risk_level"] = "none"
            if raw_res.get("user_readiness") not in ("not_ready", "exploring", "ready_for_action"):
                raw_res["user_readiness"] = "exploring"
            if raw_res.get("underlying_need") not in ("vent", "comfort", "advice", "perspective", "practical_help", "just_be_heard"):
                raw_res["underlying_need"] = "just_be_heard"
            # Merge ONNX secondary emotions as additional signal (deduplicated)
            if onnx_hint and onnx_hint.get("onnx_secondary"):
                existing_secondary = raw_res.get("secondary_emotions", [])
                raw_res["secondary_emotions"] = list(dict.fromkeys(
                    existing_secondary + onnx_hint["onnx_secondary"]
                ))[:4]
            return raw_res
    except Exception as e:
        log.warning("Pass A LLM call failed: %s", type(e).__name__)

    return _local_pass_a_fallback(message, emo, history, memories, language_hint)



def build_pass_b_system_prompt(
    pass_a: Dict[str, Any],
    chosen_strategy: str,
    user_name: str,
    age: int,
    is_minor: bool,
    reasons: List[str],
    language: str,
    tone: str,
    persona_key: str,
    recent_moods: List[int],
    memories: List[str],
    recent_bot_replies: List[str],
    strategy_turn: int,
    knowledge_context: str,
    crisis_context: bool = False,
) -> str:
    """Pass B: Visible reply conditioned strictly on Pass A understanding & ESConv strategy."""
    persona = PERSONAS.get(persona_key, PERSONAS["digital_twin"])
    minor = bool(is_minor or (age is not None and age < 18))
    tone_text = TONE_INSTRUCTIONS.get((tone or "").lower(), "Warm, compassionate, steady.")
    name = _clean_line(user_name, 40) or "Friend"
    reasons_str = _clean_line(", ".join(reasons), 160) if reasons else "general emotional support"
    moods_str = f"{recent_moods} (1 = distressed, 5 = great)" if recent_moods else "none recorded"
    memories_str = "\n".join(f"- {_clean_line(m)}" for m in memories[:5]) if memories else "- none recorded yet"

    emotions_str = ", ".join(pass_a.get("primary_emotions", ["neutral"]))
    distortions_str = ", ".join(pass_a.get("cognitive_distortions", ["none"]))
    underlying_need = pass_a.get("underlying_need", "just_be_heard")
    user_readiness = pass_a.get("user_readiness", "exploring")
    triggers_str = ", ".join(pass_a.get("triggers_or_people_mentioned", [])) or "none"
    helped_str = ", ".join(pass_a.get("what_helped_before", [])) or "none"

    strategy_desc = STRATEGY_DESCRIPTIONS.get(chosen_strategy, "Reflect their feelings with empathy.")

    minor_clause = ""
    if minor:
        minor_clause = (
            "\nUNDER-18 COMPANION MODE: Speak gently, with extra safety and care. "
            "Remind them that talking to a trusted adult (parent, elder, teacher, counsellor) can help carry this burden.\n"
        )

    crisis_clause = ""
    if crisis_context:
        crisis_clause = (
            "\nCRISIS CONTINUATION: The user recently expressed self-harm thoughts and was given emergency numbers. "
            "Keep sentences short and calming. Do not ask for trauma details. Gently remind them that Tele-MANAS (14416) is available.\n"
        )

    avoid_clause = ""
    if recent_bot_replies:
        avoid_clause = (
            "\nANTI-REPETITION (STRICT): Do NOT repeat the openings, sentence structures, or metaphors of your recent replies:\n"
            + "\n".join(f"- \"{_clean_line(r, 85)}...\"" for r in recent_bot_replies[:6]) + "\n"
        )

    advice_gate = ""
    if underlying_need in ("vent", "just_be_heard") or user_readiness == "not_ready":
        advice_gate = (
            "\n*** CRITICAL STAGE RULE ***: The user's underlying need is to VENT and they are NOT READY for advice. "
            "Do NOT give advice, do NOT suggest fixes, do NOT jump to action. Just validate, reflect, and hold space.\n"
        )

    return f"""You are {persona['name']}. {persona['description']}
You are an AI companion for emotional wellness. You are NOT a human, doctor, or therapist.
If asked, honestly acknowledge you are an AI. Never diagnose conditions, never advise on medications, and never invent statistics.

ABOUT THE PERSON:
- Name: {name} | Age: {age} | Under 18: {'yes' if minor else 'no'}
- Came here for: {reasons_str}
- Tone they prefer: {tone} ({tone_text})
- Recent mood ratings: {moods_str}

LONG-TERM MEMORY (Past coping & context):
{memories_str}

PASS A CLINICAL UNDERSTANDING (Condition your reply on this):
- Detected Emotions: {emotions_str} (Intensity: {pass_a.get('intensity', 3)}/5)
- Underlying Need: {underlying_need}
- User Readiness: {user_readiness}
- Cognitive Distortions: {distortions_str}
- Triggers/People Mentioned: {triggers_str}
- What Helped Before: {helped_str}

YOUR ASSIGNED ESConv STRATEGY FOR THIS TURN:
>>> {chosen_strategy.upper()} <<<
Goal: {strategy_desc}
{advice_gate}
{knowledge_context}
{minor_clause}{crisis_clause}{avoid_clause}
LANGUAGE: {LANGUAGE_INSTRUCTIONS.get(language, 'Reply in the language the person is writing in, warm and natural.')}
LANGUAGE SWITCH RULE: Follow the user's selected language ({language}). If the user writes in another language, answer in that language naturally and offer to switch the language setting at the end of your reply.

MOTIVATIONAL INTERVIEWING & STYLE GUIDELINES (OARS):
1. SPECIFICITY: Reference specific words and situations the user actually said. Never give cold generic lines.
2. FORBIDDEN CLICHÉS: BANNED generic statements like "I understand how you feel" or "That sounds hard" unless immediately followed by a specific reflection of their exact words.
3. LENGTH: Exactly 2 to 5 natural, conversational sentences.
4. QUESTIONS: At most ONE gentle open question per reply (0 questions if user is in high distress or intensity >= 4).
5. HONESTY: If unsure how to help, say so honestly and suggest speaking to a counsellor or helpline (Tele-MANAS 14416 is free & 24/7).
6. PARAPHRASE: If using vetted knowledge, explain it in your own warm conversational words. NEVER quote bullet points or cite textbook terms.

OUTPUT FORMAT:
Output ONLY a raw JSON object with these exact keys:
{{
  "text": "your warm, specific empathetic reply (2-5 sentences)",
  "spoken_text": "clean spoken version for TTS (no markdown/emojis, numbers digit-by-digit)",
  "emotion": "neutral" | "happy" | "concerned" | "sad" | "surprised",
  "gesture": "wave" | "nod" | "thumbs_up" | "breathe" | "listening",
  "suggested_exercise": "breathing_4_7_8" | "grounding_54321" | "none",
  "detected_emotion": "anxiety" | "sadness" | "anger" | "stressed" | "joy" | "relief" | "curiosity" | "neutral",
  "stress_level": 0-10,
  "risk": "none" | "low" | "medium" | "high",
  "strategy_used": "{chosen_strategy}"
}}""".strip()


def build_dynamic_system_prompt(
    user_name: str,
    age: int,
    is_minor: bool,
    reasons: List[str],
    language: str,
    tone: str,
    persona_key: str,
    recent_moods: List[int],
    memories: List[str],
    recent_bot_replies: List[str],
    strategy_turn: int,
    knowledge_context: str,
    strategy: Optional[str] = None,
    emotion_hint: str = "neutral",
    stress_hint: int = 2,
    crisis_context: bool = False,
) -> str:
    """Backward compatibility wrapper around build_pass_b_system_prompt."""
    pass_a = {
        "primary_emotions": [emotion_hint],
        "secondary_emotions": ["overwhelm"] if stress_hint >= 7 else [],
        "intensity": min(5, max(1, stress_hint // 2)),
        "underlying_need": "just_be_heard",
        "topics": [],
        "cognitive_distortions": ["none"],
        "triggers_or_people_mentioned": [],
        "what_helped_before": [],
        "risk_level": "none",
        "language": language,
        "user_readiness": "exploring",
    }
    chosen = "reflect feelings"
    if strategy and any(s in strategy.lower() for s in ESCONV_STRATEGIES):
        for s in ESCONV_STRATEGIES:
            if s in strategy.lower():
                chosen = s
                break
    return build_pass_b_system_prompt(
        pass_a=pass_a,
        chosen_strategy=chosen,
        user_name=user_name,
        age=age,
        is_minor=is_minor,
        reasons=reasons,
        language=language,
        tone=tone,
        persona_key=persona_key,
        recent_moods=recent_moods,
        memories=memories,
        recent_bot_replies=recent_bot_replies,
        strategy_turn=strategy_turn,
        knowledge_context=knowledge_context,
        crisis_context=crisis_context,
    )


# ===========================================================================
# 5. LLM CALLS (Claude or Gemini, called over plain HTTPS)
# ===========================================================================
_client: Optional[httpx.AsyncClient] = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "15")))
    return _client


def _provider() -> Optional[str]:
    forced = os.getenv("LLM_PROVIDER", "").lower()
    if forced in ("anthropic", "gemini"):
        return forced
    if os.getenv("AI_PROVIDER_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return "gemini"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return None


async def _call_anthropic(system: str, messages: List[Dict[str, str]]) -> str:
    res = await _http().post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": os.getenv("ANTHROPIC_API_KEY", ""), "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"), "max_tokens": 700,
              "temperature": 0.6, "system": system, "messages": messages},
    )
    res.raise_for_status()
    return "".join(b.get("text", "") for b in res.json().get("content", []) if b.get("type") == "text")


async def _call_gemini(system: str, messages: List[Dict[str, str]]) -> str:
    pref_model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    candidate_models = [pref_model] + [m for m in ("gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash") if m != pref_model]
    key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY", "")

    last_error = None
    for model in candidate_models:
        gen_cfg: Dict[str, Any] = {"temperature": 0.5, "maxOutputTokens": 800, "responseMimeType": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            res = await _http().post(
                url,
                headers={"content-type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
                                 for m in messages],
                    "generationConfig": gen_cfg,
                },
            )
            if res.status_code == 200:
                return res.json()["candidates"][0]["content"]["parts"][0]["text"]
            if res.status_code in (400, 404, 429, 503):
                last_error = httpx.HTTPStatusError(f"Model {model} returned {res.status_code}", request=res.request, response=res)
                continue
            res.raise_for_status()
        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code in (400, 404, 429, 503):
                continue
            raise
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error
    raise RuntimeError("No candidate Gemini model succeeded")


def _parse_json_object(raw: str) -> Dict[str, Any]:
    raw = (raw or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return {}
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return {}
    return data if isinstance(data, dict) else {}


async def call_llm_json(system_prompt: str, messages: Any) -> Dict[str, Any]:
    provider = _provider()
    if not provider:
        return {}
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    for attempt in range(2):
        try:
            raw = await (_call_anthropic if provider == "anthropic" else _call_gemini)(system_prompt, messages)
            data = _parse_json_object(raw)
            if data:
                return data
        except httpx.HTTPStatusError as e:
            log.warning("LLM HTTP %s (attempt %d)", e.response.status_code, attempt + 1)
            if e.response.status_code in (400, 401, 403, 404):
                break
        except Exception as e:
            log.warning("LLM error %s (attempt %d)", type(e).__name__, attempt + 1)
        await asyncio.sleep(0.5)
    return {}


def _normalize_llm(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = str(data.get("text") or data.get("reply") or "").strip()
    if not text:
        return None
    try:
        stress = max(0, min(10, int(round(float(data.get("stress_level"))))))
    except (TypeError, ValueError):
        stress = None
    risk = str(data.get("risk", "none")).lower()
    detected = str(data.get("detected_emotion", "")).lower()
    exercise = data.get("suggested_exercise")
    return {
        "text": text,
        "spoken_text": str(data.get("spoken_text") or "").strip(),
        "emotion": data.get("emotion") if data.get("emotion") in ALLOWED_AVATAR_EMOTIONS else None,
        "gesture": data.get("gesture") if data.get("gesture") in ALLOWED_GESTURES else None,
        "suggested_exercise": exercise if exercise in ALLOWED_EXERCISES else "none",
        "detected_emotion": detected if detected in LEXICON_EMOTIONS else None,
        "stress_level": stress,
        "risk": risk if risk in RISK_ORDER else "none",
        "strategy_used": data.get("strategy_used"),
    }


# Local scripted fallbacks removed in favor of live LLM generation with connection hiccup handling.

# ===========================================================================
# 7. DATABASE HELPERS
# ===========================================================================
def _load_context(user_id: str) -> Dict[str, Any]:
    """Load conversation context including recent strategies for rotation tracking."""
    ctx: Dict[str, Any] = {"memories": [], "moods": [], "history": [], "turn_count": 0, "recent_strategies": []}
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        # Retrieve top 5 memories per turn
        cur.execute("SELECT fact FROM user_memories WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 5", (user_id,))
        ctx["memories"] = [r["fact"] for r in cur.fetchall()]
        cur.execute("SELECT score FROM mood_entries WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 5", (user_id,))
        ctx["moods"] = [r["score"] for r in cur.fetchall()]
        cur.execute("SELECT sender, text FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
                    (user_id, HISTORY_TURNS + 2))
        rows = [(r["sender"], r["text"]) for r in cur.fetchall()]
        ctx["history"] = list(reversed(rows))
        cur.execute("SELECT count(*) as count FROM chat_messages WHERE user_id = ?", (user_id,))
        ctx["turn_count"] = cur.fetchone()["count"]
        # Load recent strategies used (for anti-repetition rotation)
        try:
            cur.execute(
                "SELECT strategy_used FROM chat_messages WHERE user_id = ? AND sender = 'mascot' "
                "AND strategy_used IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 4",
                (user_id,)
            )
            ctx["recent_strategies"] = list(reversed([r[0] for r in cur.fetchall() if r[0]]))
        except Exception:
            ctx["recent_strategies"] = []  # Column may not exist yet on old DBs
    except Exception as e:
        log.warning("Context load failed: %s", type(e).__name__)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
    return ctx


def _save_memories(user_id: str, facts: List[Dict[str, str]], existing: List[str]) -> None:
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        for item in facts:
            fact_text = item.get("fact", "").strip()
            cat = item.get("category", "general")
            if fact_text and fact_text not in existing:
                cur.execute(
                    "INSERT INTO user_memories (id, user_id, category, fact) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), user_id, cat, fact_text)
                )
        conn.commit()
    except Exception as e:
        log.warning("Memory save failed: %s", type(e).__name__)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def _build_messages(history: List[Any], message: str) -> List[Dict[str, str]]:
    rows = list(history)
    if rows and rows[-1][0] != "mascot" and (rows[-1][1] or "").strip() == message.strip():
        rows.pop()
    msgs: List[Dict[str, str]] = []
    for sender, text in rows[-HISTORY_TURNS:]:
        text = (text or "").strip()[:600]
        if not text:
            continue
        role = "assistant" if sender == "mascot" else "user"
        if msgs and msgs[-1]["role"] == role:
            msgs[-1]["content"] += "\n" + text
        else:
            msgs.append({"role": role, "content": text})
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    if msgs and msgs[-1]["role"] == "user":
        msgs[-1]["content"] += "\n" + message
    else:
        msgs.append({"role": "user", "content": message})
    return msgs


# ===========================================================================
# 8. MAIN ENTRY POINT (TWO-PASS PIPELINE)
# ===========================================================================
def _finalize(result: Dict[str, Any], lang: str, emo: Dict[str, Any], turn_count: int,
              risk: str, crisis: bool, minor: bool, pass_a: Optional[Dict[str, Any]] = None,
              strategy: Optional[str] = None) -> Dict[str, Any]:
    reply = result.get("text") or result.get("reply") or ""
    final_emotion = result.get("detected_emotion") or emo["emotion"]
    result["detected_emotion"] = final_emotion
    result["state_label"] = STATE_MAP.get(final_emotion, STATE_MAP["neutral"])
    result["expression"] = EXPRESSION_MAP.get(final_emotion, "neutral")
    if result.get("emotion") not in ALLOWED_AVATAR_EMOTIONS:
        result["emotion"] = AVATAR_EMOTION.get(final_emotion, "neutral")

    llm_stress = result.get("stress_level")
    result["stress_level"] = (round(0.7 * llm_stress + 0.3 * emo["stress_level"])
                              if isinstance(llm_stress, int) else emo["stress_level"])

    if result.get("suggested_exercise") not in ALLOWED_EXERCISES:
        result["suggested_exercise"] = "none"
    if (result["suggested_exercise"] == "none" and not crisis
            and final_emotion == "anxiety" and result["stress_level"] >= 7):
        result["suggested_exercise"] = "breathing_4_7_8"

    gesture = result.get("gesture")
    if gesture not in ALLOWED_GESTURES:
        if crisis:
            gesture = "listening"
        elif final_emotion in ("anxiety", "stressed") or result["suggested_exercise"] == "breathing_4_7_8":
            gesture = "breathe"
        elif final_emotion == "joy":
            gesture = "thumbs_up"
        elif final_emotion == "sadness":
            gesture = "nod"
        elif turn_count <= 1:
            gesture = "wave"
        else:
            gesture = "nod" if turn_count % 2 == 0 else "listening"
    result["gesture"] = gesture

    spoken = result.get("spoken_text") or reply
    result["reply"] = reply
    result["text"] = reply
    result["spoken_text"] = format_spoken_text(spoken, lang)
    result["lang"] = lang
    result["risk"] = risk
    result["crisis"] = crisis
    result["helplines"] = _helpline_cards(lang, minor) if RISK_ORDER.get(risk, 0) >= RISK_ORDER["medium"] else []
    result["understanding"] = pass_a or {}
    result["strategy_used"] = strategy or result.get("strategy_used") or "reflect feelings"
    return result


async def process_chat_message(
    user_id: str,
    user_name: str,
    message: str,
    language: str = "en",
    age: int = 20,
    is_minor: bool = False,
    reasons: Optional[List[str]] = None,
    tone: str = "gentle",
    persona: str = "digital_twin",
    typing_cps: float = 0.0,
) -> Dict[str, Any]:
    reasons = reasons or []
    message = (message or "").strip()[:MAX_MESSAGE_CHARS]
    minor = bool(is_minor or (age is not None and age < 18))
    lang = resolve_language(message, language)

    ctx = _load_context(user_id)
    turn_count = ctx["turn_count"]
    history = ctx["history"]
    recent_bot = [t for s, t in reversed(history) if s == "mascot"][:6]
    recent_user = " ".join(t for s, t in history[-6:] if s != "mascot")[-400:]

    if not message:
        return _finalize(
            {"text": _FALLBACK.get(lang, _FALLBACK["en"])["default"][0]},
            lang, classify_emotion(""), turn_count, "none", False, minor
        )

    emo = classify_emotion(message, ctx["moods"])

    # -----------------------------------------------------------------------
    # LAYER 1: STRICT CRISIS SAFETY CHECK RUNS BEFORE EVERYTHING
    # -----------------------------------------------------------------------
    rule_risk = assess_risk(message)["level"]
    crisis_context = any("14416" in r for r in recent_bot[:3])

    if rule_risk == "high":
        text = build_crisis_reply(lang, minor, followup=crisis_context)
        return _finalize(
            {"text": text, "emotion": "concerned", "suggested_exercise": "none", "gesture": "listening",
             "detected_emotion": emo["emotion"] if emo["emotion"] != "neutral" else "sadness",
             "stress_level": max(emo["stress_level"], 8)},
            lang, emo, turn_count, "high", True, minor,
            pass_a={"risk_level": "high", "primary_emotions": ["distress"]},
            strategy="crisis_intervention"
        )

    # -----------------------------------------------------------------------
    # ONNX FAST PRE-CHECK (optional, informational; does NOT override safety)
    # -----------------------------------------------------------------------
    onnx_hint = await _onnx_precheck(message, lang)

    # -----------------------------------------------------------------------
    # PHASE 1: PASS A (Hidden, Fast, Clinical Understanding Pipeline)
    # Receives full conversation history + ONNX hint for richer context.
    # -----------------------------------------------------------------------
    pass_a = await analyze_understanding_pass_a(
        message=message,
        history=history,
        user_name=user_name,
        age=age,
        is_minor=minor,
        reasons=reasons,
        language_hint=lang,
        memories=ctx["memories"],
        emo=emo,
        onnx_hint=onnx_hint,
    )

    # If Pass A detects high or imminent risk, immediately switch to crisis flow
    pass_a_risk = pass_a.get("risk_level", "none")
    if pass_a_risk in ("high", "imminent"):
        text = build_crisis_reply(lang, minor, followup=crisis_context)
        return _finalize(
            {"text": text, "emotion": "concerned", "suggested_exercise": "none", "gesture": "listening",
             "detected_emotion": emo["emotion"] if emo["emotion"] != "neutral" else "sadness",
             "stress_level": max(emo["stress_level"], 8)},
            lang, emo, turn_count, "high", True, minor,
            pass_a=pass_a, strategy="crisis_intervention"
        )

    # -----------------------------------------------------------------------
    # MEMORY: Regex extraction first, then LLM-assisted extraction in parallel
    # -----------------------------------------------------------------------
    facts = extract_memories(message, emo["emotion"])
    # LLM-assisted extraction runs concurrently with strategy selection (non-blocking)
    llm_facts_task = asyncio.create_task(
        _extract_memories_llm(message, ctx["memories"])
    )
    _save_memories(user_id, facts, ctx["memories"])
    memories = [f["fact"] for f in facts] + [m for m in ctx["memories"] if m not in [f["fact"] for f in facts]]
    memories = memories[:5]

    # -----------------------------------------------------------------------
    # PHASE 2: RESPONSE STRATEGY & STAGE MODEL
    # Strategy rotation uses actual DB history so the same strategy isn't repeated.
    # -----------------------------------------------------------------------
    recent_strategies = _load_recent_strategies(user_id, n=6)
    chosen_strategy = choose_esconv_strategy(pass_a, turn_count, recent_strategies)

    # RAG knowledge retrieval (paraphrased in Pass B)
    chunks = retrieve_relevant_knowledge(message, top_k=2, emotion=emo["emotion"], extra_context=recent_user)
    knowledge_context = format_knowledge_for_prompt(chunks)

    # -----------------------------------------------------------------------
    # PHASE 1: PASS B (Visible Reply Generation Conditioned on Pass A)
    # -----------------------------------------------------------------------
    pass_b_system = build_pass_b_system_prompt(
        pass_a=pass_a,
        chosen_strategy=chosen_strategy,
        user_name=user_name,
        age=age,
        is_minor=minor,
        reasons=reasons,
        language=lang,
        tone=tone,
        persona_key=persona,
        recent_moods=ctx["moods"],
        memories=memories,
        recent_bot_replies=recent_bot,
        strategy_turn=turn_count,
        knowledge_context=knowledge_context,
        crisis_context=crisis_context,
    )
    messages = _build_messages(history, message)

    llm = _normalize_llm(await call_llm_json(pass_b_system, messages))

    if llm and llm["risk"] == "high":
        text = build_crisis_reply(lang, minor, followup=crisis_context)
        return _finalize(
            {"text": text, "emotion": "concerned", "suggested_exercise": "none", "gesture": "listening",
             "detected_emotion": llm["detected_emotion"], "stress_level": max(llm["stress_level"] or 0, 8)},
            lang, emo, turn_count, "high", True, minor,
            pass_a=pass_a, strategy="crisis_intervention"
        )

    if llm is None:
        from .autonomous_companion import generate_autonomous_companion_response
        result = generate_autonomous_companion_response(
            message=message,
            user_name=user_name,
            language=lang,
            companion_tone=tone,
            recent_bot_messages=recent_bot,
        )
        result["strategy_used"] = chosen_strategy
        final_risk = rule_risk

    else:
        result = llm
        final_risk = _max_risk(rule_risk, llm["risk"])

        # -------------------------------------------------------------------
        # ANTI-REPETITION: Compute 3-gram similarity against recent bot replies.
        # If > 0.6, regenerate ONCE with an explicit penalty against the repetitive phrase.
        # -------------------------------------------------------------------
        if recent_bot and max(calculate_ngram_similarity(result["text"], p) for p in recent_bot) > 0.6:
            retry_system = (
                pass_b_system
                + "\n\n*** STRICT REGENERATION ***: Your previous draft had over 0.6 n-gram similarity to earlier replies. "
                  "Completely change your opening words and use fresh sentence structures."
            )
            retry = _normalize_llm(await call_llm_json(retry_system, messages))
            if retry and retry["risk"] != "high":
                result = retry

    # Moderate / Medium risk: add gentle helpline nudge
    if RISK_ORDER.get(final_risk, 0) >= RISK_ORDER["medium"] and "14416" not in result["text"]:
        nudge = _NUDGE.get(lang if lang in ("ta", "hi", "te", "kn", "ml") else "en", _NUDGE["en"])
        result["text"] = f"{result['text']}\n\n{nudge}"
        result["spoken_text"] = f"{result.get('spoken_text') or ''} {nudge}".strip()

    # -----------------------------------------------------------------------
    # SAVE STRATEGY + AWAIT LLM MEMORY TASK
    # -----------------------------------------------------------------------
    _save_strategy(user_id, chosen_strategy)

    # Await LLM memory task and persist any additional facts found
    try:
        llm_facts = await asyncio.wait_for(llm_facts_task, timeout=4.0)
        if llm_facts:
            _save_memories(user_id, llm_facts, memories)
    except (asyncio.TimeoutError, Exception) as e:
        log.debug("LLM memory extraction skipped: %s", type(e).__name__)

    return _finalize(result, lang, emo, turn_count, final_risk, False, minor, pass_a=pass_a, strategy=chosen_strategy)


# ===========================================================================
# 9. SPOKEN TEXT + STREAMING
# ===========================================================================
def format_spoken_text(text: str, language: str = "en") -> str:
    clean = re.sub(r"https?://\S+", "", text or "")
    clean = re.sub(r"[*_~`#\[\]<>•]", "", clean)
    clean = re.sub(r"[\U00010000-\U0010ffff]", "", clean)
    clean = re.sub(r"[\u2600-\u27bf]", "", clean)
    clean = re.sub(r"\+?\d[\d\- ]{4,}\d", lambda m: " ".join(re.sub(r"\D", "", m.group(0))), clean)
    clean = re.sub(r"\b\d{3,}\b", lambda m: " ".join(m.group(0)), clean)
    return " ".join(clean.split()).strip()


async def stream_tokens(text: str, chunk_size: int = 4, delay: float = 0.02) -> AsyncGenerator[str, None]:
    words = text.split(" ")
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        yield f"data: {json.dumps({'token': chunk})}\n\n"
        await asyncio.sleep(delay)
    yield "data: [DONE]\n\n"
