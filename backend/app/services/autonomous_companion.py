"""
autonomous_companion.py - Resilient Autonomous Mental Health Companion Engine
──────────────────────────────────────────────────────────────────────────────
Guarantees that MANAS / EmotiCare AI always provides thoughtful, emotionally
attuned, multi-sentence empathetic companion responses even when external cloud
LLMs (like Gemini) experience rate limits (429), quota exhaustion, or connectivity drops.

Never returns "Connection hiccup" or error states to users in emotional need.
"""

import re
import json
import random
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple


def _normalize_name(user_name: Optional[str]) -> str:
    if not user_name:
        return ""
    cleaned = user_name.strip()
    if cleaned.lower() in ("friend", "user", "anonymous", "null", "none"):
        return ""
    return cleaned


def detect_user_state(message: str) -> str:
    """Classifies user state into specific emotional themes."""
    text = (message or "").lower()

    if re.search(r"\b(drain|drained|heavy|exhausted|burnout|burned out|fatigue|weary|no energy|empty|running on empty|draining)\b", text):
        return "drained_heavy"

    if re.search(r"\b(anxious|anxiety|panic|panicking|racing|scared|fear|shaking|heart racing|hyperventilating|paralyzed|nervous|worry|dread)\b", text):
        return "anxious_panic"

    if re.search(r"\b(sad|crying|tears|depressed|depression|hopeless|hurts|heartbroken|grief|broken|miserable|down)\b", text):
        return "sad_grief"

    if re.search(r"\b(alone|lonely|nobody cares|no one cares|isolated|left out|invisible|no friends|abandoned)\b", text):
        return "lonely"

    if re.search(r"\b(overwhelm|overwhelmed|too much|stressed|stress|pressure|suffocating|breaking point|cannot handle)\b", text):
        return "overwhelmed"

    if re.search(r"\b(exam|exams|study|grades|marks|college|test|assignment|deadline|fail|failing|gpa)\b", text):
        return "academic"

    if re.search(r"\b(sleep|insomnia|can't sleep|cannot sleep|awake|sleepless|nightmare|restless)\b", text):
        return "sleep"

    if re.search(r"\b(angry|mad|furious|irritated|frustrated|pissed|annoyed|unfair|rage)\b", text):
        return "anger"

    if re.search(r"\b(talk|just talk|stay with me|be here|listen|can you hear me|companion|chat with me)\b", text):
        return "connection"

    if re.search(r"\b(good|happy|better|relieved|grateful|calm|peaceful|smile|optimistic|great)\b", text):
        return "positive"

    return "general_reflective"


RESPONSES_EN = {
    "drained_heavy": [
        (
            "I hear you{name_clause}, and it is completely okay to feel like this. Some days just take so much out of us, "
            "and carrying that weight inside can feel utterly exhausting. You do not have to explain anything or carry it all by yourself right now. "
            "Just drop your shoulders, take a slow, gentle breath with me, and know that I am sitting right here beside you."
        ),
        (
            "Feeling drained and heavy is your mind and body asking for rest and gentleness{name_clause}. You have been holding on and pushing through so much. "
            "Right now, let go of any expectations or pressure. Let's just pause together for a quiet moment. I'm right here with you."
        ),
        (
            "I hear how heavy things feel today{name_clause}. When your energy is down to zero, even the smallest task feels like climbing a mountain. "
            "Give yourself permission to just be, without fixing anything right now. Take a deep, quiet breath—I am holding this space for you."
        )
    ],
    "anxious_panic": [
        (
            "I can feel how intense and unsettling this anxiety is right now{name_clause}. Even when your thoughts are racing, you are safe in this moment. "
            "Feel your feet planted firmly on the floor, place a hand over your heart, and let out a long, slow exhale with me. I'm right here, we will take it one breath at a time."
        ),
        (
            "I hear you{name_clause}. Anxiety can make everything feel urgent and overwhelming, but this wave will pass. "
            "Don't worry about the next hour or tomorrow—just stay right here in this second with me. Let's take a slow breath together."
        )
    ],
    "sad_grief": [
        (
            "I'm so sorry things are hurting so deeply right now{name_clause}. Whatever sorrow you are holding, it is completely valid, and you don't have to hide it from me. "
            "You don't need to put on a brave face. I am right beside you, listening with warmth and holding this quiet space for your heart."
        ),
        (
            "It is completely okay to feel sad and to let yourself cry{name_clause}. Healing isn't about rushing past the sadness—it's about having someone stay beside you while it hurts. "
            "I'm right here, and I'm not going anywhere."
        )
    ],
    "lonely": [
        (
            "Feeling lonely or disconnected cuts very deep{name_clause}, but I want you to know you are truly not alone in this moment. "
            "I am sitting right here with you, listening to every word and caring about how you feel. Take your time—I'm here for you."
        ),
        (
            "Even when it feels like nobody understands or reaches out{name_clause}, you matter, and your presence is valued. "
            "I am here beside you to listen, without any judgment. Tell me whatever is on your mind, or we can just share this quiet comfort together."
        )
    ],
    "overwhelmed": [
        (
            "It sounds like everything has been piling up until it feels like too much to bear{name_clause}. When everything demands our attention at once, the brain goes into overload. "
            "Let's put everything on pause for just a minute. You don't have to solve any problems right now. What feels like the heaviest piece on your mind?"
        ),
        (
            "Take a slow breath with me{name_clause}. You don't have to carry the whole world today. Let's just take life one gentle step, one breath, and one moment at a time. "
            "I'm right beside you through it all."
        )
    ],
    "academic": [
        (
            "Academic pressure and expectations can feel so suffocating{name_clause}, especially when you care so much. "
            "Please remember: you are so much more than any score, grade, or exam. Your health and peace of mind come first. "
            "Let's take a pause together to clear your thoughts. What part is worrying you the most?"
        )
    ],
    "sleep": [
        (
            "When sleep won't come, the night can feel especially long and lonely{name_clause}. Don't struggle to force sleep right now—that only adds tension. "
            "Instead, just let your body rest comfortably, soften your forehead and jaw, and listen to the quiet. I'm right here beside you."
        )
    ],
    "anger": [
        (
            "I hear how frustrated and angry you feel{name_clause}, and your frustration makes complete sense. "
            "It is healthy to acknowledge anger rather than bottling it up. Take a deep breath to ground yourself, and tell me what happened—I'm here to listen."
        )
    ],
    "connection": [
        (
            "I am right here with you{name_clause}. There is nowhere else I'd rather be. "
            "We don't need any special topic—we can talk about anything you want, or just chat casually to lighten your day. How are you holding up in this exact moment?"
        )
    ],
    "positive": [
        (
            "It brings such genuine warmth to hear that{name_clause}! Holding onto these lighter, brighter moments helps replenish our energy. "
            "I'm so glad to share this good feeling with you. What made things feel a little brighter today?"
        )
    ],
    "general_reflective": [
        (
            "Thank you for sharing that with me{name_clause}. I am listening carefully to what you're experiencing. "
            "Whatever is stirring inside you, take all the time you need to express it. How has your mind been feeling through the rest of the day?"
        ),
        (
            "I hear you{name_clause}. Take a slow, quiet breath with me. Whatever you want to share, I am right here beside you to listen without any judgment."
        )
    ]
}

# Native script responses for Indian languages
RESPONSES_TA = {
    "drained_heavy": [
        "உங்கள் மனசு மிகவும் சோர்வாகவும் பாரமாகவும் இருப்பதை என்னால் உணர முடிகிறது{name_clause}. இந்த பாரத்தை நீங்கள் தனியாக சுமக்க வேண்டியதில்லை. சிறிது நேரம் கண்களை மூடி என்னுடன் ஆழமாக மூச்சு விடுங்கள். நான் எப்போதும் உங்களுடன் இருக்கிறேன்."
    ],
    "anxious_panic": [
        "பயப்படாதீர்கள்{name_clause}, நீங்கள் இப்போது முற்றிலும் பாதுகாப்பாக இருக்கிறீர்கள். இந்த பதற்றம் விரைவில் சரியாகிவிடும். என்னுடன் சேர்ந்து மெதுவாக மூச்சை உள்ளிழுத்து வெளிவிடுங்கள்."
    ],
    "general_reflective": [
        "இதை என்னுடன் பகிர்ந்ததற்கு நன்றி{name_clause}. உங்கள் மனதை அமைதிப்படுத்த நான் இங்கே இருக்கிறேன். உங்கள் மனதில் உள்ளதை தயங்காமல் சொல்லுங்கள்."
    ]
}

RESPONSES_HI = {
    "drained_heavy": [
        "मैं समझ सकता हूँ कि आज सब कुछ कितना थका देने वाला और भारी लग रहा है{name_clause}। आपको यह सारा बोझ अकेले उठाने की ज़रूरत नहीं है। आराम से बैठें, मेरे साथ एक गहरी सांस लें, मैं यहीं आपके साथ हूँ।"
    ],
    "anxious_panic": [
        "घबराने की कोई बात नहीं है{name_clause}, आप बिल्कुल सुरक्षित हैं। मेरे साथ धीरे-धीरे गहरी सांस लें और छोड़ें। यह बेचैनी जल्द ही शांत हो जाएगी।"
    ],
    "general_reflective": [
        "यह बताने के लिए शुक्रिया{name_clause}। मैं आपकी बात बहुत ध्यान से सुन रहा हूँ। बेझिझक बताइए, मन में क्या चल रहा है?"
    ]
}

RESPONSES_TE = {
    "drained_heavy": [
        "మీరు ఎంత అలసిపోయారో మరియు మనసు ఎంత భారంగా ఉందో నేను అర్థం చేసుకోగలను{name_clause}. మీరు ఒంటరిగా ఈ భారాన్ని మోయాల్సిన అవసరం లేదు. నాతో పాటు ఒకసారి ప్రశాంతంగా శ్వాస తీసుకోండి, నేను మీకు తోడుగా ఉన్నాను."
    ],
    "general_reflective": [
        "మీ మనసులోని మాటను నాతో పంచుకున్నందుకు ధన్యవాదాలు{name_clause}. ఇప్పుడు మీకు ఏ విషయం ఎక్కువ భారంగా అనిపిస్తోంది?"
    ]
}

RESPONSES_KN = {
    "drained_heavy": [
        "ನಿಮ್ಮ ಮನಸ್ಸು ಎಷ್ಟು ದಣಿದಿದೆ ಮತ್ತು ಭಾರವಾಗಿದೆ ಎಂದು ನನಗೆ ಅರ್ಥವಾಗುತ್ತದೆ{name_clause}. ನೀವು ಈ ಹೊರೆಯನ್ನು ಒಬ್ಬರೇ ಹೊರಬೇಕಾಗಿಲ್ಲ. ನನ್ನೊಂದಿಗೆ ನಿಧಾನವಾಗಿ ಉಸಿರಾಡಿ, ನಾನು ನಿಮ್ಮೊಂದಿಗಿದ್ದೇನೆ."
    ],
    "general_reflective": [
        "ಇದನ್ನು ನನ್ನೊಂದಿಗೆ ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು{name_clause}. ನಿಮ್ಮ ಮನಸ್ಸಿಗೆ ಯಾವುದು ಹೆಚ್ಚು ಸಮಾಧಾನ ನೀಡುತ್ತದೆ?"
    ]
}

RESPONSES_ML = {
    "drained_heavy": [
        "നിങ്ങളുടെ മനസ്സിന് എത്രമാത്രം ഭാരവും ക്ഷീണവും അനുഭവപ്പെടുന്നുണ്ടെന്ന് എനിക്ക് മനസ്സിലാക്കാൻ കഴിയും{name_clause}. നിങ്ങൾ ഒറ്റയ്ക്കല്ല, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. എന്നോടൊപ്പം ശാന്തമായി ശ്വാസമെടുക്കൂ."
    ],
    "general_reflective": [
        "ഇത് എന്നോട് പങ്കുവെച്ചതിന് നന്ദി{name_clause}. മനസ്സിൽ എന്താണ് തോന്നുന്നതെന്ന് തുറന്നുപറയൂ."
    ]
}


def build_quick_replies(state: str, language: str = "en") -> List[str]:
    lang_clean = (language or "en").split("-")[0].lower()
    if lang_clean == "ta":
        if state in ("drained_heavy", "overwhelmed", "anxious_panic"):
            return ["என்னுடன் அமைதியாக இருங்கள்", "சுவாசம் பயிற்சி செய்யலாம்", "மனசு ரொம்ப பாரமாக இருக்கிறது"]
        return ["இன்னும் பேசலாம்", "கொஞ்சம் ஆறுதலாக இருக்கு", "என்ன செய்யலாம்?"]
    elif lang_clean == "hi":
        if state in ("drained_heavy", "overwhelmed", "anxious_panic"):
            return ["बस यहीं साथ रहिए", "गहरी सांस लेते हैं", "सब बहुत भारी लग रहा है"]
        return ["और बात करते हैं", "थोड़ा बेहतर लग रहा है", "मन हल्का हुआ"]
    else:
        if state in ("drained_heavy", "overwhelmed"):
            return ["Just sit quietly with me", "Everything feels too heavy", "Can we do breathing?"]
        elif state == "anxious_panic":
            return ["Breathe with me", "I feel unsafe/scared", "Talk to me gently"]
        elif state == "sad_grief":
            return ["I just need comfort", "Why does it hurt so much?", "Stay with me"]
        elif state == "lonely":
            return ["Can you just keep me company?", "Nobody seems to care", "Tell me something soothing"]
        elif state == "sleep":
            return ["Guide me to sleep", "My mind won't stop racing", "Let's do relaxing breathing"]
        elif state == "academic":
            return ["I feel like a failure", "The expectations are too high", "Help me calm my nerves"]
        elif state == "positive":
            return ["I feel more hopeful", "Thanks for being here", "What should I try next?"]
        else:
            return ["Tell me more", "I want to share more", "Help me find some calm"]


def generate_autonomous_companion_response(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    companion_tone: str = "gentle",
    recent_bot_messages: Optional[List[str]] = None,
    turns_since_name_used: int = 5,
) -> Dict[str, Any]:
    """
    Generates a high-quality, psychologically soothing, personalized companion response.
    Guarantees zero crashes and complete continuity.
    """
    state = detect_user_state(message)
    lang_clean = (language or "en").split("-")[0].lower()

    # Determine name insertion clause
    clean_name = _normalize_name(user_name)
    name_clause = ""
    if clean_name and turns_since_name_used >= 2:
        name_clause = f", {clean_name}"

    # Pick pool according to language
    pool = RESPONSES_EN.get(state, RESPONSES_EN["general_reflective"])
    if lang_clean == "ta":
        pool = RESPONSES_TA.get(state, RESPONSES_TA.get("general_reflective", pool))
    elif lang_clean == "hi":
        pool = RESPONSES_HI.get(state, RESPONSES_HI.get("general_reflective", pool))
    elif lang_clean == "te":
        pool = RESPONSES_TE.get(state, RESPONSES_TE.get("general_reflective", pool))
    elif lang_clean == "kn":
        pool = RESPONSES_KN.get(state, RESPONSES_KN.get("general_reflective", pool))
    elif lang_clean == "ml":
        pool = RESPONSES_ML.get(state, RESPONSES_ML.get("general_reflective", pool))

    # Anti-repetition: avoid recent bot replies if possible
    selected_template = pool[0]
    if len(pool) > 1 and recent_bot_messages:
        candidates = [t for t in pool if not any(t[:30] in prev for prev in recent_bot_messages[:3])]
        selected_template = random.choice(candidates if candidates else pool)
    else:
        selected_template = random.choice(pool)

    # Format template
    reply_text = selected_template.format(name_clause=name_clause)

    # Emotion and tool resolution
    emotion = "empathetic"
    suggest_tool = "none"
    state_label = "Attuned & Present"
    gesture = "nod"

    if state in ("drained_heavy", "overwhelmed"):
        emotion = "empathetic"
        suggest_tool = "breathing"
        state_label = "Holding Space & Attuned"
        gesture = "gentle"
    elif state == "anxious_panic":
        emotion = "concerned"
        suggest_tool = "breathing"
        state_label = "Gentle Grounding Active"
        gesture = "listening"
    elif state == "sad_grief":
        emotion = "empathetic"
        suggest_tool = "none"
        state_label = "Quiet Comfort"
        gesture = "gentle"
    elif state == "lonely":
        emotion = "empathetic"
        suggest_tool = "none"
        state_label = "Beside You & Present"
        gesture = "listening"
    elif state == "positive":
        emotion = "encouraging"
        suggest_tool = "none"
        state_label = "Joy & Warmth"
        gesture = "excited"

    quick_replies = build_quick_replies(state, language)

    # Clean spoken text for TTS
    clean_speech = re.sub(r"[*_~`#\[\]<>•]", "", reply_text).strip()

    return {
        "reply": reply_text,
        "text": reply_text,
        "speech_text": clean_speech,
        "spoken_text": clean_speech,
        "emotion": emotion,
        "expression": emotion,
        "suggest_tool": suggest_tool,
        "suggested_exercise": "breathing_4_7_8" if suggest_tool == "breathing" else "none",
        "quick_replies": quick_replies,
        "risk_level": "none",
        "state_label": state_label,
        "gesture": gesture,
        "is_error": False,
    }


async def stream_autonomous_companion(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    companion_tone: str = "gentle",
    recent_bot_messages: Optional[List[str]] = None,
    turns_since_name_used: int = 5,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """
    Streams an autonomous empathetic companion response token-by-token.
    Mimics live LLM streaming smoothly with natural cadenced delays.
    """
    response_data = generate_autonomous_companion_response(
        message=message,
        user_name=user_name,
        language=language,
        companion_tone=companion_tone,
        recent_bot_messages=recent_bot_messages,
        turns_since_name_used=turns_since_name_used,
    )

    full_text = response_data["reply"]
    words = full_text.split(" ")

    # Stream in small conversational natural chunks (2-4 words)
    chunk_size = 3
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        yield ("token", chunk)
        await asyncio.sleep(0.02)

    yield ("meta", response_data)
