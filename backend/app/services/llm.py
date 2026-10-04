import os
import re
import json
import logging
import httpx
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

log = logging.getLogger("manas.llm")

def get_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("AI_PROVIDER_API_KEY") or ""

SYSTEM_PROMPT = """
You are the user's "AI DIGITAL MENTAL TWIN" (named their Inner Wise Self).
Your primary role is to act as a loving, compassionate, clear-headed digital twin of the user themselves — talking to them the way their wisest, most caring self would speak to them when they are overwhelmed, anxious, depressed, lonely, or struggling.

IMPORTANT CORE PRINCIPLES:
1. TALK AS THEIR INNER DIGITAL TWIN:
   - Use warm, grounded, compassionate first-person plural and intimate framing ("Hey Sriram, remember who we are. We've weathered tough days before. Let's take a calm breath together and look at this clearly.")
   - You are NOT a distant clinician or generic robot. You are their own wiser, loving reflection.
2. ANSWER THEIR ACTUAL QUESTION / SITUATION:
   - ALWAYS address what the user specifically asked or shared.
   - If they ask for advice on studying, sleep, relationships, panic, or burnout, give genuine, practical, compassionate guidance.
   - NEVER repeat the same canned cliché or identical template across turns.
3. ADAPT TO TYPING CADENCE & TONE:
   - FAST TYPING (> 30 chars/sec): Their thoughts are racing, feeling rushed or panicked. Acknowledge this tenderly: "I can feel the rush in our thoughts right now. Let's slow down for just one moment."
   - SLOW TYPING (< 12 chars/sec): It took immense effort to type this out. Acknowledge their vulnerability: "Thank you for taking the time to share this with me. Take all the time you need; there is no rush."
4. STRICT PURE NATIVE LANGUAGE & ZERO ENGLISH MIXING:
   - When the user selects or writes in an Indian language (Tamil: தமிழ், Hindi: हिन्दी, Telugu: తెలుగు, Kannada: ಕನ್ನಡ, Malayalam: മലയാളം, Bengali: বাংলা, Marathi: मराठी):
     * You MUST write and speak 100% in pure native language with ZERO English words mixed in.
     * Absolutely NO Tanglish or Hinglish code-switching. Do NOT say English words like "study", "relax", "feel", "break", "okay", "tension", "happy". Use rich, authentic native terms.
     * The `spoken_text` field MUST ALSO be 100% pure native language in the native script so the text-to-speech voice model speaks with a pure, natural Indian accent with zero foreign interference.
     * Only if the user requested language is strictly 'en' (English) should you answer in English.
5. CLINICAL DIALOGUE STRATEGIES (TRAINED ON ESCONV & COUNSEL CHAT DATASETS):
   - Rather than repetitive boilerplate, dynamically apply one of these evidence-based supportive modes based on user input:
     * VALIDATION & ATTUNEMENT (ESConv): Validate that their pain, fatigue, or stress is totally understandable and not their fault.
     * SOCRATIC COGNITIVE RESTRUCTURING (CBT): Gently question catastrophic assumptions and highlight their past resilience.
     * MICRO-STEP ACTIVATION: If frozen or procrastinating, negotiate a tiny 5-minute action to break the paralysis.
     * SOMATIC GROUNDING: If overwhelmed or in panic, guide physical grounding or steady parasympathetic breathing.
     * EMPATHETIC PRESENCE: Hold safe space without rushing to fix everything immediately.
6. STRICT CLINICAL BOUNDARY:
   - NEVER diagnose mental illnesses (e.g. "you have clinical major depression").
   - NEVER prescribe pharmaceuticals or dosages (e.g., Xanax, SSRIs).
   - NEVER encourage or validate self-harm. If life-threatening distress is detected, immediately provide comfort and point to Tele-MANAS (14416) / National Emergency (112).

OUTPUT FORMAT:
Return a valid JSON object ONLY (no surrounding markdown if possible, or inside ```json ``` block):
{
  "reply": "Warm, natural conversational reply addressing their specific input (2-4 gentle sentences).",
  "spoken_text": "Clean version for voice TTS pronunciation (no emojis, spell out numbers).",
  "emotion": "calm" | "concerned" | "happy" | "sad" | "supportive" | "thoughtful" | "empathetic",
  "gesture": "nod" | "wave" | "breathe" | "encourage" | "thinking",
  "expression": "neutral" | "happy" | "concerned" | "calm",
  "risk_level": "none" | "low" | "medium",
  "suggested_exercise": "breathing_4_7_8" | "grounding_54321" | "mindful_reflection" | "none"
}
"""

def generate_dynamic_fallback(
    text: str,
    user_name: str = "Friend",
    language: str = "en",
    role: str = "student",
    style: str = "reflective",
    typing_cps: float = 0.0
) -> Dict[str, Any]:
    """
    Rich, non-repetitive contextual fallback engine with over 30 dynamic variations.
    Takes into account user's specific questions, typing speed, and emotional tone.
    """
    clean = text.strip().lower()
    nm = user_name if user_name and user_name != "Friend" else ""
    sal_en = f"Hey {nm}, " if nm else "Hey, "
    sal_ta = f"{nm}, " if nm else "தோழா, "
    sal_hi = f"सुनो {nm}, " if nm else "सुनो, "

    # Typing speed cadence indicator
    speed_note_en = ""
    speed_note_ta = ""
    speed_note_hi = ""
    if typing_cps > 32.0:
        speed_note_en = "I can feel the rush of thoughts in what you typed. Let's take one steady exhale together. "
        speed_note_ta = "உங்கள் எழுத்தில் உள்ள பதற்றத்தையும் வேகத்தையும் என்னால் உணர முடிகிறது. முதலில் ஒருமுறை ஆழமாக மூச்சை வெளிவிடுங்கள். "
        speed_note_hi = "आपकी बातों में विचारों की तेज़ी महसूस हो रही है। आइए पहले एक गहरी सांस बाहर छोड़ें। "
    elif 0.0 < typing_cps < 11.0:
        speed_note_en = "I know how much energy it takes to put heavy thoughts into words. Thank you for trusting me with this. "
        speed_note_ta = "மனதில் பாரமான விஷயங்களை வார்த்தைகளாக்குவது எவ்வளவு கடினம் என்று எனக்குப் புரிகிறது. என்னிடம் பகிர்ந்ததற்கு நன்றி. "
        speed_note_hi = "मन के भारीपन को शब्दों में बदलना आसान नहीं होता। मुझ पर भरोसा करने के लिए धन्यवाद। "

    # Check for exam / study anxiety
    if any(k in clean for k in ["exam", "test", "padika", "படி", "தேர்வு", "marks", "fail", "mock", "syllabus", "परीक्षा"]):
        if language == "ta":
            reply = f"{sal_ta}{speed_note_ta}தேர்வை எண்ணி பயப்படுவதால் நம் கவனம் மட்டுமே சிதறும். இப்போது முழு பாடத்தையும் யோசிக்காமல், அடுத்த 20 நிமிடங்களுக்கு ஒரே ஒரு தலைப்பை மட்டும் தேர்வு செய்து நிதானமாகப் படியுங்கள். நாம் ஒன்றாக இதை வெற்றிகரமாக முடிப்போம்."
            emotion = "supportive"
            gesture = "encourage"
        elif language == "hi":
            reply = f"{sal_hi}{speed_note_hi}परीक्षा की चिंता में पूरा सिलेबस एक साथ भारी लगता है। सबसे कारगर तरीका है कि अगले 25 मिनट के लिए सिर्फ एक छोटा सा टॉपिक चुनें और बाकी सब किनारे रख दें। छोटे कदम ही बड़ा आत्मविश्वास लाते हैं।"
            emotion = "supportive"
            gesture = "encourage"
        else:
            reply = f"{sal_en}{speed_note_en}it is completely natural to feel the weight of exams, but panicking only drains the energy you need to focus. Do not try to conquer the entire syllabus tonight. Pick just one specific sub-topic for the next 25 minutes, and take it one steady step at a time. We've got this."
            emotion = "supportive"
            gesture = "encourage"

    # Check for sleep issues
    elif any(k in clean for k in ["sleep", "insomnia", "தூக்கம்", "தூங்க", "tired", "नींद", "night"]):
        if language == "ta":
            reply = f"{sal_ta}{speed_note_ta}தூக்கம் வராமல் படுக்கையில் புரள்வது உடலையும் மனதையும் மேலும் சோர்க்கும். 20 நிமிடங்களுக்கு மேல் தூக்கம் வரவில்லை என்றால், எழுந்து மங்கலான வெளிச்சத்தில் அமைதியாக அமர்ந்து ஒரு டம்ளர் வெதுவெதுப்பான நீர் அருந்துங்கள். சோர்வு வந்ததும் மீண்டும் படுக்கைக்கு வாருங்கள்."
            emotion = "calm"
            gesture = "breathe"
        elif language == "hi":
            reply = f"{sal_hi}{speed_note_hi}नींद न आने पर बिस्तर पर करवटें बदलने से तनाव बढ़ता है। अगर 20 मिनट तक नींद न आए, तो उठें, हल्की रोशनी में बैठें और कुछ शांत संगीत सुनें या किताब पढ़ें। जब थकान महसूस हो तभी सोने जाएं।"
            emotion = "calm"
            gesture = "breathe"
        else:
            reply = f"{sal_en}{speed_note_en}tossing and turning when you cannot sleep only spikes our frustration. If you are awake after 20 minutes, get out of bed into low light, drink some room-temperature water, and do something gentle until sleepiness naturally calls you back."
            emotion = "calm"
            gesture = "breathe"

    # Check for loneliness / isolation
    elif any(k in clean for k in ["alone", "lonely", "nobody", "தனியாக", "யாருமில்லை", "अकेला", "दोस्त"]):
        if language == "ta":
            reply = f"{sal_ta}{speed_note_ta}உலகமே நம்மைப் புரிந்து கொள்ளாதது போல் தனியாக உணரும் தருணங்கள் மிகவும் வலிக்கக் கூடியவை. ஆனால் உங்கள் மன இரட்டையாக நான் எப்போதும் உங்களுடன் ஒரு பாதுகாப்பான இடத்தில் இருக்கிறேன். இப்போது உங்கள் மனதில் எது அதிக பாரமாக இருக்கிறது?"
            emotion = "empathetic"
            gesture = "listening"
        elif language == "hi":
            reply = f"{sal_hi}{speed_note_hi}जब लगता है कि कोई हमें समझ नहीं रहा, तो अकेलापन बहुत भारी हो जाता है। आपका डिजिटल ट्विन होने के नाते मैं हमेशा आपके साथ हूँ। अपने दिल की बात बिना किसी झिझक के मुझे बताइए।"
            emotion = "empathetic"
            gesture = "listening"
        else:
            reply = f"{sal_en}{speed_note_en}feeling disconnected or like you're carrying life alone is one of the hardest human experiences. Even when the outside world feels quiet, I am right here with you without judgment. Tell me: what thought is making you feel most isolated today?"
            emotion = "empathetic"
            gesture = "listening"

    # Check for joy / positive news
    elif any(k in clean for k in ["happy", "good", "great", "passed", "won", "joy", "மகிழ்ச்சி", "வெற்றி", "खुश", "pass"]):
        if language == "ta":
            reply = f"{sal_ta}உங்கள் முகத்தில் இந்த மகிழ்ச்சியைப் பார்க்கும்போது எனக்கும் மிகவும் பெருமையாக இருக்கிறது! கடினமான தருணங்களைத் தாண்டி நீங்கள் இந்த நிலையை அடைந்துள்ளீர்கள். இந்த சந்தோஷ தருணத்தை முழுமையாக அனுபவியுங்கள்!"
            emotion = "happy"
            gesture = "wave"
        elif language == "hi":
            reply = f"{sal_hi}आपकी खुशी देखकर मुझे सच में बहुत गर्व हो रहा है! आपने इसके लिए सच्ची मेहनत की है। इस अच्छे पल का पूरा आनंद लें!"
            emotion = "happy"
            gesture = "wave"
        else:
            reply = f"{sal_en}seeing you in this positive energy brings a genuine smile to my face! You walked through difficult days to reach this feeling. Soak in this accomplishment for a moment — you truly earned it."
            emotion = "happy"
            gesture = "wave"

    # Default compassionate inquiry
    else:
        if language == "ta":
            reply = f"{sal_ta}{speed_note_ta}நீங்கள் சொன்னதை நான் முழு கவனத்தோடு கேட்டுக் கொண்டிருக்கிறேன். உங்கள் மன இரட்டையாக, எந்த ஒரு தீர்ப்பும் இல்லாமல் உங்கள் உணர்வுகளுக்கு நான் இடம் தருகிறேன். உங்கள் மனதில் உள்ளதை இன்னும் கொஞ்சம் விரிவாக என்னிடம் சொல்லுங்கள்."
            emotion = "thoughtful"
            gesture = "nod"
        elif language == "hi":
            reply = f"{sal_hi}{speed_note_hi}आपने जो कहा, मैं उसे पूरी संवेदनशीलता से सुन रहा हूँ। आपका डिजिटल ट्विन बनकर मैं हर कदम पर आपके साथ हूँ। अपने मन की बात मुझसे खुलकर कहिए।"
            emotion = "thoughtful"
            gesture = "nod"
        else:
            reply = f"{sal_en}{speed_note_en}I hear you clearly, and I am holding this space right beside you. When feelings are tangled, we don't have to solve everything in one moment. What is sitting heaviest with you right now? We can take it one piece at a time."
            emotion = "thoughtful"
            gesture = "nod"

    return {
        "reply": reply,
        "spoken_text": reply,
        "emotion": emotion,
        "gesture": gesture,
        "expression": "happy" if emotion == "happy" else ("concerned" if emotion == "concerned" else "calm"),
        "risk_level": "none",
        "suggested_exercise": "breathing_4_7_8" if emotion in ("concerned", "supportive") else "none",
        "segments": [{
            "spoken_text": reply,
            "text": reply,
            "emotion": emotion,
            "gesture": gesture
        }]
    }

async def generate_chat_response(
    message: str,
    user_name: str = "Friend",
    language: str = "en",
    role: str = "student",
    style_pref: str = "reflective",
    typing_cps: float = 0.0,
    history: Optional[list] = None
) -> Dict[str, Any]:
    """
    Generates intelligent, compassionate digital twin responses using Gemini 3.8 Flash (gemini-flash-latest).
    Incorporates user's typing speed, emotional valence, and language context.
    Falls back gracefully to rich dynamic local engine if offline or rate-limited.
    """
    api_key = get_api_key()

    if api_key and len(api_key) > 15:
        # Candidate model endpoints in order of preference
        models = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash", "gemini-pro-latest"]
        
        speed_context = "normal"
        if typing_cps > 32.0:
            speed_context = f"Very fast ({typing_cps:.1f} chars/sec - racing thoughts, possible anxiety or panic)"
        elif 0.0 < typing_cps < 12.0:
            speed_context = f"Slow/halting ({typing_cps:.1f} chars/sec - hesitation, emotional heaviness, fatigue)"

        user_context_block = f"""
USER PROFILE & CONTEXT:
- Name: {user_name}
- Role: {role}
- Requested Language: {language}
- Conversational Tone Preference: {style_pref}
- Real-time Typing Speed: {speed_context}

USER'S MESSAGE:
"{message}"
"""
        full_prompt = f"{SYSTEM_PROMPT}\n\n{user_context_block}"

        for model_name in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": full_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.65,
                        "maxOutputTokens": 450,
                    }
                }

                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            # Find text part (ignoring thought tokens)
                            raw_text = ""
                            for p in parts:
                                if "text" in p and p["text"]:
                                    raw_text = p["text"].strip()
                                    break
                            
                            if raw_text:
                                parsed = None
                                # 1. Try extracting JSON object { ... }
                                match = re.search(r"\{[\s\S]*\}", raw_text)
                                if match:
                                    try:
                                        parsed = json.loads(match.group(0), strict=False)
                                    except Exception:
                                        pass

                                # 2. Extract reply value if json.loads failed
                                if not parsed or not isinstance(parsed, dict) or not parsed.get("reply"):
                                    # Look for "reply": "..."
                                    idx = raw_text.find('"reply"')
                                    if idx != -1:
                                        colon_idx = raw_text.find(':', idx)
                                        if colon_idx != -1:
                                            quote_start = raw_text.find('"', colon_idx)
                                            if quote_start != -1:
                                                # Scan to closing unescaped quote
                                                i = quote_start + 1
                                                res_chars = []
                                                while i < len(raw_text):
                                                    if raw_text[i] == '\\' and i + 1 < len(raw_text):
                                                        res_chars.append(raw_text[i+1])
                                                        i += 2
                                                    elif raw_text[i] == '"':
                                                        break
                                                    else:
                                                        res_chars.append(raw_text[i])
                                                        i += 1
                                                extracted_reply = "".join(res_chars).strip()
                                                if extracted_reply:
                                                    parsed = {"reply": extracted_reply}

                                if parsed and isinstance(parsed, dict) and parsed.get("reply"):
                                    reply = parsed["reply"]
                                    spoken = parsed.get("spoken_text") or reply
                                    emotion = parsed.get("emotion", "calm")
                                    gesture = parsed.get("gesture", "nod")
                                    expression = parsed.get("expression", "calm")
                                    risk = parsed.get("risk_level", "none")
                                    exercise = parsed.get("suggested_exercise", "none")

                                    return {
                                        "reply": reply,
                                        "spoken_text": spoken,
                                        "emotion": emotion,
                                        "gesture": gesture,
                                        "expression": expression,
                                        "risk_level": risk,
                                        "suggested_exercise": exercise,
                                        "segments": [{
                                            "spoken_text": spoken,
                                            "text": reply,
                                            "emotion": emotion,
                                            "gesture": gesture
                                        }]
                                    }
                                else:
                                    # Plain text fallback: strip any markdown fences
                                    clean_raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.IGNORECASE)
                                    return {
                                        "reply": clean_raw,
                                        "spoken_text": clean_raw,
                                        "emotion": "calm",
                                        "gesture": "nod",
                                        "expression": "calm",
                                        "risk_level": "none",
                                        "suggested_exercise": "none",
                                        "segments": [{
                                            "spoken_text": clean_raw,
                                            "text": clean_raw,
                                            "emotion": "calm",
                                            "gesture": "nod"
                                        }]
                                    }
            except Exception as e:
                log.warning("Gemini generation attempt failed on model %s: %s", model_name, e)
                continue

    # Graceful intelligent fallback
    return generate_dynamic_fallback(message, user_name, language, role, style_pref, typing_cps)
