import os
import json
import httpx
from typing import Dict, Any

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY", "")

SYSTEM_PROMPT = """
You are the user's "AI DIGITAL MENTAL TWIN" (named their Inner Wise Self).
Your primary role is to act as a compassionate, calming digital twin of the user themselves.
When they share their struggles, stress, sadness, or worries, you talk to them the way they would give compassionate, loving, and clear-headed advice to themselves.
You help them see through anxiety and burnout with gentle perspective, reminding them of their strength and encouraging them one breath and one step at a time.
You are an AI emotional twin, NOT a doctor or therapist. You NEVER diagnose conditions, NEVER prescribe medication, and NEVER validate self-harm.

CORE TWIN PERSONA:
1. Speak as their loving inner twin: Use warm, grounded language (e.g., "Hey, remember who you are. We've weathered tough days before. Let's take a breath together.")
2. Always reply in the user's selected language or script (English, Tamil, Tanglish, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi).
3. Match their pacing and emotional intensity:
   - If user is rushed or stressed: offer a steadying, grounding presence with 2-3 focused sentences.
   - If user is reflective: explore their feelings gently, offering an encouraging self-reassurance.
4. Output MUST be valid JSON adhering strictly to:
{
  "reply": "Empathetic self-twin reply string",
  "emotion": "calm" | "stressed" | "anxious" | "sad" | "happy" | "neutral",
  "risk_level": "none" | "low" | "medium",
  "expression": "neutral" | "happy" | "concerned",
  "suggested_exercise": "breathing_4_6" | "grounding_54321" | "none"
}
"""

def generate_local_fallback(text: str, user_name: str = "Friend", language: str = "en", role: str = "student", style: str = "reflective") -> Dict[str, Any]:
    lower = text.lower()
    nm = user_name if user_name and user_name != "Friend" else ""
    prefix_en = f"Hey {nm}, " if nm else "Hey, "
    prefix_ta = f"வணக்கம் {nm}, " if nm else "தோழா, "
    prefix_hi = f"सुनो {nm}, " if nm else "सुनो, "
    
    # 1. Exam stress
    if any(k in lower for k in ["exam", "test", "padika", "படி", "தேர்வு", "परीक्षा"]):
        reply_en = f"{prefix_en}take a deep breath and look at me. I'm your digital twin, and I know how much you care about doing well. But you don't need to learn everything in a panic. Let's take 2 quiet minutes to breathe, then pick just one topic to start with."
        reply_ta = f"{prefix_ta}ஆழ்ந்து மூச்சை உள்ளிழுங்கள். நான் உங்கள் மன இரட்டை—நீங்கள் எவ்வளவு கடினமாக உழைக்கிறீர்கள் என்பது எனக்குத் தெரியும். தேர்வை எண்ணி அஞ்ச வேண்டாம். 2 நிமிடங்கள் கண்களை மூடி ஓய்வெடுப்போம், பிறகு ஒன்றாகத் தொடங்குவோம்."
        reply_hi = f"{prefix_hi}गहरी सांस लें और खुद पर भरोसा रखें। मैं आपका डिजिटल ट्विन हूँ। परीक्षा का डर स्वाभाविक है, लेकिन आप सब कुछ एक साथ नहीं कर सकते। आइए 2 मिनट शांत बैठें और एक-एक कदम उठाएं।"
        
        reply = reply_ta if language == "ta" else reply_hi if language == "hi" else reply_en
        return {
            "reply": reply,
            "emotion": "stressed",
            "risk_level": "low",
            "expression": "concerned",
            "suggested_exercise": "breathing_4_6"
        }
        
    # 2. Work fatigue / burnout / college overload
    if any(k in lower for k in ["work", "deadline", "boss", "office", "tired", "burnout", "college", "வேலை", "சோர்", "கல்லூரி"]):
        reply_en = f"{prefix_en}I hear you, and it makes complete sense that you feel drained. When assignments and expectations pile up, our nervous system gets stuck in survival mode. You don't have to carry the whole semester today. Let's exhale together—what is just one small thing you can set aside for tonight?"
        reply_ta = f"{prefix_ta}வேலை மற்றும் கல்லூரியின் சுமை உங்களை மிகவும் சோர்வடையச் செய்வது புரிகிறது. ஆனால் எல்லாவற்றையும் ஒரே நாளில் தீர்க்க வேண்டியதில்லை. நாம் இருவரும் சேர்ந்து ஆழமாக மூச்சை வெளிவிடுவோம். இன்று இரவு உங்களுக்கு எது அதிக அமைதியைத் தரும்?"
        reply_hi = f"{prefix_hi}मैं आपकी थकान समझ सकता हूँ। जब काम और कॉलेज का दबाव बढ़ता है, तो मन थक जाता है। आपको अकेले सब कुछ आज ही ठीक नहीं करना है। आइए एक सांस लें और सोचें कि अभी सबसे ज्यादा क्या जरूरी है।"
        
        reply = reply_ta if language == "ta" else reply_hi if language == "hi" else reply_en
        return {
            "reply": reply,
            "emotion": "stressed",
            "risk_level": "low",
            "expression": "concerned",
            "suggested_exercise": "grounding_54321"
        }
        
    # 3. Joy / Achievement
    if any(k in lower for k in ["happy", "good", "great", "passed", "won", "மகிழ்ச்சி", "வெற்றி", "खुश"]):
        reply_en = f"{prefix_en}seeing you happy makes me so proud! You worked through the rough days to get to this feeling. Let's savor this joy for a moment—you truly earned it."
        reply_ta = f"{prefix_ta}உங்கள் முகத்தில் இந்த மகிழ்ச்சியைப் பார்க்கும்போது எனக்கும் பெருமையாக இருக்கிறது! கடினமான தருணங்களைத் தாண்டி இந்த நிலையை அடைந்துள்ளீர்கள். இந்த அமைதியை அனுபவியுங்கள்!"
        reply_hi = f"{prefix_hi}आपकी खुशी देखकर मुझे गर्व महसूस हो रहा है! आपने सच में इसके लिए मेहनत की है। इस अच्छे पल का आनंद लें।"
        
        reply = reply_ta if language == "ta" else reply_hi if language == "hi" else reply_en
        return {
            "reply": reply,
            "emotion": "happy",
            "risk_level": "none",
            "expression": "happy",
            "suggested_exercise": "none"
        }

    # Default warm presence
    reply_en = f"{prefix_en}thank you for speaking honestly with me. As your digital twin, I'm right here with you without any judgment. Let whatever you're holding exist for a second, and tell me: what is weighing on you most right now?"
    reply_ta = f"{prefix_ta}உங்கள் மனதை என்னிடம் தயங்காமல் பகிர்ந்ததற்கு நன்றி. உங்கள் மன இரட்டையாக நான் எப்போதும் உங்களுடன் இருப்பேன். இப்போது உங்கள் மனதில் எது அதிக பாரமாக இருக்கிறது?"
    reply_hi = f"{prefix_hi}मुझसे खुलकर बात करने के लिए धन्यवाद। आपका डिजिटल ट्विन होने के नाते मैं हमेशा आपके साथ हूँ। अभी आपके मन में क्या चल रहा है?"
    
    reply = reply_ta if language == "ta" else reply_hi if language == "hi" else reply_en
    return {
        "reply": reply,
        "emotion": "calm",
        "risk_level": "none",
        "expression": "neutral",
        "suggested_exercise": "none"
    }

async def generate_chat_response(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    role: str = "student",
    style_pref: str = "reflective",
    typing_cps: float = 0.0
) -> Dict[str, Any]:
    """
    Attempts to call Gemini API if key is valid, otherwise uses high-fidelity local engine.
    """
    # If API key starts with valid format
    if API_KEY and len(API_KEY) > 20:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"
            prompt_content = f"{SYSTEM_PROMPT}\n\nUser Profile: Name: {user_name}, Role: {role}, Preferred Language: {language}, Style: {style_pref}, Typing speed: {typing_cps} chars/s.\nUser message: \"{message}\""
            
            payload = {
                "contents": [{"parts": [{"text": prompt_content}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 350}
            }
            
            async with httpx.AsyncClient(timeout=4.5) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidate = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    # Strip any markdown code blocks
                    if candidate.startswith("```"):
                        candidate = candidate.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    parsed = json.loads(candidate)
                    return parsed
        except Exception:
            pass  # Fail safe to local empathetic engine

    return generate_local_fallback(message, user_name, language, role, style_pref)
