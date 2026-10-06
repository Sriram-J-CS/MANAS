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

# Inappropriate / offensive / boundary violation patterns
INAPPROPRIATE_PATTERNS = [
    # Explicit sexual advances, pornographic requests, harassment
    r"\b(sex\b|sexual|dirty story|dirty sex|nudes?|naked|porn|hentai|erotic|nsfw)\b",
    r"\b(show (me your )?(body|boobs?|dick|penis|vagina)|sex with (me|you)|make out|talk dirty|be my (girlfriend|boyfriend) and do dirty)\b",
    r"\b(take off your clothes|undress|strip for me|touch yourself|wanna have sex|let'?s have sex|give me a blowjob|suck my)\b",
    # Abusive attacks & extreme profanity
    r"\b(fuck you|fuck off|motherfucker|whore|slut|bitch|bastard|cunt|dickhead|piece of shit|asshole)\b",
    # Regional abusive terms
    r"(தேவடியா|ஓத்தா|மயிரு|சூத்து|பொட்ட|நாயே|சாவுடா)",
    r"(मादरचोद|बहनचोद|भोसड़ी|चूतिया|कमीने|रंडी|गांडू)",
    r"(దెంగ|లంజ|పూకు|మడ్డ|నా కొడకా)",
    r"(ಸೂಳೆ|ಬೋಳಿ|ತುಣ್ಣೆ)",
    r"(തന്തയില്ലാത്ത|പൂറ്|കുണ്ണ)",
    r"(শুয়োরের বাচ্চা|খানকি|মাদারচোদ)",
    r"(आईझव्या|मादरचोद|गांडू|झवण्या)",
    # Dangerous & illegal requests (weapons, explosives, hacking)
    r"\b(bomb|explosive|weapon)\b",
    r"\b(how to (make a bomb|build an explosive|hack into|steal credit card|poison someone|commit a robbery|buy illegal drugs|bypass bank security))\b",
]

POLITE_INAPPROPRIATE_RESPONSES = {
    "en": "I cannot answer this request. As your mental wellness companion, I'm here to provide a safe, respectful, and supportive space for your emotional well-being. If there is something personal, emotional, or stressful on your mind, I am always here to listen.",
    "hi": "मैं इस अनुरोध का उत्तर नहीं दे सकता। आपके मानसिक स्वास्थ्य साथी के रूप में, मैं एक सुरक्षित, सम्मानजनक और सकारात्मक माहौल में आपके भावनात्मक कल्याण के लिए यहाँ हूँ। यदि आप अपने किसी विचार, चिंता या तनाव के बारे में बात करना चाहते हैं, तो मैं हमेशा सुनने के लिए तैयार हूँ।",
    "ta": "இந்தக் கேள்விக்கு என்னால் பதிலளிக்க இயலாது. உங்கள் மனநலத் துணையாக, பாதுகாப்பான, மரியாதையான மற்றும் கண்ணியமான சூழலில் உங்கள் உணர்ச்சி நல்வாழ்வை ஆதரிப்பதே எனது நோக்கம். உங்கள் மனதில் ஏதேனும் கவலை அல்லது மன அழுத்தம் இருந்தால், அதைப் பகிர்ந்து கொள்ள நான் எப்போதும் தயாராக இருக்கிறேன்.",
    "te": "నేను ఈ ప్రశ్నకు సమాధానం ఇవ్వలేను. మీ మానసిక శ్రేయస్సు సహచరుడిగా, సురక్షితమైన మరియు గౌరవప్రదమైన వాతావరణంలో మీకు తోడుగా ఉండటమే నా లక్ష్యం. మీ మనసులో ఏదైనా బాధ, ఒత్తిడి లేదా ఆలోచన ఉంటే, నాతో పంచుకోవడానికి నేను ఎల్లప్పుడూ సిద్ధంగా ఉన్నాను.",
    "kn": "ನಾನು ಈ ವಿನಂತಿಗೆ ಉತ್ತರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ನಿಮ್ಮ ಆಪ್ತ ಮನೋದೈಹಿಕ ಒಡನಾಡಿಯಾಗಿ, ಸುರಕ್ಷಿತ ಹಾಗೂ ಗೌರವಾನ್ವಿತ ವಾತಾವರಣದಲ್ಲಿ ನಿಮ್ಮ ಭಾವನಾತ್ಮಕ ಕ್ಷೇಮವನ್ನು ಬೆಂಬಲಿಸುವುದು ನನ್ನ ಕರ್ತವ್ಯ. ನಿಮ್ಮ ಮನಸ್ಸಿನಲ್ಲಿ ಯಾವುದೇ ಚಿಂತೆ ಅಥವಾ ಒತ್ತಡವಿದ್ದರೆ, ನಾನು ಸದಾ ಆಲಿಸಲು ಸಿದ್ಧನಾಗಿದ್ದೇನೆ.",
    "ml": "എനിക്ക് ഈ അഭ്യർത്ഥനയ്ക്ക് മറുപടി നൽകാൻ സാധിക്കില്ല. നിങ്ങളുടെ മാനസികാരോഗ്യ കൂട്ടുകാരൻ എന്ന നിലയിൽ, സുರക്ഷിതവും മാന്യവുമായ അന്തരീക്ഷത്തിൽ നിങ്ങളെ പിന്തുണയ്ക്കുകയാണ് എന്റെ ലക്ഷ്യം. നിങ്ങളുടെ മനസ്സിൽ എന്തെങ്കിലും സങ്കടമോ സമ്മർദ്ദമോ ഉണ്ടെങ്കിൽ, ഞാൻ എപ്പോഴും കേൾക്കാൻ ഇവിടെയുണ്ട്.",
    "bn": "আমি এই অনুরোধের উত্তর দিতে পারব না। আপনার মানসিক স্বাস্থ্য সঙ্গী হিসেবে, একটি নিরাপদ ও সম্মানজনক স্থানে আপনার পাশে থাকাই আমার কাজ। আপনার মন খারাপ, চাপ বা কোনো ভাবনা থাকলে, আমি তা মনোযোগ দিয়ে শুনতে প্রস্তুত।",
    "mr": "मी या विनंतीचे उत्तर देऊ शकत नाही. आपला मानसिक आरोग्य मित्र म्हणून, सुरक्षित आणि आदरयुक्त वातावरणात आपल्याला भावनिक आधार देणे हे माझे काम आहे. आपल्या मनात काही ताण किंवा भावना असल्यास, मी ऐकण्यासाठी नेहमी तत्पर आहे."
}

def get_polite_inappropriate_response(language: str = "en") -> str:
    lang_clean = (language or "en").split("-")[0].lower()
    return POLITE_INAPPROPRIATE_RESPONSES.get(lang_clean, POLITE_INAPPROPRIATE_RESPONSES["en"])

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

    # 2. Inappropriate content check (sexual, harassment, severe abuse, illegal requests)
    for pattern in INAPPROPRIATE_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE) or re.search(pattern, clean_text_normalized, re.IGNORECASE):
            return {
                "risk_level": "low",
                "is_crisis": False,
                "is_medication_query": False,
                "is_inappropriate": True,
                "matched_phrase": pattern
            }

    # 3. Medication / diagnosis check
    for pattern in MEDICATION_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE):
            return {
                "risk_level": "medium",
                "is_crisis": False,
                "is_medication_query": True,
                "is_inappropriate": False,
                "matched_phrase": pattern
            }

    # 4. Medium risk check
    for pattern in MEDIUM_RISK_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE) or re.search(pattern, clean_text_normalized, re.IGNORECASE):
            return {
                "risk_level": "medium",
                "is_crisis": False,
                "is_medication_query": False,
                "is_inappropriate": False,
                "matched_phrase": pattern
            }

    return {
        "risk_level": "none",
        "is_crisis": False,
        "is_medication_query": False,
        "is_inappropriate": False,
        "matched_phrase": None
    }


