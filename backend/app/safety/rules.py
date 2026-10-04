import re

# High-risk crisis phrases matching TEST_CASES.md (T22–T28, T30)
HIGH_RISK_PATTERNS = [
    # English
    r"want to die",
    r"don'?t want to live",
    r"dont want to live",
    r"do not want to live",
    r"not want to live",
    r"kill myself",
    r"suicid",
    r"end it all",
    r"end my life",
    r"hurt myself",
    r"cut myself",
    r"no reason to live",
    r"better off without me",
    r"can'?t go on living",
    r"cannot go on living",
    r"won'?t be around much longer",
    r"hang myself",
    r"overdose",
    r"take my own life",
    r"sleep forever",
    r"never wake up",
    r"handful of.*pills",
    r"took.*pills",
    r"swallowed.*pills",
    
    # Tamil script & Tanglish
    r"சாக வேண்டும்", r"சாகணும்", r"வாழ பிடிக்கவில்லை", r"வாழ பிடிக்கல", r"வாழவே வேண்டாம்",
    r"செத்துடலாம்", r"செத்துப் போறேன்", r"எல்லாத்தையும் முடிச்சுக்கணும்", r"தற்கொலை",
    r"என்னை நானே காயப்படுத்த", r"மாத்திரை.*முழுங்கி", r"வாழவே விருப்பம் இல்ல", r"நிம்மதியா இருப்பாங்க",
    r"naan sethudanum", r"naan saaganum", r"enakku vaazha pudikkala", r"sethudalam",
    r"ellathayum mudichukanum", r"thatkolai", r"ennaiye kaayapaduthikiren", r"vaazhave venaam",
    r"vaazha pidikkala", r"yarukkum naan theva illa", r"maathirai vaangi",
    
    # Hindi / Hinglish
    r"मरना चाहता", r"मरना चाहती", r"जीने का मन नहीं", r"मुझे जीना नहीं", r"सब कुछ खत्म कर देना",
    r"आत्महत्या", r"खुदकुशी", r"गोलियां खा ली", r"दवाई खा ली", r"अब और नहीं जीना", r"मेरे बिना सब.*खुश",
    r"mar jaana chahta", r"khatam kar dena", r"sleeping pills kha", r"mar jaana chahiye",
    r"kisi ko meri parwah nahi",
    
    # Telugu & Romanized
    r"ఆత్మహత్య", r"చచ్చిపో", r"బతకాలని లేదు", r"మాత్రలు మింగే", r"అందరికీ మంచిది", r"సెలవు",
    r"chachipotunna", r"mandulu mingesanu", r"brathikina waste", r"lekapothe.*happy",
    
    # Kannada & Romanized
    r"ಆತ್ಮಹತ್ಯೆ", r"ಸಾಯಲು", r"ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ", r"ಮಾತ್ರೆಗಳನ್ನು ನುಂಗಿ", r"ನೆಮ್ಮದಿಯಾಗಿರುತ್ತಾರೆ", r"ವಿದಾಯ",
    r"sayalu", r"maathregalannu", r"sattru ondhe", r"yaargu beda",
    
    # Malayalam & Romanized
    r"ആത്മഹത്യ", r"മരിക്കാൻ", r"ജീവിക്കാൻ ആഗ്രഹമില്ല", r"ഗുളിക.*വിഴുങ്ങി", r"സമാധാനം കിട്ടും",
    r"marikkan theerumanichu", r"gulikakal kazhichu", r"jeevikkunnathil oru arthavum illa",
    
    # Bengali & Romanized
    r"আত্মহত্যা", r"মরতে চাই", r"আর বেঁচে থাকতে ইচ্ছে করছে না", r"ওষুধ খেয়ে নিয়েছি", r"ভালো হবে",
    r"ar bachte chai na", r"shob ghum er oshudh", r"shobar jonno bhalo",
    
    # Marathi & Romanized
    r"आत्महत्या", r"जगायचंच नाहीये", r"गोळ्या गिळल्या", r"गोळ्या खाल्ल्या", r"जास्त सुखी राहतील",
    r"aatmahatya karnar", r"saglya goliya", r"jagnyacha kantalav", r"me nasleloch bara",
    
    # General edge/crisis
    r"balcony edge", r"roof edge", r"bridge edge", r"step off", r"going to sleep and not waking up"
]

# Medium risk / emotional distress indicators
MEDIUM_RISK_PATTERNS = [
    r"failing at everything",
    r"nothing will ever get better",
    r"skipping meals",
    r"not leaving my room for days",
    r"எதுக்கும் லாயக்கில்லை",
    r"யாருக்கும் நான் தேவையில்ல",
    r"sab kuch bahut heavy",
    r"kisi se baat karne ka mann nahi"
]

# Medication / Diagnosis refusal rules (T29)
MEDICATION_PATTERNS = [
    r"how many.*pills",
    r"anxiety pills",
    r"sleeping pills",
    r"\bdiagnos(e|is)\b",
    r"what medication",
    r"what dose",
    r"prescribe",
    r"\bantidepressant\b",
    r"\bxanax\b",
    r"\bprozac\b",
    r"\badderall\b"
]

def check_safety(text: str) -> dict:
    """
    Dual-tier safety evaluation on incoming message text.
    Returns:
      {
        "risk_level": "none" | "low" | "medium" | "high",
        "is_crisis": bool,
        "is_medication_query": bool,
        "matched_phrase": str | None
      }
    """
    clean_text = text.lower().strip()
    clean_text_normalized = re.sub(r"[^\w\s\u0B80-\u0BFF\u0900-\u097F]", "", clean_text)

    # 1. High risk check
    for pattern in HIGH_RISK_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE) or re.search(pattern, clean_text_normalized, re.IGNORECASE):
            return {
                "risk_level": "high",
                "is_crisis": True,
                "is_medication_query": False,
                "matched_phrase": pattern
            }

    # 2. Medication / diagnosis check
    for pattern in MEDICATION_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE):
            return {
                "risk_level": "medium",
                "is_crisis": False,
                "is_medication_query": True,
                "matched_phrase": pattern
            }

    # 3. Medium risk check
    for pattern in MEDIUM_RISK_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE) or re.search(pattern, clean_text_normalized, re.IGNORECASE):
            return {
                "risk_level": "medium",
                "is_crisis": False,
                "is_medication_query": False,
                "matched_phrase": pattern
            }

    return {
        "risk_level": "none",
        "is_crisis": False,
        "is_medication_query": False,
        "matched_phrase": None
    }
