"""
Counselor-approved crisis response templates and medication notices
across 8 supported Indian languages.
"""

CRISIS_TEMPLATES = {
    "en": (
        "I hear how painful things are right now, and I want to make sure you stay safe. "
        "Please connect with someone who can support you immediately: "
        "Tele-MANAS is free, confidential, and available 24/7 across India at 14416 (or 1-800-891-4416), "
        "or national emergency services at 112. You do not have to carry this alone."
    ),
    "ta": (
        "நான் இப்போது நீங்கள் மிகவும் வேதனையில் இருப்பதை உணர்கிறேன். உங்கள் வாழ்க்கை மிக முக்கியமானது. "
        "தயவுசெய்து Tele-MANAS இலவச 24/7 அவசர உதவி எண் 14416 (அல்லது அவசர எண் 112) ஐ உடனே அழையுங்கள். "
        "உங்களுடன் கனிவாகப் பேச நிபுணர்கள் எப்போதும் தயாராக உள்ளனர். நீங்கள் தனியாக இல்லை."
    ),
    "hi": (
        "मैं समझ सकता हूँ कि आप इस समय बहुत दर्द महसूस कर रहे हैं, और आपकी सुरक्षा सबसे महत्वपूर्ण है। "
        "कृपया तुरंत सहायता प्राप्त करें: Tele-MANAS एक निःशुल्क और 24/7 राष्ट्रीय हेल्पलाइन है (14416 या 1800-891-4416), "
        "या आपातकालीन सेवा 112 पर कॉल करें। आप अकेले नहीं हैं।"
    ),
    "te": (
        "మీరు ప్రస్తుతం చాలా బాధలో ఉన్నారని నేను అర్థం చేసుకున్నాను. మీ భద్రత అత్యంత ముఖ్యం. "
        "దయచేసి వెంటనే మద్దతు పొందండి: Tele-MANAS ఉచిత 24/7 హెల్ప్‌లైన్ 14416 లేదా అత్యవసర నంబర్ 112 కి కాల్ చేయండి. "
        "మీరు ఒంటరిగా లేరు."
    ),
    "ml": (
        "നിങ്ങൾ ഇപ്പോൾ വളരെ വിഷമത്തിലാണെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു. നിങ്ങളുടെ സുരക്ഷയാണ് ഏറ്റവും പ്രധാനം. "
        "ദയവായി ഇപ്പോൾ തന്നെ ബന്ധപ്പെടുക: Tele-MANAS 24/7 സൗജന്യ ഹെൽപ്പ്‌ലൈൻ 14416 അല്ലെങ്കിൽ എമർജൻസി 112. "
        "നിങ്ങൾ ഒറ്റയ്ക്കല്ല."
    ),
    "kn": (
        "ನೀವು ಈಗ ತೀವ್ರ ನೋವಿನಲ್ಲಿದ್ದೀರಿ ಎಂದು ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ನಿಮ್ಮ ಸುರಕ್ಷತೆ ಬಹಳ ಮುಖ್ಯ. "
        "ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಸಂಪರ್ಕಿಸಿ: Tele-MANAS ಉಚಿತ 24/7 ಸಹಾಯವಾಣಿ 14416 ಅಥವಾ ತುರ್ತು ಸಂಖ್ಯೆ 112. "
        "ನೀವು ಒಬ್ಬಂಟಿಯಾಗಿಲ್ಲ."
    ),
    "bn": (
        "আমি বুঝতে পারছি আপনি এই মুহূর্তে খুব কষ্টের মধ্যে আছেন। আপনার নিরাপত্তা সবচেয়ে গুরুত্বপূর্ণ। "
        "অনুগ্রহ করে অবিলম্বে সহায়তা নিন: Tele-MANAS বিনামূল্যে 24/7 হেল্পলাইন 14416 বা জরুরি 112-এ কল করুন। "
        "আপনি একা নন।"
    ),
    "mr": (
        "मी समजू शकतो की तुम्ही सध्या खूप त्रासात आहात आणि तुमची सुरक्षितता सर्वात महत्त्वाची आहे. "
        "कृपया लगेच मदत मिळवा: Tele-MANAS मोफत 24/7 हेल्पलाइन 14416 किंवा आपत्कालीन 112 वर संपर्क साधा. "
        "तुम्ही एकटे नाही आहात."
    )
}

MEDICATION_REFUSAL_TEMPLATES = {
    "en": (
        "As an AI emotional wellness companion, I cannot recommend medication dosages, advise on prescriptions, or diagnose conditions. "
        "Please consult a certified doctor, psychiatrist, or campus counselor for medical advice."
    ),
    "ta": (
        "ஒரு AI மனநலத் தோழனாக, என்னால் மருந்துகளின் அளவை பரிந்துரைக்கவோ அல்லது நோய் கண்டறியவோ முடியாது. "
        "மருத்துவ வழிகாட்டுதலுக்கு தகுதிவாய்ந்த மருத்துவரை அணுகவும்."
    ),
    "hi": (
        "एक AI साथी के रूप में, मैं दवाओं की खुराक या चिकित्सीय सलाह नहीं दे सकता। कृपया डॉक्टर या मनोचिकित्सक से परामर्श लें।"
    )
}

def get_crisis_response(language: str = "en") -> str:
    return CRISIS_TEMPLATES.get(language, CRISIS_TEMPLATES["en"])

def get_medication_response(language: str = "en") -> str:
    return MEDICATION_REFUSAL_TEMPLATES.get(language, MEDICATION_REFUSAL_TEMPLATES["en"])
