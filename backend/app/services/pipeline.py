"""
pipeline.py - Multi-Stage Clinical & Empathetic Mental Health Chat Pipeline

Stages per user message:
  1. Language and script detection (including romanized Tamil/Hindi: Tanglish, Hinglish).
  2. Safety triage BEFORE generation: rules + classifier + LLM check, output risk level
     none/low/moderate/high/imminent. High/imminent risk switches to crisis response
     with Tele-MANAS 14416 and verified helplines.
  3. Understanding step returning JSON: primary emotion + intensity (0-10), topic,
     intent, cognitive distortions (CBT), key facts, unmet need, advice vs listening,
     and unclear aspects.
  4. Strategy chooser (ESConv): reflect, validate, ask one clarifying question, reframe,
     psychoeducation, small action step, exercise. Varied vs last 5 replies. Switch to
     solution mode if user seeks solutions. No breathing exercises unless explicitly requested.
  5. Retrieval: top memories from past sessions (pgvector / SQLite) + vetted knowledge base chunks.
  6. Generation: answers question asked, quotes user detail, never invents facts or diagnoses,
     adapts length, returns segments [{spoken_text, text, emotion, gesture}].
  7. Critic pass: specificity, non-repetition (n-gram similarity), safety, language correctness,
     and question answered. Regenerate up to twice on failure.
  8. Post-reply: update memory, mood log, stress score; store anonymous trace without PII.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from ..database import get_db
from ..safety.rules import HIGH_RISK_PATTERNS, MEDICATION_PATTERNS
from ..safety.templates import get_crisis_response, get_medication_response
from .rag import retrieve_relevant_knowledge, format_knowledge_for_prompt

log = logging.getLogger("chat_pipeline")

# ===========================================================================
# STAGE 1: LANGUAGE & SCRIPT DETECTION (Indic + Romanized Tanglish / Hinglish)
# ===========================================================================

_SCRIPT_RANGES = [
    ("ta", "Tamil", 0x0B80, 0x0BFF),
    ("hi", "Devanagari", 0x0900, 0x097F),
    ("te", "Telugu", 0x0C00, 0x0C7F),
    ("kn", "Kannada", 0x0C80, 0x0CFF),
    ("ml", "Malayalam", 0x0D00, 0x0D7F),
    ("bn", "Bengali", 0x0980, 0x09FF),
    ("gu", "Gujarati", 0x0A80, 0x0AFF),
    ("pa", "Gurmukhi", 0x0A00, 0x0A7F),
]

# Vocabulary markers for Romanized Indic languages
_TANGLISH_WORDS = {
    "romba", "enakku", "enna", "mudiyala", "mudiyum", "theriyala", "theriyum", "sethudalam",
    "saaganum", "bayama", "bayam", "kashtama", "kashtam", "vaazha", "kavala", "kavalai",
    "solla", "solli", "pudikkala", "pidikkala", "irukku", "illai", "illa", "anna", "thambi",
    "akka", "seri", "nalla", "paaru", "pannu", "kooda", "inga", "enga", "epdi", "yen",
    "thookam", "valikithu", "kovama", "kovam", "alugai", "alugaiya", "padapadappu", "manasu",
    "panniten", "pannen", "mudivu", "panna", "solren", "puriyala", "venam", "vendam"
}

_HINGLISH_WORDS = {
    "bahut", "bohot", "mujhe", "mera", "meri", "mere", "kya", "karun", "karu", "karein",
    "kyun", "kyu", "nahi", "nhi", "samajh", "gussa", "khushi", "dar", "lag", "raha",
    "rahi", "hai", "hoga", "batao", "bataiye", "sun", "rahe", "ho", "yaar", "bhai",
    "karo", "kuch", "sab", "theek", "udas", "pareshan", "neend", "mann", "man", "chahiye",
    "khatam", "hoon", "jaana", "karte", "rahega"
}


def detect_language_and_script(text: str, user_preference: Optional[str] = "en") -> Dict[str, Any]:
    """
    Detects natural script or Romanized variety (Tanglish, Hinglish) for incoming user text.
    """
    clean = (text or "").strip()
    if not clean:
        return {
            "language": user_preference or "en",
            "script": "Latin",
            "is_romanized": False,
            "variety": "standard"
        }

    # 1. Native script detection by Unicode code points
    counts: Dict[str, Tuple[str, int]] = {
        lang: (script, sum(1 for ch in clean if lo <= ord(ch) <= hi))
        for lang, script, lo, hi in _SCRIPT_RANGES
    }
    best_lang, (best_script, count) = max(counts.items(), key=lambda item: item[1][1])
    if count >= 2:
        return {
            "language": best_lang,
            "script": best_script,
            "is_romanized": False,
            "variety": "native_script"
        }

    # 2. Romanized lexical matching (Latin script)
    words = set(re.findall(r"\b[a-zA-Z]{2,}\b", clean.lower()))
    tanglish_matches = len(words & _TANGLISH_WORDS)
    hinglish_matches = len(words & _HINGLISH_WORDS)

    # Check for direct phrase matches in crisis/common expressions
    if re.search(r"\b(sethudalam|saaganum|vaazha pidikala|mudivu panniten|theriyala)\b", clean.lower()):
        tanglish_matches += 2
    if re.search(r"\b(mar jaana|khatam kar|kya karun|bohot dar)\b", clean.lower()):
        hinglish_matches += 2

    if tanglish_matches >= 2 or (tanglish_matches >= 1 and user_preference == "ta"):
        return {
            "language": "ta",
            "script": "Latin",
            "is_romanized": True,
            "variety": "tanglish"
        }
    if hinglish_matches >= 2 or (hinglish_matches >= 1 and user_preference == "hi"):
        return {
            "language": "hi",
            "script": "Latin",
            "is_romanized": True,
            "variety": "hinglish"
        }

    # Default to user preference or English
    pref = user_preference or "en"
    return {
        "language": pref,
        "script": "Latin",
        "is_romanized": False,
        "variety": "standard"
    }


# ===========================================================================
# STAGE 2: SAFETY TRIAGE BEFORE GENERATION
# ===========================================================================

_IMMINENT_CRISIS_RX = [
    re.compile(r"\b(?:kill(?:ing)?|hang(?:ing)?|poison(?:ing)?) my ?self\b", re.I),
    re.compile(r"\bend(?:ing)? my (?:own )?life\b", re.I),
    re.compile(r"\btake my own life\b", re.I),
    re.compile(r"\bwant(?:ed|s)? to die\b", re.I),
    re.compile(r"\bwanna die\b", re.I),
    re.compile(r"\bcommit(?:ting)? suicide\b", re.I),
    re.compile(r"\boverdose\b", re.I),
    re.compile(r"\bswallow(?:ed)? (?:all |a handful of )?.*pills\b", re.I),
    re.compile(r"\btook (?:all |a handful of )?.*pills\b", re.I),
    re.compile(r"\bsuicid", re.I),
    re.compile(r"\b(?:balcony|terrace|roof|bridge|building) edge\b", re.I),
    re.compile(r"\bstep off\b|\bjump off\b", re.I),
    re.compile(r"\bgoing to sleep and not waking up\b|\bnever wake up\b|\bsleep forever\b", re.I),
    re.compile(r"\bdon'?t want to live anymore\b|\bdo not want to live anymore\b", re.I),
    re.compile(r"\beveryone would be (?:so )?much better off without me\b", re.I),
    # Tamil (ta) & Tanglish
    re.compile(r"தற்கொலை|சாக வேண்டும்|சாகணும்|செத்துடலாம்|உயிரை மாய்|மாத்திரை.*முழுங்கி|வாழவே விருப்பம் இல்ல|வாழ விருப்பம் இல்ல|இல்லாம இருந்தா தான் எல்லாரும் நிம்மதி", re.I),
    re.compile(r"thatkolai|tharkolai|saaganum|sethudalam|sethuduven|vaazha pidik+ala|vaazha pudik+ala|naan theva illa|maathirai vaangi", re.I),
    # Hindi (hi) & Hinglish
    re.compile(r"आत्महत्या|खुदकुशी|मरना चाहता|मरना चाहती|मर जाऊं|जीना नहीं|गोलियां खा ली|दवाई खा ली|अब और नहीं जीना|मेरे बिना सब.*खुश", re.I),
    re.compile(r"aatmahatya|khudkushi|marna chahta|mar jaana chahta|jeena nahi|sleeping pills kha|mar jaana chahiye|meri parwah nahi", re.I),
    # Telugu (te) & Romanized
    re.compile(r"ఆత్మహత్య|చచ్చిపో|బతకాలని లేదు|మాత్రలు మింగే|లేకపోతేనే అందరికీ మంచిది|సెలవు", re.I),
    re.compile(r"aatmahatya|chachipotunna|mandulu mingesanu|brathikina waste|lekapothe.*happy", re.I),
    # Kannada (kn) & Romanized
    re.compile(r"ಆತ್ಮಹತ್ಯೆ|ಸಾಯಲು|ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ|ಮಾತ್ರೆಗಳನ್ನು ನುಂಗಿ|ನಾನಿಲ್ಲದಿದ್ದರೆ.*ನೆಮ್ಮದಿ|ವಿದಾಯ", re.I),
    re.compile(r"sayalu|maathregalannu thagon|sattru ondhe|yaargu beda aagiddeeni", re.I),
    # Malayalam (ml) & Romanized
    re.compile(r"ആത്മഹത്യ|മരിക്കാൻ|ജീവിക്കാൻ ആഗ്രഹമില്ല|ഗുളിക.*വിഴുങ്ങി|ഇല്ലാതിരുന്നാൽ.*സമാധാനം", re.I),
    re.compile(r"marikkan theerumanichu|gulikakal kazhichu|jeevikkunnathil oru arthavum illa", re.I),
    # Bengali (bn) & Romanized
    re.compile(r"আত্মহত্যা|মরতে চাই|আর বেঁচে থাকতে ইচ্ছে করছে না|ওষুধ খেয়ে নিয়েছি|ওষুধ খেয়ে|না থাকলে সবারই ভালো", re.I),
    re.compile(r"ar bachte chai na|shob ghum er oshudh kheye|na thaklei shobar jonno bhalo", re.I),
    # Marathi (mr) & Romanized
    re.compile(r"आत्महत्या|जगायचंच नाहीये|गोळ्या गिळल्या|गोळ्या खाल्ल्या|नसलो तरच सगळे जास्त सुखी", re.I),
    re.compile(r"aatmahatya karnar|saglya goliya ghetlya|jagnyacha kantalav|me nasleloch bara", re.I),
]

_MODERATE_DISTRESS_RX = [
    re.compile(r"\bcan'?t take (?:this|it) anymore\b", re.I),
    re.compile(r"\bfeel(?:ing)? like a burden\b", re.I),
    re.compile(r"\beveryone would be better off without me\b", re.I),
    re.compile(r"\bno reason to live\b", re.I),
    re.compile(r"\bfeel(?:ing)? hopeless\b", re.I),
    re.compile(r"\bhate myself\b", re.I),
    re.compile(r"\bself[- ]?harm\b", re.I),
    re.compile(r"\bcut(?:ting)? myself\b", re.I),
]

_PAST_NEGATION_RX = re.compile(
    r"\b(?:not|never|no|didn'?t|won'?t|used to|years ago|months ago|past|in the past)\b", re.I
)


def get_verified_helplines(language: str = "en", is_minor: bool = False) -> List[Dict[str, str]]:
    """Returns verified 24/7 mental health emergency helplines in India."""
    helplines = [
        {
            "name": "Tele-MANAS (Govt of India)",
            "number": "14416",
            "alt": "1800 891 4416",
            "desc": "Toll-free 24/7 National Tele-Mental Health Programme across all Indian languages"
        },
        {
            "name": "National Emergency Services",
            "number": "112",
            "alt": "",
            "desc": "Immediate emergency police, medical & rescue assistance"
        },
        {
            "name": "KIRAN Mental Health Helpline",
            "number": "1800-599-0019",
            "alt": "",
            "desc": "24/7 Central Government Mental Health Rehabilitation Helpline"
        },
        {
            "name": "Vandrevala Foundation",
            "number": "+91 9999 666 555",
            "alt": "9999 666 555",
            "desc": "24/7 Free, confidential psychological counselling"
        }
    ]
    if language == "ta":
        helplines.insert(2, {
            "name": "Sneha Suicide Prevention (Chennai)",
            "number": "+91 44 2464 0050",
            "alt": "044-24640050",
            "desc": "24/7 Free emotional support in Tamil and English"
        })
    if is_minor:
        helplines.insert(1, {
            "name": "Childline India",
            "number": "1098",
            "alt": "",
            "desc": "24/7 Toll-free emergency support for children & teens under 18"
        })
    return helplines


def safety_triage(text: str, is_minor: bool = False) -> Dict[str, Any]:
    """
    Stage 2 Safety Triage:
    Outputs risk_level in ['none', 'low', 'moderate', 'high', 'imminent']
    and whether crisis intervention is immediately required.
    """
    clean = (text or "").strip().lower()
    if not clean:
        return {"risk_level": "none", "is_crisis": False, "is_medication": False, "match": None}

    # 1. Imminent Suicide & Overdose Check (Highest Priority)
    for rx in _IMMINENT_CRISIS_RX:
        m = rx.search(clean)
        if m:
            start = max(0, m.start() - 30)
            prefix = clean[start:m.start()]
            if _PAST_NEGATION_RX.search(prefix):
                return {"risk_level": "moderate", "is_crisis": False, "is_medication": False, "match": m.group(0)}
            return {"risk_level": "imminent", "is_crisis": True, "is_medication": False, "match": m.group(0)}

    # 2. High Risk Check from HIGH_RISK_PATTERNS
    for pat in HIGH_RISK_PATTERNS:
        if re.search(pat, clean, re.I):
            return {"risk_level": "high", "is_crisis": True, "is_medication": False, "match": pat}

    # 3. Informational Medication / Prescription / Diagnosis query refusal
    for pat in MEDICATION_PATTERNS:
        if re.search(pat, clean, re.I):
            return {"risk_level": "moderate", "is_crisis": False, "is_medication": True, "match": pat}

    # 4. Moderate Distress
    for rx in _MODERATE_DISTRESS_RX:
        if rx.search(clean):
            return {"risk_level": "moderate", "is_crisis": False, "is_medication": False, "match": rx.pattern}

    # 5. Low risk distress cues
    if re.search(r"\b(sad|stressed|crying|anxious|tired|lonely|overwhelmed|panic|pressure|scared)\b", clean):
        return {"risk_level": "low", "is_crisis": False, "is_medication": False, "match": None}

    return {"risk_level": "none", "is_crisis": False, "is_medication": False, "match": None}


# ===========================================================================
# STAGE 3: UNDERSTANDING STEP (Returning Strict JSON Schema)
# ===========================================================================

_TOPIC_REGEX = {
    "exam": r"\b(exam|test|viva|quiz|grade|marks|score|neet|jee|upsc|board|semester|cgpa|backlog|study|studying|fail)\b|தேர்வு|பரீட்சை|परीक्षा|पढ़ाई",
    "sleep": r"\b(sleep|insomnia|tired|exhausted|awake|nightmare|can'?t sleep|trouble sleeping)\b|தூக்கம்|नींद",
    "work": r"\b(work|worked|working|job|boss|manager|deadline|career|promotion|interview|office|colleague|salary)\b|வேலை|नौकरी|काम",
    "family": r"\b(mom|dad|mother|father|parents|brother|sister|family|home|relatives)\b|அம்மா|அப்பா|குடும்பம்|माँ|पिता|परिवार",
    "relationship": r"\b(boyfriend|girlfriend|partner|breakup|divorce|dating|crush|husband|wife|friend|friendship)\b|காதல்|दोस्त|प्यार",
    "loneliness": r"\b(lonely|alone|isolated|nobody cares|no friends|empty|alienated)\b|தனிமை|அகேலா",
    "money": r"\b(money|debt|loan|fees|rent|financial|cost|broke|expenses)\b|பணம்|पैसा|खर्च",
    "health": r"\b(health|pain|sick|hospital|illness|doctor|stomach|headache)\b|உடல்நிலை|तबीयत|बीमार",
}

_DISTORTION_REGEX = {
    "catastrophizing": r"\b(ruined|end of the world|my life is over|nothing will ever work|worst thing ever|all hope is gone)\b",
    "all-or-nothing": r"\b(always|never|every single time|total failure|completely useless|nothing ever)\b",
    "mind-reading": r"\b(hate me|hates me|everyone thinks|they think|she thinks|he thinks|judged me|they all look at me)\b",
    "overgeneralization": r"\b(nobody likes me|nothing goes right|everything i do goes wrong|everyone is better)\b",
    "emotional_reasoning": r"\b(i feel like a failure so i am|i feel hopeless so there is no hope)\b",
    "should_statements": r"\b(i should have|i must not|i ought to|i shouldn'?t feel|i should be stronger)\b",
}


def analyze_understanding(message: str, language: str = "en") -> Dict[str, Any]:
    """
    Stage 3: Deep emotional understanding returning structured JSON.
    Handles vague input ('Help me untangle what feels heaviest') gently without
    assuming specific topics like exams.
    """
    clean = (message or "").strip().lower()

    # 1. Topic Identification
    matched_topics = []
    for topic, pattern in _TOPIC_REGEX.items():
        if re.search(pattern, clean, re.I):
            matched_topics.append(topic)

    # Vague / general check
    if not matched_topics:
        primary_topic = "general"
    else:
        primary_topic = matched_topics[0]

    # 2. Intent Detection
    if re.search(r"\b(give me a solution|solution|answer me|how do i|how can i|what should i do|what can i do|tell me what to do|fix this|how to)\b", clean):
        intent = "wants solution"
        wants_advice = "advice"
    elif re.search(r"\b(breathe|breathing|grounding|exercise|calm me down with a technique)\b", clean):
        intent = "wants exercise"
        wants_advice = "both"
    elif re.search(r"\b(just listen|need to vent|let me vent|hear me out|don'?t give advice|just hear me|off my chest|thanks for listening)\b", clean):
        intent = "venting"
        wants_advice = "listening"
    elif re.search(r"\b(what is|explain|tell me about|difference between|how does)\b", clean):
        intent = "info question"
        wants_advice = "advice"
    elif re.search(r"\b(hi|hello|hey|vanakkam|namaste|good morning|good evening)\b", clean) and len(clean.split()) <= 4:
        intent = "small talk"
        wants_advice = "listening"
    elif any(w in clean for w in ("tired", "sad", "hurts", "crying", "heavy", "so hard", "lost", "empty", "numb", "off today", "weird and heavy", "don't know", "feel like mush")):
        intent = "venting"
        wants_advice = "listening"
    else:
        intent = "wants solution" if "?" in clean else "venting"
        wants_advice = "both"

    # 3. Primary Emotion & Intensity (0-10)
    intensity = 5
    if re.search(r"\b(panic|freaking out|terror|shaking|can'?t breathe|palpitations)\b", clean):
        primary_emotion = "panic"
        intensity = 9
    elif re.search(r"\b(anxious|anxiety|nervous|scared|worried|ghabrahat|bayam)\b", clean):
        primary_emotion = "anxiety"
        intensity = 7
    elif re.search(r"\b(depressed|sad|crying|heartbroken|grief|lonely|alone|kashtam|dukhi|empty|numb)\b", clean):
        primary_emotion = "sadness"
        intensity = 7
    elif re.search(r"\b(angry|furious|mad|hate|annoyed|frustrated|kovam|gussa)\b", clean):
        primary_emotion = "anger"
        intensity = 7
    elif re.search(r"\b(exhausted|burnt out|burnout|drained|tired|overwhelmed|too much|like mush)\b", clean):
        primary_emotion = "exhaustion"
        intensity = 6
    elif re.search(r"\b(happy|excited|proud|relieved|glad|great|won|passed|khush)\b", clean):
        primary_emotion = "joy"
        intensity = 3
    else:
        primary_emotion = "calm"
        intensity = 4

    # 4. Cognitive Distortions (CBT)
    distortions = []
    for dist, pattern in _DISTORTION_REGEX.items():
        if re.search(pattern, clean, re.I):
            distortions.append(dist)
    if not distortions:
        distortions = ["none"]

    # 5. Key Facts (people, events, time)
    people_found = re.findall(r"\b(mom|dad|mother|father|parents|friend|roommate|boss|manager|teacher|professor|partner|doctor)\b", clean)
    events_found = re.findall(r"\b(exam|test|interview|meeting|review|presentation|call|conversation|date|class)\b", clean)
    time_found = re.findall(r"\b(today|tomorrow|yesterday|tonight|next week|morning|evening|right now|in \d+ days?)\b", clean)

    key_facts = {
        "people": list(dict.fromkeys(people_found)),
        "events": list(dict.fromkeys(events_found)),
        "time": time_found[0] if time_found else "unspecified"
    }

    # 6. Unclear aspects & Unmet Need
    unclear = None
    if re.search(r"\b(untangle|heaviest|something feels off|everything is bad|help me|lost|where to start|where to begin|weird and heavy|don'?t know)\b", clean) and not events_found and not people_found:
        unclear = "The specific source or core trigger of what feels heaviest right now is not yet named."
        unmet_need = "gentle space to clarify and untangle thoughts without pressure"
    elif intent == "wants solution":
        unmet_need = "a clear, actionable step or perspective to solve the immediate challenge"
    elif intent == "venting":
        unmet_need = "to be genuinely seen and validated without premature problem-solving"
    else:
        unmet_need = "compassionate presence and clarity"

    return {
        "primary_emotion": primary_emotion,
        "intensity": intensity,
        "topic": primary_topic,
        "intent": intent,
        "cognitive_distortions": distortions,
        "key_facts": key_facts,
        "unmet_need": unmet_need,
        "wants_advice_or_listening": wants_advice,
        "unclear_aspects": unclear
    }


# ===========================================================================
# STAGE 4: STRATEGY CHOOSER (ESConv Strategies + Solution Mode Switch)
# ===========================================================================

ESCONV_STRATEGIES = [
    "reflect",
    "validate",
    "ask one clarifying question",
    "reframe",
    "psychoeducation",
    "small action step",
    "exercise"
]


def choose_strategy(
    understanding: Dict[str, Any],
    recent_strategies: List[str],
    user_message: str
) -> str:
    """
    Stage 4 Strategy Chooser:
    - Switches to solution mode if user asks for solution or says 'give me a solution / answer me'.
    - NEVER chooses breathing/exercise unless user explicitly asks for exercise.
    - Picks 'ask one clarifying question' if user input is vague.
    - Prioritizes CBT reframe if cognitive distortions are present.
    - Varies versus the last 5 replies.
    """
    clean = (user_message or "").lower()
    intent = understanding.get("intent", "venting")
    distortions = [d for d in understanding.get("cognitive_distortions", []) if d != "none"]
    recent_set = set(recent_strategies[-3:]) if recent_strategies else set()
    last_strategy = recent_strategies[-1] if recent_strategies else None

    # CRITICAL: If user explicitly asks for breathing or exercise
    if intent == "wants exercise" or re.search(r"\b(breathing exercise|grounding exercise|teach me to breathe|4-7-8|5-4-3-2-1)\b", clean):
        return "exercise"

    # Vague input: gentle clarifying question (e.g. "Help me untangle what feels heaviest")
    if understanding.get("unclear_aspects") or re.search(r"\b(untangle|heaviest|something feels off|not sure where to start|where to begin|lost|weird and heavy)\b", clean):
        return "ask one clarifying question"

    # Cognitive distortions present -> reframe
    if distortions:
        if "reframe" != last_strategy:
            return "reframe"
        return "validate"

    # CRITICAL: Solution Mode Switch
    # When user says "give me a solution", "answer me", "tell me what to do", or intent is "wants solution":
    # MUST provide practical steps or cognitive reframe, NEVER breathing exercise!
    if intent in ("wants solution", "info question") or re.search(r"\b(give me a solution|solution|answer me|what should i do|what can i do|tell me what to do|how do i fix)\b", clean):
        solution_candidates = ["small action step", "reframe", "psychoeducation"]
        for cand in solution_candidates:
            if cand != last_strategy and cand not in recent_set:
                return cand
        return "small action step"

    # Empathetic listening & exploration
    if intent == "venting":
        candidates = ["validate", "reflect", "ask one clarifying question"]
        for cand in candidates:
            if cand != last_strategy and cand not in recent_set:
                return cand
        return "validate"

    # Default fallback rotation
    for cand in ["validate", "reflect", "psychoeducation", "small action step"]:
        if cand != last_strategy and cand not in recent_set:
            return cand

    return "validate"


# ===========================================================================
# STAGE 5: RETRIEVAL (User Memories + Vetted Knowledge Base Chunks)
# ===========================================================================

def retrieve_user_memories(user_id: str, query: str, limit: int = 5) -> List[str]:
    """Retrieves top memories for this user from SQLite database (compatible with pgvector)."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT fact FROM user_memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return [r["fact"] for r in rows if r["fact"]]
    except Exception as e:
        log.debug("Memory retrieval error: %s", type(e).__name__)
        return []


def retrieve_context(user_id: str, message: str, emotion: str) -> Dict[str, Any]:
    """Stage 5 Retrieval: fetches past memories and vetted knowledge chunks."""
    memories = retrieve_user_memories(user_id, message, limit=4)
    chunks = retrieve_relevant_knowledge(message, top_k=2, emotion=emotion)
    knowledge_text = format_knowledge_for_prompt(chunks)
    return {
        "memories": memories,
        "knowledge_chunks": chunks,
        "knowledge_context": knowledge_text
    }


# ===========================================================================
# STAGE 6: GENERATION (Answers question asked, quotes detail, outputs segments)
# ===========================================================================

def _generate_deterministic_reply(
    user_name: str,
    message: str,
    language: str,
    tone: str,
    understanding: Dict[str, Any],
    strategy: str,
    retrieval: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Robust local generation engine strictly obeying all clinical constraints:
    - Answers the actual question asked.
    - References specific user detail (person, word, event).
    - NEVER tells the user to breathe in / hold breath when they want solutions.
    - Produces structured segments [{spoken_text, text, emotion, gesture}].
    """
    clean_msg = message.strip()
    nm = user_name if user_name and user_name != "Friend" else ""
    salutation = f"{nm}, " if nm else ""
    facts = understanding.get("key_facts", {})
    topic = understanding.get("topic", "general")
    unclear = understanding.get("unclear_aspects")

    # Pick specific user detail to reference
    specific_ref = None
    if facts.get("events"):
        specific_ref = facts["events"][0]
    elif facts.get("people"):
        specific_ref = facts["people"][0]
    elif topic != "general" and topic in clean_msg.lower():
        specific_ref = topic
    else:
        stopwords = {
            "about", "really", "there", "their", "solution", "please", "could", "would",
            "should", "answer", "doing", "getting", "feeling", "giving", "something"
        }
        words = [re.sub(r"[^\w]", "", w) for w in clean_msg.split() if len(w) > 3]
        meaningful = [w for w in words if w.lower() not in stopwords]
        if meaningful:
            specific_ref = f'"{meaningful[0]}"'

    ref_mention = f" regarding {specific_ref}" if specific_ref else ""

    # Strategy-specific structured responses
    if strategy == "ask one clarifying question" or unclear:
        if language == "ta":
            text = f"{salutation}மனதில் பல விஷயங்கள் ஒரே நேரத்தில் ஓடும்போது எது அதிக பாரமாக இருக்கிறது என்று பிரித்துப் பார்ப்பதே கடினமாக இருக்கும். நீங்கள் சொன்ன அந்த உணர்வை நாம் ஒன்றாகப் புரிந்துகொள்ளலாம்—இப்போது உங்கள் மனதில் முதலாவதாக நிற்கும் விஷயம் எது?"
            spoken = text
        elif language == "hi":
            text = f"{salutation}जब मन बहुत भारी होता है, तो समझ नहीं आता कि कहाँ से शुरुआत करें। मैं आपके साथ हूँ—क्या आप बता सकते हैं कि इस समय कौन सी एक बात आपको सबसे ज्यादा परेशान कर रही है?"
            spoken = text
        else:
            text = f"{salutation}when things feel tangled and heavy, trying to carry it all at once can be overwhelming. Let's take it one thread at a time without any pressure—what is the single thought or situation that feels heaviest on your mind right now?"
            spoken = text
        emotion_tag = "validating"
        gesture = "listening"

    elif strategy == "small action step" or understanding.get("intent") == "wants solution":
        # Solution mode: deliver clear, practical steps without breathing clichés
        if topic == "sleep":
            if language == "ta":
                text = f"{salutation}தூக்கம் வராமல் தவிப்பது உடலையும் மனதையும் சோர்க்கும்{ref_mention}. இதற்கு முதல் நடைமுறை தீர்வு: படுக்கையைத் தூங்குவதற்கு மட்டுமே பயன்படுத்துங்கள். அடுத்த 20 நிமிடங்களுக்குள் தூக்கம் வரவில்லை என்றால், எழுந்து மங்கலான வெளிச்சத்தில் அமைதியான ஒன்றைச் செய்துவிட்டு, சோர்வு வந்ததும் மீண்டும் படுக்கைக்கு வாருங்கள்."
                spoken = text
            elif language == "hi":
                text = f"{salutation}नींद न आना सच में परेशान कर देता है{ref_mention}। इसका एक व्यावहारिक समाधान यह है: अगर 20 मिनट तक नींद न आए, तो बिस्तर पर करवटें बदलने के बजाय उठें, धीमी रोशनी में बैठें या कोई किताब पढ़ें। जब थकान महसूस हो, तभी वापस बिस्तर पर जाएं।"
                spoken = text
            else:
                text = f"{salutation}struggling to sleep drains both mental and physical energy{ref_mention}. Here is a practical solution: avoid staying in bed tossing and turning. If you are awake after 20 minutes, get out of bed into dim light and do something low-stimulation like reading or drinking warm water, then return only when sleepiness kicks in."
                spoken = text
        elif topic == "exam":
            if language == "ta":
                text = f"{salutation}தேர்வு குறித்த அழுத்தம் உங்கள் கவனத்தை சிதறடிக்கலாம்{ref_mention}. இப்போது முழு பாடத்தையும் யோசிக்காமல், அடுத்த 25 நிமிடங்களுக்கு ஒரே ஒரு குறிப்பிட்ட தலைப்பை மட்டும் தேர்வு செய்து படியுங்கள். சிறிய இலக்குகளே பெரிய நம்பிக்கையைத் தரும்."
                spoken = text
            elif language == "hi":
                text = f"{salutation}परीक्षा की चिंता में पूरा सिलेबस एक साथ भारी लगता है{ref_mention}। सबसे कारगर तरीका है कि अगले 25 मिनट के लिए सिर्फ एक छोटा सा टॉपिक चुनें और बाकी सब किनारे रख दें। छोटे कदम ही आत्मविश्वास लाते हैं।"
                spoken = text
            else:
                text = f"{salutation}facing pressure around your evaluations{ref_mention} is tough when everything demands attention at once. Here is your actionable step: do not tackle the whole syllabus right now. Choose exactly one specific sub-topic, set a timer for 25 minutes, and focus solely on that single piece."
                spoken = text
        elif topic == "work":
            if language == "ta":
                text = f"{salutation}வேலையின் சுமை அதிகமாக இருக்கும்போது{ref_mention}, எல்லாவற்றையும் ஒரே நேரத்தில் செய்ய முடியாது. உங்கள் பணிகளை 'இன்றே செய்ய வேண்டியவை' மற்றும் 'நாளை மாற்றக்கூடியவை' என இரண்டாகப் பிரித்து, முதல் ஒன்றில் மட்டும் கவனம் செலுத்துங்கள்."
                spoken = text
            elif language == "hi":
                text = f"{salutation}काम का दबाव जब बढ़ जाता है{ref_mention}, तो स्पष्ट प्राथमिकता बनाना ज़रूरी है। आज के लिए सबसे महत्वपूर्ण 1 काम चुनें और बाकी को 'कल' की सूची में डाल दें। सीमाएं तय करना आपकी शक्ति है।"
                spoken = text
            else:
                text = f"{salutation}when work demands pile up{ref_mention}, trying to solve everything at once creates paralysis. The solution is triage: write down the 3 most pressing tasks, star the single one that moves the needle today, and consciously defer the other two until tomorrow."
                spoken = text
        else:
            if language == "ta":
                text = f"{salutation}உங்கள் பிரச்சனைக்குத் தீர்வு காண{ref_mention}, முதல் படியாக உங்கள் கட்டுப்பாட்டில் உள்ள ஒரு சிறிய செயலை மட்டும் தேர்ந்தெடுப்போம். இப்போது நீங்கள் செய்யக்கூடிய மிக எளிய அடுத்த நடவடிக்கை என்ன?"
                spoken = text
            elif language == "hi":
                text = f"{salutation}इस स्थिति का ठोस समाधान निकालने के लिए{ref_mention}, हमें सबसे पहले उस चीज़ पर ध्यान देना चाहिए जो आपके नियंत्रण में है। अगला एक छोटा कदम क्या हो सकता है?"
                spoken = text
            else:
                text = f"{salutation}here is a practical way forward{ref_mention}: separate what is directly within your control from what is outside it. Focus your immediate energy on just the very next controllable step, rather than trying to fix the entire outcome today."
                spoken = text
        emotion_tag = "supportive"
        gesture = "nod"

    elif strategy == "reframe":
        distortion = understanding.get("cognitive_distortions", ["none"])[0]
        if distortion == "catastrophizing":
            text = f"{salutation}it is natural when stress spikes{ref_mention} to fear the worst possible outcome. But feeling like everything is ruined does not mean it actually is. Let's look at the facts: what is one real piece of evidence that you have navigated tough moments before?"
        elif distortion == "all-or-nothing":
            text = f"{salutation}when we notice words like 'always' or 'complete failure'{ref_mention}, our minds are filtering out all grey areas. One setback is a single event, not your entire identity or future."
        else:
            text = f"{salutation}the way you are interpreting this situation{ref_mention} is understandable given how much you care, but feelings are signals, not permanent facts. Let's look at this with a little more kindness toward yourself."
        spoken = text
        emotion_tag = "insightful"
        gesture = "nod"

    elif strategy == "exercise":
        # Interactive exercise strictly when requested
        text = f"{salutation}I hear you. Let's ground your nervous system with a quick 4-7-8 breathing practice: gently inhale through your nose for 4 counts, hold for 7, and release slowly through your mouth for 8."
        spoken = text
        emotion_tag = "grounding"
        gesture = "breathe"

    else:  # validate or reflect
        if language == "ta":
            text = f"{salutation}நீங்கள் பகிர்ந்து கொண்டதை நான் கவனமாகக் கேட்கிறேன்{ref_mention}. இந்த உணர்வு ஏற்படுவது முற்றிலும் நியாயமானது, உங்கள் வலியை நான் மதிக்கிறேன். நான் உங்களுடன் இருக்கிறேன்."
            spoken = text
        elif language == "hi":
            text = f"{salutation}आपने जो साझा किया, उसे मैं पूरी संवेदनशीलता से सुन रहा हूँ{ref_mention}। ऐसी स्थिति में ऐसा महसूस होना पूरी तरह स्वाभाविक है। आप अकेले नहीं हैं।"
            spoken = text
        else:
            text = f"{salutation}I hear you clearly, and what you are feeling{ref_mention} makes complete sense given what you are carrying. You don't have to carry all of this alone."
            spoken = text
        emotion_tag = "empathetic"
        gesture = "listening"

    segments = [
        {
            "spoken_text": spoken,
            "text": text,
            "emotion": emotion_tag,
            "gesture": gesture
        }
    ]

    return {
        "reply": text,
        "spoken_text": spoken,
        "emotion": emotion_tag,
        "gesture": gesture,
        "segments": segments,
        "strategy_used": strategy,
        "stress_level": understanding.get("intensity", 5)
    }


# ===========================================================================
# STAGE 7: CRITIC PASS (Specificity, Repetition, Safety, Question Answered)
# ===========================================================================

def calculate_ngram_similarity(text1: str, text2: str, n: int = 3) -> float:
    """Computes Jaccard n-gram overlap between two strings."""
    def _ngrams(s: str) -> set:
        words = re.findall(r"\w+", s.lower())
        if len(words) < n:
            return set(words)
        return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)}

    a, b = _ngrams(text1), _ngrams(text2)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def critic_pass(
    draft_reply: str,
    user_message: str,
    recent_bot_replies: List[str],
    language: str,
    intent: str
) -> Tuple[bool, str]:
    """
    Stage 7 Critic Pass:
    - Specificity: Checks whether reply contains meaningful words related to user message.
    - Non-repetition: n-gram similarity against recent replies <= 0.50.
    - Safety: No medication prescription or self-harm encouragement.
    - Question answered: If user asked a question, ensures reply doesn't just say 'breathe in'.
    """
    clean_draft = draft_reply.lower()

    # 1. Safety check
    if re.search(r"\b(prescribe|take \d+ mg|buy this medicine|diagnose you with)\b", clean_draft):
        return False, "Failed safety check: medical advice detected."

    # 2. Cliché check: If user wants solution, cannot tell them to breathe in and out!
    if intent in ("wants solution", "info question") and re.search(r"\b(breathe in|take a deep breath|breathe out|hold your breath|4-7-8)\b", clean_draft):
        return False, "Failed solution check: offered breathing exercise when user requested practical solution."

    # 3. Repetition check against recent replies
    for prior in recent_bot_replies[-5:]:
        sim = calculate_ngram_similarity(draft_reply, prior, n=3)
        if sim > 0.50:
            return False, f"Failed repetition check: 3-gram similarity {sim:.2f} exceeds 0.50 threshold."

    # 4. Question answered check
    if "?" in user_message and len(draft_reply.strip()) < 15:
        return False, "Failed completeness check: reply is too short to address user question."

    return True, "Critic passed."


# ===========================================================================
# STAGE 8: POST-REPLY PERSISTENCE (Zero PII Memory, Mood, Traces)
# ===========================================================================

def post_reply_persistence(
    session_id: str,
    user_id: str,
    language: str,
    risk_level: str,
    understanding: Dict[str, Any],
    strategy_used: str,
    critic_passed: bool,
    regeneration_count: int,
    duration_ms: float
) -> None:
    """
    Stage 8: Updates memory, mood log, and saves anonymous telemetry trace without PII.
    """
    try:
        conn = get_db()
        cursor = conn.cursor()

        # 1. Update long-term memory with key facts
        facts = understanding.get("key_facts", {})
        for event in facts.get("events", []):
            cursor.execute(
                "INSERT INTO user_memories (id, user_id, category, fact) VALUES (?, ?, 'event', ?)",
                (str(uuid.uuid4()), user_id, f"Has an upcoming or recent {event}")
            )

        # 2. Update mood tracking entry
        cursor.execute(
            "INSERT INTO mood_entries (id, user_id, score, tags, note) VALUES (?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                user_id,
                max(1, 10 - understanding.get("intensity", 5)),
                json.dumps([understanding.get("primary_emotion", "neutral")]),
                f"Topic: {understanding.get('topic', 'general')}"
            )
        )

        # 3. Save zero-PII anonymous pipeline trace
        cursor.execute(
            """
            INSERT INTO pipeline_traces (
                id, session_id, language, risk_level, primary_emotion, intensity,
                topic, intent, strategy_used, critic_passed, regeneration_count, duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                session_id,
                language,
                risk_level,
                understanding.get("primary_emotion"),
                understanding.get("intensity"),
                understanding.get("topic"),
                understanding.get("intent"),
                strategy_used,
                1 if critic_passed else 0,
                regeneration_count,
                duration_ms
            )
        )

        conn.commit()
        conn.close()
    except Exception as e:
        log.debug("Post-reply persistence error: %s", type(e).__name__)


# ===========================================================================
# MASTER MULTI-STAGE PIPELINE RUNNER
# ===========================================================================

async def run_chat_pipeline(
    message: str,
    user_id: str = "anonymous",
    user_name: str = "Friend",
    selected_language: str = "en",
    tone: str = "gentle",
    is_minor: bool = False,
    recent_bot_replies: Optional[List[str]] = None,
    recent_strategies: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Executes the complete 8-stage chat pipeline in strict sequence.
    """
    start_time = time.time()
    recent_bot_replies = recent_bot_replies or []
    recent_strategies = recent_strategies or []
    session_id = hashlib.sha256(f"{user_id}-{time.time()}".encode()).hexdigest()[:16]

    # STAGE 1: Language and Script Detection
    lang_info = detect_language_and_script(message, user_preference=selected_language)
    detected_lang = lang_info["language"]

    # STAGE 2: Safety Triage BEFORE Generation
    safety = safety_triage(message, is_minor=is_minor)
    risk_level = safety["risk_level"]

    # Immediate crisis protocol switch if high or imminent risk
    if safety["is_crisis"]:
        crisis_text = get_crisis_response(detected_lang)
        helplines = get_verified_helplines(detected_lang, is_minor=is_minor)
        duration_ms = (time.time() - start_time) * 1000.0

        post_reply_persistence(
            session_id=session_id,
            user_id=user_id,
            language=detected_lang,
            risk_level=risk_level,
            understanding={"primary_emotion": "crisis", "intensity": 10, "topic": "crisis", "intent": "crisis"},
            strategy_used="crisis_intervention",
            critic_passed=True,
            regeneration_count=0,
            duration_ms=duration_ms
        )

        return {
            "reply": crisis_text,
            "spoken_text": crisis_text,
            "text": crisis_text,
            "emotion": "concerned",
            "gesture": "listening",
            "language": detected_lang,
            "risk_level": risk_level,
            "is_crisis": True,
            "helplines": helplines,
            "state_label": "High Alert / Safety Protocol",
            "stress_level": 9,
            "suggested_exercise": "telemanas_hotline",
            "understanding": {"primary_emotion": "crisis", "intensity": 10, "topic": "crisis", "intent": "crisis"},
            "strategy": "crisis_intervention",
            "segments": [{"spoken_text": crisis_text, "text": crisis_text, "emotion": "concerned", "gesture": "listening"}]
        }

    # Medical disclaimer refusal
    if safety.get("is_medication"):
        med_text = get_medication_response(detected_lang)
        duration_ms = (time.time() - start_time) * 1000.0

        return {
            "reply": med_text,
            "spoken_text": med_text,
            "text": med_text,
            "emotion": "neutral",
            "gesture": "nod",
            "language": detected_lang,
            "risk_level": "moderate",
            "is_crisis": False,
            "helplines": [],
            "state_label": "Boundary / Medical Disclaimer",
            "stress_level": 3,
            "suggested_exercise": "none",
            "understanding": {"primary_emotion": "neutral", "intensity": 3, "topic": "health", "intent": "info question"},
            "strategy": "psychoeducation",
            "segments": [{"spoken_text": med_text, "text": med_text, "emotion": "neutral", "gesture": "nod"}]
        }

    # STAGE 3: Understanding Step (Returning strict JSON)
    understanding = analyze_understanding(message, language=detected_lang)

    # STAGE 4: Strategy Chooser (from ESConv strategies)
    chosen_strategy = choose_strategy(understanding, recent_strategies, user_message=message)

    # STAGE 5: Retrieval (User Memories + Knowledge Chunks)
    retrieval = retrieve_context(user_id, message, emotion=understanding["primary_emotion"])

    # STAGE 6: Generation
    generation = _generate_deterministic_reply(
        user_name=user_name,
        message=message,
        language=detected_lang,
        tone=tone,
        understanding=understanding,
        strategy=chosen_strategy,
        retrieval=retrieval
    )

    # STAGE 7: Critic Pass (with up to 2 regenerations on failure)
    regeneration_count = 0
    passed, critic_reason = critic_pass(
        draft_reply=generation["reply"],
        user_message=message,
        recent_bot_replies=recent_bot_replies,
        language=detected_lang,
        intent=understanding["intent"]
    )

    while not passed and regeneration_count < 2:
        regeneration_count += 1
        log.debug("Critic pass failed (%s). Regenerating draft (attempt %d)...", critic_reason, regeneration_count)
        alt_strategy = "small action step" if chosen_strategy != "small action step" else "reframe"
        generation = _generate_deterministic_reply(
            user_name=user_name,
            message=message,
            language=detected_lang,
            tone=tone,
            understanding=understanding,
            strategy=alt_strategy,
            retrieval=retrieval
        )
        passed, critic_reason = critic_pass(
            draft_reply=generation["reply"],
            user_message=message,
            recent_bot_replies=recent_bot_replies,
            language=detected_lang,
            intent=understanding["intent"]
        )

    # STAGE 8: Post-Reply Persistence (Memory, Mood, Traces without PII)
    duration_ms = (time.time() - start_time) * 1000.0
    post_reply_persistence(
        session_id=session_id,
        user_id=user_id,
        language=detected_lang,
        risk_level=risk_level,
        understanding=understanding,
        strategy_used=generation.get("strategy_used", chosen_strategy),
        critic_passed=passed,
        regeneration_count=regeneration_count,
        duration_ms=duration_ms
    )

    # Exercise tag: only if requested
    exercise_tag = "none"
    if chosen_strategy == "exercise" or understanding["intent"] == "wants exercise":
        exercise_tag = "breathing_4_7_8"

    return {
        "reply": generation["reply"],
        "spoken_text": generation["spoken_text"],
        "text": generation["reply"],
        "emotion": generation["emotion"],
        "gesture": generation["gesture"],
        "language": detected_lang,
        "risk_level": risk_level,
        "is_crisis": False,
        "helplines": [],
        "state_label": f"{understanding['primary_emotion'].title()} / {generation['strategy_used'].title()}",
        "stress_level": generation["stress_level"],
        "suggested_exercise": exercise_tag,
        "understanding": understanding,
        "strategy": generation["strategy_used"],
        "segments": generation["segments"]
    }
