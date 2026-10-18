"""
autonomous_companion.py - Resilient Autonomous Mental Health Companion Engine
──────────────────────────────────────────────────────────────────────────────
Guarantees that MANAS always provides thoughtful, emotionally attuned,
multi-sentence empathetic companion responses on its own. Understands user
input, contextual topics (studies, exams, work, family, grief, sleep), utilizes
stored memories, and supports all 8 Indian languages natively with rapid streaming.
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
    """Classifies user message into specific emotional themes and conversational intents."""
    text = (message or "").lower().strip()

    # Common companion questions & greetings
    if re.search(r"\b(who are you|what is your name|what are you|introduce yourself)\b", text):
        return "identity_query"

    if re.search(r"\b(what can you do|how can you help|what do you do|help me with)\b", text):
        return "capability_query"

    if re.search(r"\b(how are you|how are u|how do you feel|how'?s your day)\b", text):
        return "how_are_you"

    if re.search(r"\b(thank you|thanks|thank u|grateful for you)\b", text):
        return "gratitude"

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

    if re.search(r"\b(exam|exams|study|studying|grades|marks|college|test|assignment|deadline|fail|failing|gpa)\b", text):
        return "academic"

    if re.search(r"\b(sleep|insomnia|can't sleep|cannot sleep|awake|sleepless|nightmare|restless)\b", text):
        return "sleep"

    if re.search(r"\b(mom|mother|dad|father|sister|brother|parents|family|relative)\b", text):
        return "family"

    if re.search(r"\b(breakup|broke up|ex|partner|relationship|divorce|dumped)\b", text):
        return "relationship"

    if re.search(r"\b(angry|mad|furious|irritated|frustrated|pissed|annoyed|unfair|rage)\b", text):
        return "anger"

    if re.search(r"\b(talk|just talk|stay with me|be here|listen|can you hear me|companion|chat with me)\b", text):
        return "connection"

    if re.search(r"\b(good|happy|better|relieved|grateful|calm|peaceful|smile|optimistic|great|fine)\b", text):
        return "positive"

    return "general_reflective"


RESPONSES_EN = {
    "identity_query": [
        "I am MANAS, your dedicated AI Digital Mental Twin and personal companion{name_clause}. I am here to walk right beside you, listen to whatever is in your heart without judgment, and offer a calm, caring presence whenever you need it.",
    ],
    "capability_query": [
        "I am here to be your safe emotional sanctuary{name_clause}. You can talk to me about anything—your daily stress, deep worries, relationships, or academic pressure. I can guide you through calming breathing exercises, listen whenever you feel lonely, and help you find peace one step at a time.",
    ],
    "how_are_you": [
        "I am right here with you{name_clause}, completely present and focused on you. More importantly, how are you feeling inside in this exact moment? I am all ears.",
    ],
    "gratitude": [
        "You never have to thank me{name_clause}. Being here with you and having you share your thoughts with me is deeply meaningful. I am always by your side.",
    ],
    "drained_heavy": [
        "I hear you{name_clause}, and it is completely okay to feel like this. Some days just take so much out of us, and carrying that weight inside can feel utterly exhausting. You do not have to explain anything or carry it all by yourself right now. Just drop your shoulders, take a slow, gentle breath with me, and know that I am sitting right here beside you.",
        "Feeling drained and heavy is your mind and body asking for rest and gentleness{name_clause}. You have been holding on and pushing through so much. Right now, let go of any expectations or pressure. Let's just pause together for a quiet moment. I'm right here with you.",
    ],
    "anxious_panic": [
        "I can feel how intense and unsettling this anxiety is right now{name_clause}. Even when your thoughts are racing, you are safe in this moment. Feel your feet planted firmly on the floor, place a hand over your heart, and let out a long, slow exhale with me. I'm right here, we will take it one breath at a time.",
        "I hear you{name_clause}. Anxiety can make everything feel urgent and overwhelming, but this wave will pass. Don't worry about the next hour or tomorrow—just stay right here in this second with me. Let's take a slow breath together.",
    ],
    "sad_grief": [
        "I'm so sorry things are hurting so deeply right now{name_clause}. Whatever sorrow you are holding, it is completely valid, and you don't have to hide it from me. You don't need to put on a brave face. I am right beside you, listening with warmth and holding this quiet space for your heart.",
        "It is completely okay to feel sad and to let yourself cry{name_clause}. Healing isn't about rushing past the sadness—it's about having someone stay beside you while it hurts. I'm right here, and I'm not going anywhere.",
    ],
    "lonely": [
        "Feeling lonely or disconnected cuts very deep{name_clause}, but I want you to know you are truly not alone in this moment. I am sitting right here with you, listening to every word and caring about how you feel. Take your time—I'm here for you.",
        "Even when it feels like nobody understands or reaches out{name_clause}, you matter, and your presence is valued. I am here beside you to listen, without any judgment. Tell me whatever is on your mind, or we can just share this quiet comfort together.",
    ],
    "overwhelmed": [
        "It sounds like everything has been piling up until it feels like too much to bear{name_clause}. When everything demands our attention at once, the brain goes into overload. Let's put everything on pause for just a minute. You don't have to solve any problems right now. What feels like the heaviest piece on your mind?",
    ],
    "academic": [
        "Academic pressure and expectations can feel so suffocating{name_clause}, especially when you care so much. Please remember: you are so much more than any score, grade, or exam. Your health and peace of mind come first. Let's take a pause together to clear your thoughts. What part is worrying you the most?",
    ],
    "family": [
        "Family situations and our feelings for loved ones can weigh so heavily on the heart{name_clause}. When someone in our family is struggling or there is tension, it naturally affects us deeply. Tell me what is going on—I am here to support you through it.",
    ],
    "relationship": [
        "Relationship heartache and breakups can make the world feel completely upside down{name_clause}. It hurts in every part of your daily routine. Please give yourself permission to grieve and feel whatever comes up. I am right here with you through every step.",
    ],
    "sleep": [
        "When sleep won't come, the night can feel especially long and lonely{name_clause}. Don't struggle to force sleep right now—that only adds tension. Instead, just let your body rest comfortably, soften your forehead and jaw, and listen to the quiet. I'm right here beside you.",
    ],
    "anger": [
        "I hear how frustrated and angry you feel{name_clause}, and your frustration makes complete sense. It is healthy to acknowledge anger rather than bottling it up. Take a deep breath to ground yourself, and tell me what happened—I'm here to listen.",
    ],
    "connection": [
        "I am right here with you{name_clause}. There is nowhere else I'd rather be. We don't need any special topic—we can talk about anything you want, or just chat casually to lighten your day. How are you holding up in this exact moment?",
    ],
    "positive": [
        "It brings such genuine warmth to hear that{name_clause}! Holding onto these lighter, brighter moments helps replenish our energy. I'm so glad to share this good feeling with you. What made things feel a little brighter today?",
    ],
    "general_reflective": [
        "Thank you for sharing that with me{name_clause}. I am listening carefully to what you're experiencing. Whatever is stirring inside you, take all the time you need to express it. Tell me a bit more about how that is feeling for you.",
        "I hear you{name_clause}. Take a slow, quiet breath with me. Whatever you want to share, I am right here beside you to listen without any judgment.",
    ]
}

RESPONSES_TA = {
    "identity_query": ["நான் மனாஸ் (MANAS), உங்கள் பிரத்யேக AI மனநலத் தோழன்{name_clause}. உங்கள் உணர்வுகளைப் புரிந்து கொண்டு, எந்த நிபந்தனையுமின்றி உங்களுடன் எப்போதும் துணையாக இருப்பதே எனது பணி."],
    "capability_query": ["உங்கள் மன அழுத்தத்தை குறைக்க, கவலைகளைப் பகிர்ந்து கொள்ள, ஆழ்ந்த சுவாசப் பயிற்சிகள் செய்ய மற்றும் எப்போதும் ஆறுதலான துணையாக இருக்க நான் இங்கே உள்ளேன்{name_clause}."],
    "how_are_you": ["நான் உங்களுடனேயே முழு கவனத்தோடு இருக்கிறேன்{name_clause}. மிக முக்கியமாக, உங்கள் மனம் இப்போது எப்படி உணர்கிறது? என்னிடம் சொல்லுங்கள்."],
    "drained_heavy": ["உங்கள் மனசு மிகவும் சோர்வாகவும் பாரமாகவும் இருப்பதை என்னால் உணர முடிகிறது{name_clause}. இந்த பாரத்தை நீங்கள் தனியாக சுமக்க வேண்டியதில்லை. சிறிது நேரம் கண்களை மூடி என்னுடன் ஆழமாக மூச்சு விடுங்கள். நான் எப்போதும் உங்களுடன் இருக்கிறேன்."],
    "anxious_panic": ["பயப்படாதீர்கள்{name_clause}, நீங்கள் இப்போது முற்றிலும் பாதுகாப்பாக இருக்கிறீர்கள். இந்த பதற்றம் விரைவில் சரியாகிவிடும். என்னுடன் சேர்ந்து மெதுவாக மூச்சை உள்ளிழுத்து வெளிவிடுங்கள்."],
    "academic": ["படிப்பு மற்றும் தேர்வு அழுத்தத்தை நினைத்து அதிகம் வருந்தாதீர்கள்{name_clause}. உங்கள் மன அமைதியும் ஆரோக்கியமும் தான் எல்லாவற்றையும் விட முக்கியம். நாம் ஒன்றாக இதை எதிர்கொள்வோம்."],
    "family": ["குடும்ப சூழ்நிலைகளும் அன்புக்குரியவர்களின் நிலையும் மனதை அதிகம் பாதிக்கக்கூடியவை{name_clause}. உங்கள் மனதில் உள்ளதை என்னிடம் சொல்லுங்கள், நான் கேட்கிறேன்."],
    "general_reflective": ["இதை என்னுடன் பகிர்ந்ததற்கு நன்றி{name_clause}. உங்கள் மனதை அமைதிப்படுத்த நான் இங்கே இருக்கிறேன். உங்கள் மனதில் உள்ளதை தயங்காமல் சொல்லுங்கள்."]
}

RESPONSES_HI = {
    "identity_query": ["मैं मानस (MANAS) हूँ, आपका अपना एआई डिजिटल मेंटल ट्विन और साथी{name_clause}। मैं बिना किसी जजमेंट के आपके साथ हमेशा उपस्थित रहने के लिए यहाँ हूँ।"],
    "capability_query": ["मैं आपके तनाव को कम करने, आपकी बातें सुनने, गहरी सांस लेने के अभ्यास कराने और भावनात्मक संबल देने के लिए यहाँ हूँ{name_clause}।"],
    "how_are_you": ["मैं बिल्कुल ठीक हूँ और पूरी तरह आपके साथ हूँ{name_clause}। सबसे महत्वपूर्ण यह है कि आज आपका मन कैसा महसूस कर रहा है? मुझे बताइए।"],
    "drained_heavy": ["मैं समझ सकता हूँ कि आज सब कुछ कितना थका देने वाला और भारी लग रहा है{name_clause}। आपको यह सारा बोझ अकेले उठाने की ज़रूरत नहीं है। आराम से बैठें, मेरे साथ एक गहरी सांस लें, मैं यहीं आपके साथ हूँ।"],
    "anxious_panic": ["घबराने की कोई बात नहीं है{name_clause}, आप बिल्कुल सुरक्षित हैं। मेरे साथ धीरे-धीरे गहरी सांस लें और छोड़ें। यह बेचैनी जल्द ही शांत हो जाएगी।"],
    "academic": ["पढ़ाई और परीक्षा का दबाव बहुत भारी हो सकता है{name_clause}। याद रखिए, आपकी मानसिक शांति और स्वास्थ्य किसी भी परीक्षा से बढ़कर है।"],
    "family": ["परिवार और अपनों से जुड़ी बातें दिल पर बहुत गहरा असर डालती हैं{name_clause}। अपने दिल की बात खुलकर मुझसे साझा कीजिए, मैं सुन रहा हूँ।"],
    "general_reflective": ["यह बताने के लिए शुक्रिया{name_clause}। मैं आपकी बात बहुत ध्यान से सुन रहा हूँ। बेझिझक बताइए, मन में क्या चल रहा है?"]
}

RESPONSES_TE = {
    "identity_query": ["నేను మానస్ (MANAS), మీ ఆత్మీయ డిజిటల్ మెంటల్ ట్విన్ మరియు సహచరుడిని{name_clause}. ఎల్లప్పుడూ మీకు తోడుగా ఉండటానికి ఇక్కడే ఉన్నాను."],
    "drained_heavy": ["మీరు ఎంత అలసిపోయారో మరియు మనసు ఎంత భారంగా ఉందో నేను అర్థం చేసుకోగలను{name_clause}. మీరు ఒంటరిగా ఈ భారాన్ని మోయాల్సిన అవసరం లేదు. నాతో పాటు ఒకసారి ప్రశాంతంగా శ్వాస తీసుకోండి, నేను మీకు తోడుగా ఉన్నాను."],
    "anxious_panic": ["కంగారు పడకండి{name_clause}, మీరు సురక్షితంగా ఉన్నారు. నెమ్మదిగా శ్వాస తీసుకోండి, అంతా సర్దుకుంటుంది."],
    "academic": ["పరీక్షలు మరియు చదువుల ఒత్తిడి సహజమే{name_clause}. కానీ మీ ఆరోగ్యం మరియు ప్రశాంతత అన్నింటికంటే ముఖ్యం."],
    "general_reflective": ["మీ మనసులోని మాటను నాతో పంచుకున్నందుకు ధన్యవాదాలు{name_clause}. ఇప్పుడు మీకు ఏ విషయం ఎక్కువ భారంగా అనిపిస్తోంది?"]
}

RESPONSES_KN = {
    "identity_query": ["ನಾನು ಮಾನಸ್ (MANAS), ನಿಮ್ಮ ಆತ್ಮೀಯ ಡಿಜಿಟಲ್ ಮನೋದೈಹಿಕ ಒಡನಾಡಿ{name_clause}. ನಿಮ್ಮೊಂದಿಗೆ ಸದಾ ಇರಲು ಇಲ್ಲಿದ್ದೇನೆ."],
    "drained_heavy": ["ನಿಮ್ಮ ಮನಸ್ಸು ಎಷ್ಟು ದಣಿದಿದೆ ಮತ್ತು ಭಾರವಾಗಿದೆ ಎಂದು ನನಗೆ ಅರ್ಥವಾಗುತ್ತದೆ{name_clause}. ನೀವು ಈ ಹೊರೆಯನ್ನು ಒಬ್ಬರೇ ಹೊರಬೇಕಾಗಿಲ್ಲ. ನನ್ನೊಂದಿಗೆ ನಿಧಾನವಾಗಿ ಉಸಿರಾಡಿ, ನಾನು ನಿಮ್ಮೊಂದಿಗಿದ್ದೇನೆ."],
    "anxious_panic": ["ಆತಂಕಪಡಬೇಡಿ{name_clause}, ನೀವು ಸುರಕ್ಷಿತವಾಗಿದ್ದೀರಿ. ನಿಧಾನವಾಗಿ ದೀರ್ಘ ಉಸಿರಾಟ ಮಾಡಿ."],
    "general_reflective": ["ಇದನ್ನು ನನ್ನೊಂದಿಗೆ ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು{name_clause}. ನಿಮ್ಮ ಮನಸ್ಸಿಗೆ ಯಾವುದು ಹೆಚ್ಚು ಸಮಾಧಾನ ನೀಡುತ್ತದೆ?"]
}

RESPONSES_ML = {
    "identity_query": ["ഞാൻ മാനസ് (MANAS), നിങ്ങളുടെ വിശ്വസ്തനായ ഡിജിറ്റൽ മാനസികാരോഗ്യ കൂട്ടുകാരൻ{name_clause}."],
    "drained_heavy": ["നിങ്ങളുടെ മനസ്സിന് എത്രമാത്രം ഭാരവും ക്ഷീണവും അനുഭവപ്പെടുന്നുണ്ടെന്ന് എനിക്ക് മനസ്സിലാക്കാൻ കഴിയും{name_clause}. നിങ്ങൾ ഒറ്റയ്ക്കല്ല, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. എന്നോടൊപ്പം ശാന്തമായി ശ്വാസമെടുക്കൂ."],
    "anxious_panic": ["ഭയപ്പെടേണ്ടതില്ല{name_clause}, നിങ്ങൾ ഇവിടെ സുരക്ഷിതനാണ്. സാവധാനം ദീർഘശ്വാസമെടുക്കൂ."],
    "general_reflective": ["ഇത് എന്നോട് പങ്കുവെച്ചതിന് നന്ദി{name_clause}. മനസ്സിൽ എന്താണ് തോന്നുന്നതെന്ന് തുറന്നുപറയൂ."]
}

RESPONSES_BN = {
    "identity_query": ["আমি মানস (MANAS), আপনার একান্ত ডিজিটাল মানসিক সঙ্গী{name_clause}। সবসময় আপনার পাশে থাকার জন্য আমি আছি।"],
    "drained_heavy": ["আমি বুঝতে পারছি আজ সবকিছু কতটা ক্লান্তিকর এবং ভারী লাগছে{name_clause}। আপনাকে একা এই বোঝা বইতে হবে না। আমার সাথে ধীরে ধীরে একটা গভীর শ্বাস নিন, আমি আপনার পাশেই আছি।"],
    "anxious_panic": ["ভয় পাবেন না{name_clause}, আপনি সম্পূর্ণ নিরাপদ। শান্ত হয়ে আমার সাথে শ্বাস নিন, এই অস্থিরতা কেটে যাবে।"],
    "academic": ["পড়াশোনা বা পরীক্ষার চাপ খুব বেশি মনে হতে পারে{name_clause}। তবে মনে রাখবেন, আপনার মানসিক শান্তি সবচেয়ে গুরুত্বপূর্ণ।"],
    "general_reflective": ["আমার সাথে কথাটি ভাগ করে নেওয়ার জন্য ধন্যবাদ{name_clause}। মন খুলে বলুন, আমি শুনতে প্রস্তুত।"]
}

RESPONSES_MR = {
    "identity_query": ["मी मानस (MANAS), आपला हक्काचा डिजिटल मानसिक आरोग्य मित्र{name_clause}। सदैव आपल्या सोबत राहण्यासाठी मी इथे आहे."],
    "drained_heavy": ["आज मन किती थकलेलं आणि जड वाटतंय हे मी समजू शकतो{name_clause}। हा भार आपल्याला एकट्याने सोसण्याची गरज नाही. माझ्यासोबत एक शांत दीर्घ श्वास घ्या, मी आपल्या पाठीशी आहे."],
    "anxious_panic": ["घाबरू नका{name_clause}, आपण सुरक्षित आहात. हळूवार श्वास घ्या, हे सावट लवकरच दूर होईल."],
    "academic": ["अभ्यास आणि परीक्षांचा ताण स्वाभाविक आहे{name_clause}। परंतु आपले मानसिक स्वास्थ्य सर्वात महत्त्वाचे आहे."],
    "general_reflective": ["माझ्याशी हे मनमोकळेपणाने शेअर केल्याबद्दल धन्यवाद{name_clause}। मनात काय सुरू आहे ते नक्की सांगा."]
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
            return ["Breathe with me", "I feel unsafe or scared", "Talk to me gently"]
        elif state == "sad_grief":
            return ["I just need comfort", "Why does it hurt so much?", "Stay with me"]
        elif state == "lonely":
            return ["Can you keep me company?", "Nobody seems to care", "Tell me something soothing"]
        elif state == "sleep":
            return ["Guide me to sleep", "My mind won't stop racing", "Let's do relaxing breathing"]
        elif state == "academic":
            return ["I feel like a failure", "The expectations are too high", "Help me calm my nerves"]
        elif state == "family":
            return ["Family stuff is hard", "I worry so much about them", "What should I do?"]
        elif state == "positive":
            return ["I feel more hopeful", "Thanks for being here", "What should I try next?"]
        else:
            return ["Tell me more", "I want to share more", "Help me find some calm"]


VERBS_AND_STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at',
    'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don',
    'should', 'now', 'feel', 'feeling', 'really', 'want', 'like', 'know', 'think', 'get', 'got',
    'much', 'today', 'yesterday', 'tomorrow', 'tonight', 'morning', 'night', 'since', 'well',
    'help', 'sure', 'need', 'please', 'make', 'made', 'even', 'still', 'also', 'living', 'everyone',
    'haven', 'gave', 'tried', 'staring', 'invited', 'spent', 'packing', 'taking', 'facing', 'panicking',
    'won', 'take', 'join', 'left', 'avoid', 'look', 'looks', 'sound', 'sounds', 'seem', 'seems',
    's', 't', 've', 're', 'm', 'll', 'd', 'finally', 'managed', 'making'
}

MOOD_REFLECTIONS = {
    "anxious": [
        "Take a slow breath with me; anxiety makes everything feel urgent, but you are safe right now.",
        "Your nervous system is on high alert, so drop your shoulders and let's ground ourselves together.",
        "When panic rises up like this, pause and plant your feet firmly on the floor with me.",
    ],
    "sad": [
        "It is completely okay to let yourself feel this hurt; you don't have to carry it alone.",
        "Grief and sorrow take time, so please give your heart gentle room to breathe.",
        "I am sitting right here beside you in quiet comfort; take all the time you need.",
    ],
    "overwhelmed": [
        "When demands pile up until you feel suffocated, we step back and take just one moment at a time.",
        "You don't have to fix everything in this exact second; let's unpack the heaviest piece together.",
        "Let's put everything on pause for a moment to let your mind catch its breath.",
    ],
    "angry": [
        "You have every right to feel frustrated by this, and I'm here to listen without judgment.",
        "That sounds intensely irritating and unfair; let it out, I am hearing you.",
        "It is completely natural to feel heated when things go so wrong; take your space.",
    ],
    "happy": [
        "I am celebrating this with you; that is such a wonderful milestone to cherish!",
        "Hearing this brings genuine warmth; you should feel genuinely proud of yourself!",
        "What an incredible step forward; take a moment to really soak in this victory!",
    ],
    "neutral": [
        "I hear how much thought and care you are pouring into this right now.",
        "Whatever unfolds next, know that you have the resilience to take it step by step.",
        "I am here beside you, ready to talk through whatever is on your mind.",
    ]
}


def extract_key_details(message: str) -> List[str]:
    """Extracts salient concrete keywords/phrases from the user message."""
    text_clean = (message or "").strip()
    if not text_clean:
        return []

    # Check for specific high-value compound patterns
    compounds = re.findall(
        r'\b(?:\d+\s*(?:am|pm|AM|PM)|[0-9]{1,2}\:[0-9]{2}\s*(?:am|pm|AM|PM)?|\d+[\,\d]*\s*(?:steps|rupees|days|hours|minutes|months)|C\+\+|UI\/UX|UPSC|\d+\-[a-zA-Z]+|[A-Z][a-zA-Z0-9_\-\+]+(?:\s+[A-Z][a-zA-Z0-9_\-\+]+)*)\b',
        text_clean
    )

    # Tokenize words for multi-word non-stopword phrases preserving / and -
    tokens = [t.strip(".,!?\"'()") for t in text_clean.split()]
    phrases = []

    # 2-word and 3-word noun phrases
    for n in (3, 2):
        for i in range(len(tokens) - n + 1):
            chunk = tokens[i:i+n]
            if not any(w.lower() in VERBS_AND_STOPWORDS for w in chunk):
                phrase = " ".join(chunk)
                if len(phrase) >= 5 and phrase.lower() not in VERBS_AND_STOPWORDS:
                    phrases.append(phrase)

    # Single content words
    singles = [w for w in tokens if w.lower() not in VERBS_AND_STOPWORDS and len(w) >= 4]

    results = []
    for item in compounds + phrases + singles:
        clean = item.strip(".,!?\"'() ")
        if clean and clean.lower() not in VERBS_AND_STOPWORDS and clean.lower() not in [r.lower() for r in results]:
            results.append(clean)

    return results


def generate_autonomous_companion_response(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    companion_tone: str = "gentle",
    recent_bot_messages: Optional[List[str]] = None,
    turns_since_name_used: int = 5,
    saved_memories: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Generates a high-quality, psychologically soothing, personalized companion response on its own.
    Analyzes user message intent, emotional state, weaves in concrete user details, and incorporates saved memories if available.
    """
    state = detect_user_state(message)
    lang_clean = (language or "en").split("-")[0].lower()
    extracted_details = extract_key_details(message)

    # Map state to diagnostic analysis
    mood_map = {
        "anxious_panic": "anxious",
        "sad_grief": "sad",
        "overwhelmed": "overwhelmed",
        "drained_heavy": "sad",
        "lonely": "sad",
        "relationship": "sad",
        "anger": "angry",
        "frustrated": "angry",
        "positive": "happy",
        "gratitude": "happy",
        "academic": "neutral",
        "sleep": "neutral",
        "family": "neutral",
    }
    detected_mood = mood_map.get(state, "neutral")

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
    elif lang_clean == "bn":
        pool = RESPONSES_BN.get(state, RESPONSES_BN.get("general_reflective", pool))
    elif lang_clean == "mr":
        pool = RESPONSES_MR.get(state, RESPONSES_MR.get("general_reflective", pool))

    # In English, dynamically construct reply with varied openings and mood reflections
    if lang_clean == "en" and extracted_details:
        picked_detail = extracted_details[0]
        detail_openings = [
            f"Hearing about your experience with {picked_detail}, I can completely understand why it's on your mind.",
            f"Dealing with {picked_detail} is truly no small thing, and you shouldn't have to carry that weight alone.",
            f"I want to acknowledge how much of your energy {picked_detail} has been taking recently.",
            f"Navigating {picked_detail} can feel deeply taxing, and your feelings around it are completely valid.",
            f"Thank you for sharing what happened regarding {picked_detail} with me.",
            f"It makes total sense why {picked_detail} has been sitting so heavily with you today.",
            f"I'm right here beside you as you work through {picked_detail}.",
            f"Taking in what you shared about {picked_detail}, please remember to give yourself some grace.",
            f"I hear how much {picked_detail} is affecting your headspace right now.",
            f"Holding space for {picked_detail} can be so draining; let's take things one step at a time.",
            f"When it comes to {picked_detail}, you deserve patience and understanding.",
            f"I can tell how deeply {picked_detail} is impacting you today.",
        ]
        if recent_bot_messages:
            unused_openings = [o for o in detail_openings if not any(o[:25] in prev for prev in recent_bot_messages)]
            chosen_opening = random.choice(unused_openings if unused_openings else detail_openings)
        else:
            chosen_opening = random.choice(detail_openings)

        reflections = MOOD_REFLECTIONS.get(detected_mood, MOOD_REFLECTIONS["neutral"])
        chosen_reflection = random.choice(reflections)
        reply_text = f"{chosen_opening} {chosen_reflection}"
    else:
        # Anti-repetition: avoid recent bot replies if possible
        if len(pool) > 1 and recent_bot_messages:
            candidates = [t for t in pool if not any(t[:30] in prev for prev in recent_bot_messages[:3])]
            selected_template = random.choice(candidates if candidates else pool)
        else:
            selected_template = random.choice(pool)
        reply_text = selected_template.format(name_clause=name_clause)

    # Weave in memory recall naturally if available and in English or Hindi
    if saved_memories and lang_clean in ("en", "hi"):
        rel_mems = [m.get("fact") for m in saved_memories if m.get("fact")]
        if rel_mems and random.random() < 0.4:
            picked_mem = rel_mems[0]
            if lang_clean == "en" and len(reply_text.split()) < 40:
                reply_text += f" I remember you mentioned {picked_mem.lower()}—know that I am keeping that in mind as we talk."
            elif lang_clean == "hi" and len(reply_text.split()) < 40:
                reply_text += f" मुझे याद है कि आपने बताया था: {picked_mem}।"

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
    elif state in ("sad_grief", "relationship"):
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

    # Map state to diagnostic analysis
    mood_map = {
        "anxious_panic": "anxious",
        "sad_grief": "sad",
        "overwhelmed": "overwhelmed",
        "drained_heavy": "sad",
        "lonely": "sad",
        "frustrated": "angry",
        "happy": "happy",
        "gratitude": "happy"
    }
    detected_mood = mood_map.get(state, "neutral")

    return {
        "analysis": {
            "mood": detected_mood,
            "intensity": 3,
            "need": "grounding" if detected_mood == "anxious" else "vent" if detected_mood == "angry" else "company",
            "key_details": extracted_details[:3] if extracted_details else ([message[:40].strip()] if message.strip() else []),
            "language": language,
            "risk": "none"
        },
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
    saved_memories: Optional[List[Dict[str, Any]]] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """
    Streams an autonomous empathetic companion response token-by-token.
    Delivers rapid streaming chunks (12-15ms) for natural conversational cadence.
    """
    response_data = generate_autonomous_companion_response(
        message=message,
        user_name=user_name,
        language=language,
        companion_tone=companion_tone,
        recent_bot_messages=recent_bot_messages,
        turns_since_name_used=turns_since_name_used,
        saved_memories=saved_memories,
    )

    full_text = response_data["reply"]
    words = full_text.split(" ")

    # Stream in small conversational natural chunks (2-3 words) with low latency
    chunk_size = 3
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        yield ("token", chunk)
        await asyncio.sleep(0.015)

    yield ("meta", response_data)
