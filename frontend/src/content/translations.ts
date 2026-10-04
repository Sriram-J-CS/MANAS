export interface TranslationContent {
  nav: {
    brand: string;
    brandSub: string;
    features: string;
    calmScene: string;
    team: string;
    help: string;
    menu: string;
    close: string;
    startTalking: string;
    langToggle: string;
    emergencyCall: string;
  };
  hero: {
    projectWordmark: string;
    tagline: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    interactHint: string;
    interactHintTouch: string;
    badge: string;
    aiDisclaimerNote: string;
  };
  statement: {
    label: string;
    heading: string;
    p1: string;
    highlight1: string;
    p2: string;
    highlight2: string;
    subtext: string;
  };
  features: {
    sectionLabel: string;
    sectionTitle: string;
    sectionSubtitle: string;
    cards: {
      mascot: {
        mono: string;
        title: string;
        line: string;
        detail: string;
        badge: string;
      };
      voice: {
        mono: string;
        title: string;
        line: string;
        detail: string;
        badge: string;
      };
      moodTwin: {
        mono: string;
        title: string;
        line: string;
        detail: string;
        badge: string;
      };
      safety: {
        mono: string;
        title: string;
        line: string;
        detail: string;
        badge: string;
      };
      languages: {
        mono: string;
        title: string;
        line: string;
        detail: string;
        badge: string;
      };
    };
  };
  calm: {
    label: string;
    title: string;
    subtitle: string;
    inhale: string;
    hold: string;
    exhale: string;
    soundOn: string;
    soundOff: string;
    soundHint: string;
    disclaimer: string;
  };
  team: {
    label: string;
    title: string;
    subtitle: string;
    dept: string;
    school: string;
    guideLabel: string;
    guideName: string;
    guideTitle: string;
    members: Array<{
      name: string;
      regNo: string;
      role: string;
      bio: string;
    }>;
    clinicalNote: string;
  };
  helpSafety: {
    badge: string;
    title: string;
    description: string;
    teleManasLabel: string;
    teleManasNumber: string;
    teleManasSub: string;
    emergencyLabel: string;
    emergencyNumber: string;
    emergencySub: string;
    disclaimer: string;
    trustedContactTitle: string;
    trustedContactText: string;
    copingToolsTitle: string;
    copingTools: string[];
    callNow: string;
  };
  footer: {
    ctaHeading: string;
    ctaSub: string;
    startBtn: string;
    rights: string;
    deptLine: string;
    privacyPromise: string;
    disclaimer: string;
  };
  demoModal: {
    title: string;
    status: string;
    typingIndicator: string;
    inputPlaceholder: string;
    send: string;
    moodCheckinTitle: string;
    riskBadge: string;
    typingPaceLabel: string;
    safetyOverrideNotice: string;
  };
}

import type { Language } from '../types';

const baseTranslations: Record<'en' | 'ta', TranslationContent> = {
  en: {
    nav: {
      brand: "MANAS",
      brandSub: "AI Emotional Wellness Companion",
      features: "Features",
      calmScene: "Calm Space",
      team: "Team",
      help: "Help & Safety",
      menu: "MENU",
      close: "CLOSE",
      startTalking: "Start talking →",
      langToggle: "தமிழ்",
      emergencyCall: "Tele-MANAS: 14416",
    },
    hero: {
      projectWordmark: "MANAS",
      tagline: "A kind friend in a quiet room.",
      subtitle: "Personalized emotional-wellness companion. Real-time empathetic conversation, mood baseline tracking, and clinical guardrails.",
      ctaPrimary: "Start talking →",
      ctaSecondary: "Explore Features",
      interactHint: "Move cursor across the wordmark to reveal mascot expressions",
      interactHintTouch: "Touch & drag across letters to reveal mascot expressions",
      badge: "Intelligent Systems & Mental Health Computing v1",
      aiDisclaimerNote: "This is an AI companion, not a doctor or therapist.",
    },
    statement: {
      label: "THE CORE PHILOSOPHY",
      heading: "Stress, burnout, and loneliness don't happen in a single moment.",
      p1: "Most mental health chatbots are purely reactive—they only know what you type in this exact moment, answer in generic clinical templates, and forget you tomorrow.",
      highlight1: "We built an AI Digital Mental Twin that listens with genuine empathy, tracks longitudinal mood trends, and recognizes stress patterns before you reach breaking point.",
      p2: "Grounded in strict privacy, user consent at every step, and an unshakeable safety architecture that connects to 24/7 human crisis resources instantly.",
      highlight2: "Not therapy. Not diagnosis. A safe, warm presence when you need someone to listen.",
      subtext: "Designed specifically for students navigating academic pressure and professionals facing burnout.",
    },
    features: {
      sectionLabel: "SYSTEM CAPABILITIES",
      sectionTitle: "Built with empathy. Engineered for safety.",
      sectionSubtitle: "Five foundational pillars bridging human-like warmth with computational rigor.",
      cards: {
        mascot: {
          mono: "01 / MASCOT",
          title: "Personalized Avatar Companion",
          line: "A warm cartoon mascot with real-time empathetic expressions, lip-sync, and friendly gestures that make you feel truly heard.",
          detail: "Built with flat-vector aesthetics in calming teal and lavender. Adapts its facial state between neutral, joyful, and calm-concerned based on detected emotions.",
          badge: "Visual Empathy",
        },
        voice: {
          mono: "02 / VOICE",
          title: "Multilingual Speech Pipeline",
          line: "Speak naturally in Tamil, English, or Tanglish with Sarvam speech models and responsive barge-in capability.",
          detail: "Includes streaming speech-to-text with on-screen editable transcripts and low-latency text-to-speech, prioritizing raw audio deletion for privacy.",
          badge: "Sarvam STT / TTS",
        },
        moodTwin: {
          mono: "03 / MOOD TWIN",
          title: "AI Digital Mental Twin",
          line: "A virtual model of your emotional well-being that tracks baseline trends and gently flags burnout risk.",
          detail: "Analyzes rolling 7-day and 14-day trends against your personal baseline rather than generalized populations, offering proactive micro-interventions.",
          badge: "Predictive Analytics",
        },
        safety: {
          mono: "04 / SAFETY",
          title: "Layered Crisis Guardrails",
          line: "Dual-tier keyword and AI crisis detection running before every reply, connected directly to 24/7 Tele-MANAS 14416.",
          detail: "Every turn is pre-screened. High-risk inputs immediately halt generative text to render verified, counselor-approved crisis guidance and emergency contacts.",
          badge: "Zero-Compromise Safety",
        },
        languages: {
          mono: "05 / LANGUAGES",
          title: "Adaptive Style & Vernacular",
          line: "Fluid switching between English, தமிழ், Tanglish, and Hindi—adapting reply pace and length to your typing rhythm.",
          detail: "Analyzes keystroke timing, cadence, and message length to mirror calm conversational pacing while strictly refusing to mirror hostile or hopeless sentiment.",
          badge: "Context & Cadence",
        },
      },
    },
    calm: {
      label: "INTERACTIVE MINDFULNESS",
      title: "Take a quiet moment for yourself.",
      subtitle: "Follow the rhythmic breathing guide: Inhale for 4 seconds, exhale for 6 seconds. Gentle soundscape generated directly in your browser.",
      inhale: "Inhale slowly...",
      hold: "Hold gently...",
      exhale: "Exhale softly...",
      soundOn: "Mute Ambient Sound",
      soundOff: "Play Soothing Soundscape",
      soundHint: "Calming generative rain & theta ambient tones",
      disclaimer: "Box breathing and 4-6 pacing reduce sympathetic nervous system arousal within two minutes.",
    },
    team: {
      label: "RESEARCH LAB",
      title: "Intelligent Systems Lab Architecture",
      subtitle: "Intelligent Systems & Mental Health Computing Lab",
      dept: "Intelligent Systems Architecture",
      school: "Mental Health Computing",
      guideLabel: "Research Initiative",
      guideName: "Intelligent Systems & Mental Health Computing Lab",
      guideTitle: "Autonomous Collective · Emotional Wellness Lab",
      members: [
        {
          name: "Longitudinal Mood Modeling",
          regNo: "01",
          role: "Predictive Emotion Baseline Drift",
          bio: "7-day rolling baseline tracking comparing against individual equilibrium.",
        },
        {
          name: "Clinical Crisis Guardrails",
          regNo: "02",
          role: "Tele-MANAS 14416 Protocol",
          bio: "Zero-latency crisis pre-screening halting generative text on safety trigger.",
        },
        {
          name: "Sarvam Multilingual Voice",
          regNo: "03",
          role: "Indic Speech Pipeline",
          bio: "Barge-in capable Tamil, English, and Tanglish speech models with low latency.",
        },
        {
          name: "DPDP 2023 Architecture",
          regNo: "04",
          role: "Client-Side Encryption & RLS",
          bio: "Zero diagnosis bias, explicit user consent, and instant session purge.",
        },
        {
          name: "Real-Time 3D Mascot",
          regNo: "05",
          role: "Expressive Visual Empathy",
          bio: "Dynamic lip-sync, responsive eye contact, and empathetic gesture animation.",
        },
      ],
      clinicalNote: "Crisis response templates, safety rules, and mindfulness exercises are modeled for clinical review by certified psychologists and college counseling center advisors.",
    },
    helpSafety: {
      badge: "24/7 CRISIS & SAFETY NET",
      title: "Immediate Help is Always Available",
      description: "If you or someone you know is struggling or in distress, you do not have to carry it alone. These free, confidential, government-supported resources are available right now.",
      teleManasLabel: "Tele-MANAS National Helpline",
      teleManasNumber: "14416",
      teleManasSub: "Toll-Free, 24/7, Available in 20+ Indian Languages (or 1-800-891-4416)",
      emergencyLabel: "National Emergency Services",
      emergencyNumber: "112",
      emergencySub: "Immediate police, ambulance, or medical assistance across India",
      disclaimer: "This is an AI companion, not a doctor or therapist. It does not provide medical diagnoses, treatment, or clinical prescriptions.",
      trustedContactTitle: "Reach Out to Someone You Trust",
      trustedContactText: "Connecting with a close friend, family member, professor, or campus counselor is one of the most effective steps when things feel heavy.",
      copingToolsTitle: "Quick Grounding Tools (5-4-3-2-1)",
      copingTools: [
        "5 things you can see around you",
        "4 things you can physically touch",
        "3 sounds you can hear right now",
        "2 things you can smell",
        "1 slow, deep conscious breath",
      ],
      callNow: "Call Helpline Now",
    },
    footer: {
      ctaHeading: "Ready to check in with yourself?",
      ctaSub: "Experience compassionate, judgment-free AI companion support in English, தமிழ், and Tanglish.",
      startBtn: "Start talking with Mascot →",
      rights: "MANAS Emotional Wellness Project. All rights reserved.",
      deptLine: "Intelligent Systems & Mental Health Computing Architecture",
      privacyPromise: "Zero dark patterns. DPDP Act compliance. Explicit consent toggles. Immediate data purge on request.",
      disclaimer: "Strict Disclaimer: This software is an emotional-wellness companion designed for academic research and self-reflection. It is neither a diagnostic tool nor a substitute for licensed medical or psychiatric care.",
    },
    demoModal: {
      title: "Companion Live Preview",
      status: "AI Companion Active · Listening with Empathy",
      typingIndicator: "Mascot is reflecting...",
      inputPlaceholder: "Type how you're feeling today (English, தமிழ், Tanglish)...",
      send: "Send",
      moodCheckinTitle: "Quick Mood Check-in",
      riskBadge: "Safety Filter: Active (Pre-Screening Every Input)",
      typingPaceLabel: "Typing cadence detected",
      safetyOverrideNotice: "Crisis safety protocol engaged. Fixed vetted message displayed.",
    },
  },
  ta: {
    nav: {
      brand: "மானஸ்",
      brandSub: "மனநல AI தோழன்",
      features: "சிறப்பம்சங்கள்",
      calmScene: "அமைதி வெளி",
      team: "ஆய்வுக் குழு",
      help: "உதவி & பாதுகாப்பு",
      menu: "பட்டியல்",
      close: "மூடு",
      startTalking: "உரையாடலைத் தொடங்கு →",
      langToggle: "English",
      emergencyCall: "Tele-MANAS: 14416",
    },
    hero: {
      projectWordmark: "MANAS",
      tagline: "ஒரு அமைதியான அறையில் கனிவான தோழன்.",
      subtitle: "தனிப்பயனாக்கப்பட்ட உணர்ச்சி நல்வாழ்வுத் துணை. நிகழ்நேர கனிவான உரையாடல், மனநிலை போக்கு கண்காணிப்பு மற்றும் பாதுகாப்பு நெறிமுறைகள்.",
      ctaPrimary: "உரையாடலைத் தொடங்கு →",
      ctaSecondary: "அம்சங்களை அறிக",
      interactHint: "சின்னத்தின் முகபாவங்களை காண எழுத்துக்களின் மேல் கர்சரை நகர்த்தவும்",
      interactHintTouch: "சின்னத்தின் முகபாவங்களை வெளிப்படுத்த விரலால் எழுத்துக்களைத் தொடவும்",
      badge: "கல்வி ஆராய்ச்சி மற்றும் தயாரிப்பு v1",
      aiDisclaimerNote: "இது ஒரு AI தோழன் மட்டுமே, மருத்துவர் அல்லது மனநல நிபுணர் அல்ல.",
    },
    statement: {
      label: "அடிப்படை தத்துவம்",
      heading: "மன அழுத்தமும், தனிமையும் ஒரு கணத்தில் தோன்றுவதில்லை.",
      p1: "பெரும்பாலான மனநல சாட்போட்கள் எதிர்வினையாற்றுபவை மட்டுமே—நீங்கள் இப்போது தட்டச்சு செய்வதை மட்டுமே பார்த்து, பொதுவான மருத்துவ வார்த்தைகளை வழங்கி, நாளை உங்களை மறந்துவிடுகின்றன.",
      highlight1: "நாங்கள் ஒரு AI டிஜிட்டல் மெண்டல் ட்வின்னை உருவாக்கியுள்ளோம், அது உண்மையான கருணையுடன் கேட்கிறது, மனநிலை போக்குகளை கண்காணிக்கிறது, மேலும் நீங்கள் சோர்வடையும் முன்பே மன அழுத்தத்தை உணர்கிறது.",
      p2: "கடுமையான தனியுரிமை, ஒவ்வொரு படியிலும் பயனர் ஒப்புதல் மற்றும் 24/7 மனித உதவி மையங்களுடன் உடனடியாக இணைக்கும் பாதுகாப்புக் கட்டமைப்புடன் உருவாக்கப்பட்டுள்ளது.",
      highlight2: "சிகிச்சை அல்ல. மருத்துவ நோயறிதல் அல்ல. யாராவது கேட்க வேண்டும் என்று நீங்கள் நினைக்கும் போது பாதுகாப்பான, கனிவான துணை.",
      subtext: "கல்விச் சுமையை எதிர்கொள்ளும் மாணவர்களுக்காகவும், பணி அழுத்தத்தில் உள்ளவர்களுக்காகவும் சிறப்பாக வடிவமைக்கப்பட்டது.",
    },
    features: {
      sectionLabel: "கட்டமைப்பு திறன்கள்",
      sectionTitle: "கனிவுடன் உருவானது. பாதுகாப்புடன் வடிவமைக்கப்பட்டது.",
      sectionSubtitle: "மனித நேயத்துடன் கணினி துல்லியத்தை இணைக்கும் ஐந்து அடிப்படைத் தூண்கள்.",
      cards: {
        mascot: {
          mono: "01 / மாஸ்காட்",
          title: "தனிப்பயனாக்கப்பட்ட கார்ட்டூன் தோழன்",
          line: "உங்களை உண்மையாகக் கவனித்து கேட்கும் நிகழ்நேர முகபாவங்கள் மற்றும் அனிமேஷன் கொண்ட கார்ட்டூன் சின்னம்.",
          detail: "சாந்தமான டீல் மற்றும் லாவெண்டர் வண்ணங்களில் பிளாட்-வெக்டர் வடிவம். கண்டறியப்பட்ட உணர்வுகளுக்கு ஏற்ப புன்னகை, அமைதி அல்லது கனிவான முகபாவங்களுக்கு மாறுகிறது.",
          badge: "பார்வை கனிவு",
        },
        voice: {
          mono: "02 / குரல்",
          title: "பன்மொழி குரல் கட்டமைப்பு",
          line: "சர்வம் (Sarvam) மொழி மாதிரிகளுடன் தமிழ், ஆங்கிலம் அல்லது தங்கிலீஷில் இயல்பாகப் பேசுங்கள்.",
          detail: "திரையில் திருத்தக்கூடிய உரையுடன் உடனடி பேச்சு-உரை மாற்றம் மற்றும் குறைந்த தாமத உரை-பேச்சு ஒலிபரப்பு. தனியுரிமைக்காக குரல் பதிவுகள் உடனடியாக நீக்கப்படும்.",
          badge: "சர்வம் STT / TTS",
        },
        moodTwin: {
          mono: "03 / மன இரட்டை",
          title: "AI டிஜிட்டல் மெண்டல் ட்வின்",
          line: "உங்கள் உணர்ச்சி நல்வாழ்வின் மெய்நிகர் மாதிரி—மனநிலை போக்குகளைக் கண்காணித்து சோர்வு அபாயத்தை முன்கூட்டியே உணர்த்துகிறது.",
          detail: "பொதுவான மக்கள்தொகைக்கு பதிலாக உங்கள் சொந்த 7 நாள் மற்றும் 14 நாள் அடிப்படை நிலையை பகுப்பாய்வு செய்து அமைதியான பயிற்சிகளை பரிந்துரைக்கிறது.",
          badge: "முன்கணிப்பு பகுப்பாய்வு",
        },
        safety: {
          mono: "04 / பாதுகாப்பு",
          title: "அடுக்குமுறை நெருக்கடி பாதுகாப்பு",
          line: "ஒவ்வொரு பதிலுக்கும் முன் இயங்கும் இரு அடுக்கு பாதுகாப்பு—நேரடியாக 24/7 Tele-MANAS 14416 உடன் இணைக்கப்பட்டுள்ளது.",
          detail: "ஒவ்வொரு செய்தியும் பரிசோதிக்கப்படுகிறது. தீவிர துயரம் கண்டறியப்பட்டால், AI உரை நிறுத்தப்பட்டு, சரிபார்க்கப்பட்ட அவசர உதவி எண்களும் வழிகாட்டுதலும் காட்டப்படும்.",
          badge: "சமரசமற்ற பாதுகாப்பு",
        },
        languages: {
          mono: "05 / மொழிகள்",
          title: "தழுவல் நடை & தாய்மொழி ஆதரவு",
          line: "தமிழ், ஆங்கிலம், தங்கிலீஷ் மற்றும் இந்திக்கு இடையேயான சரளமான உரையாடல்—உங்கள் தட்டச்சு வேகத்திற்கு ஏற்ப பதிலளிக்கும் முறை.",
          detail: "உங்கள் தட்டச்சு வேகம் மற்றும் இடைநிறுத்தங்களை அளவிட்டு பதிலின் நீளத்தையும் அமைதியையும் மாற்றியமைக்கிறது, ஆனால் அவநம்பிக்கையான வார்த்தைகளை ஒருபோதும் நகலெடுக்காது.",
          badge: "சூழல் & தாளம்",
        },
      },
    },
    calm: {
      label: "அமைதியான தருணம்",
      title: "உங்களுக்காக ஒரு அமைதியான தருணத்தை எடுங்கள்.",
      subtitle: "சீரான சுவாச வழிகாட்டியைப் பின்பற்றுங்கள்: 4 வினாடிகள் மூச்சை உள்ளிழுக்கவும், 6 வினாடிகள் மெதுவாக வெளியிடவும். உங்கள் உலாவியில் உருவாகும் சாந்தமான இயற்கை ஒலி.",
      inhale: "மெதுவாக மூச்சை உள்ளிழுக்கவும்...",
      hold: "மென்மையாக அடக்கவும்...",
      exhale: "மெதுவாக மூச்சை வெளியிடவும்...",
      soundOn: "ஒலியை முடக்கு",
      soundOff: "சாந்தமான பின்னணி ஒலியை இயக்கு",
      soundHint: "மழை மற்றும் அமைதியான அலைகளின் பின்னணி ஒலி",
      disclaimer: "இந்த சீரான சுவாசப் பயிற்சி இரு நிமிடங்களில் உங்கள் நரம்பு மண்டலத்தை அமைதிப்படுத்துகிறது.",
    },
    team: {
      label: "ஆய்வு அரண்",
      title: "நுண்ணறிவு ஆய்வக கட்டமைப்பு",
      subtitle: "கணினி அறிவியல் மற்றும் பொறியியல் துறை, கம்ப்யூட்டிங் பள்ளி",
      dept: "கணினி அறிவியல் மற்றும் பொறியியல் துறை",
      school: "கம்ப்யூட்டிங் பள்ளி",
      guideLabel: "ஆய்வுத் திட்டம்",
      guideName: "நுண்ணறிவு அமைப்புகள் மற்றும் மனநல கணினி ஆய்வகம்",
      guideTitle: "கம்ப்யூட்டிங் பள்ளி · கூட்டு ஆராய்ச்சி",
      members: [
        {
          name: "நீண்டகால மனநிலை மாதிரி",
          regNo: "01",
          role: "மனநிலை அடிப்படை வரைபடம்",
          bio: "7-நாள் மனநிலை மாற்றங்களை துல்லியமாக கணக்கிடும் வழிமுறை.",
        },
        {
          name: "அவசர கால பாதுகாப்பு",
          regNo: "02",
          role: "டெலி-மானஸ் 14416 நெறிமுறை",
          bio: "அவசர தேவைகளின் போது உடனடி மனித தொடர்பை வழங்கும் பாதுகாப்பு நெறிமுறை.",
        },
        {
          name: "சர்வம் பன்மொழி குரல்",
          regNo: "03",
          role: "இந்திய மொழிகளுக்கான பேச்சு அமைப்பு",
          bio: "தமிழ், ஆங்கிலம் கலந்த பேச்சு மாதிரிகள் மற்றும் நேரடி குரல் வெளியீடு.",
        },
        {
          name: "DPDP 2023 தனியுரிமை",
          regNo: "04",
          role: "முழு பாதுகாப்பான குறியாக்கம்",
          bio: "பயனர் ஒப்புதலுடன் கூடிய பாதுகாப்பான தகவல் மேலாண்மை.",
        },
        {
          name: "நிகழ்நேர 3D சின்னம்",
          regNo: "05",
          role: "உணர்ச்சி வெளிப்பாடு",
          bio: "உரையாடலுக்கு ஏற்ப மாறும் முகபாவங்கள் மற்றும் கனிவான தோழமை.",
        },
      ],
      clinicalNote: "பாதுகாப்பு விதிகளும் பயிற்சிகளும் உளவியல் ஆலோசகர்களின் வழிகாட்டுதலின்படி வடிவமைக்கப்பட்டுள்ளன.",
    },
    helpSafety: {
      badge: "24/7 அவசர உதவி & பாதுகாப்பு அரண்",
      title: "உடனடி உதவி எப்போதும் உங்களுக்குக் கிடைக்கும்",
      description: "நீங்கள் அல்லது உங்களுக்குத் தெரிந்த ஒருவர் மன உளைச்சலில் இருந்தால், நீங்கள் அதைத் தனியாகச் சுமக்க வேண்டியதில்லை. இந்த இலவச, ரகசியமான, அரசு அங்கீகரிக்கப்பட்ட வளங்கள் இப்போது உங்களுக்குக் கிடைக்கின்றன.",
      teleManasLabel: "டெலி-மானாஸ் தேசிய உதவி எண்",
      teleManasNumber: "14416",
      teleManasSub: "கட்டணமில்லா, 24/7 சேவை, 20+ இந்திய மொழிகளில் (அல்லது 1-800-891-4416)",
      emergencyLabel: "தேசிய அவசரக்கால சேவைகள்",
      emergencyNumber: "112",
      emergencySub: "இந்தியா முழுவதும் காவல், ஆம்புலன்ஸ் அல்லது அவசர மருத்துவ உதவி",
      disclaimer: "இது ஒரு AI தோழன் மட்டுமே, மருத்துவர் அல்லது மனநல நிபுணர் அல்ல. இது மருத்துவ நோயறிதல் அல்லது சிகிச்சையை வழங்குவதில்லை.",
      trustedContactTitle: "நம்பிக்கையான ஒருவரைத் தொடர்பு கொள்ளுங்கள்",
      trustedContactText: "ஒரு நெருங்கிய நண்பர், குடும்பத்தினர் அல்லது கல்லூரி ஆலோசகரிடம் பேசுவது சுமை குறைய சிறந்த வழியாகும்.",
      copingToolsTitle: "விரைவு அமைதிப்படுத்தும் நுட்பம் (5-4-3-2-1)",
      copingTools: [
        "சுற்றிலும் நீங்கள் காணக்கூடிய 5 பொருட்கள்",
        "உடலால் தொடக்கூடிய 4 பொருட்கள்",
        "இப்போது நீங்கள் கேட்கக்கூடிய 3 ஒலிகள்",
        "நுகரக்கூடிய 2 வாசனைகள்",
        "1 ஆழமான, அமைதியான நனவான சுவாசம்",
      ],
      callNow: "உதவி எண்ணை அழைக்கவும்",
    },
    footer: {
      ctaHeading: "உங்களை நீங்களே கவனித்துக்கொள்ளத் தயாரா?",
      ctaSub: "தமிழ், ஆங்கிலம் மற்றும் தங்கிலீஷில் கனிவான, தீர்ப்பளிக்காத AI தோழனின் ஆதரவைப் பெறுங்கள்.",
      startBtn: "மாஸ்காட்டுடன் பேசத் தொடங்குங்கள் →",
      rights: "MANAS உணர்ச்சி நல்வாழ்வு திட்டம். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
      deptLine: "அறிவுசார் அமைப்புகள் மற்றும் உணர்ச்சி நல்வாழ்வு கணிப்பியல்",
      privacyPromise: "முழுமையான தனியுரிமை. DPDP சட்டம் இணக்கம். தெளிவான ஒப்புதல் மாற்றுக்கள். கோரிக்கையின் பேரில் உடனடி தரவு நீக்கம்.",
      disclaimer: "கடுமையான பொறுப்புத் துறப்பு: இந்த மென்பொருள் கல்வி ஆராய்ச்சி மற்றும் சுயபரிசீலனைக்கான உணர்ச்சி-நல்வாழ்வுத் துணை மட்டுமே. இது மருத்துவ அல்லது மனநல சிகிச்சைக்கு மாற்றாகாது.",
    },
    demoModal: {
      title: "நேரடி தோழன் முன்னோட்டம்",
      status: "AI தோழன் செயல்பாட்டில் உள்ளது · கனிவுடன் கேட்கிறது",
      typingIndicator: "மாஸ்காட் சிந்திக்கிறது...",
      inputPlaceholder: "இன்று நீங்கள் எப்படி உணர்கிறீர்கள் என்பதை தட்டச்சு செய்க (தமிழ், English, Tanglish)...",
      send: "அனுப்பு",
      moodCheckinTitle: "விரைவு மனநிலை பதிவு",
      riskBadge: "பாதுகாப்பு வடிகட்டி: இயங்குகிறது",
      typingPaceLabel: "தட்டச்சு வேகம் கண்டறியப்பட்டது",
      safetyOverrideNotice: "பாதுகாப்பு நெறிமுறை இயக்கப்பட்டது. சரிபார்க்கப்பட்ட உதவி செய்தி காட்டப்படுகிறது.",
    },
  },
};

export const translations: Record<Language, TranslationContent> = new Proxy(baseTranslations as any, {
  get(target, prop: string) {
    if (prop === 'ta') return target.ta;
    return target[prop] || target.en;
  },
});

