/**
 * site.config.ts
 * Single source of truth for all copy, brand tokens, features, and links across the site.
 * Edit text here without having to modify individual components.
 */

export interface WorkItem {
  id: string;
  tag: string;
  title: string;
  line: string;
  detail: string;
  route: string;
  actionId: 'chat' | 'voice' | 'mood' | 'safety' | 'cadence' | 'calm' | 'team';
  img?: string;
  gradient?: [string, string, string];
}

export interface SiteConfig {
  brand: string;
  logo: string;
  tagline: string;
  sub: string;
  mainCtaText: string;
  bookCallText: string;
  langToggleLabel: string;
  statement: string;
  worksCount: string;
  worksHeadTitle: string;
  worksHeadYear: string;
  works: WorkItem[];
  studio: {
    label: string;
    body: string;
    scramble: string;
    guideLabel: string;
    guideName: string;
    guideTitle: string;
    members: Array<{ name: string; regNo: string; role: string }>;
  };
  wordsOverMedia: {
    title: string;
    fragments: string[];
    bgImage: string;
  };
  footer: {
    cta: string;
    btnPrimary: string;
    btnSecondary: string;
    socials: Array<{ label: string; href: string; external?: boolean }>;
    wordmark: string;
    deptLine: string;
    rights: string;
    disclaimer: string;
  };
  textures: Array<[string, string, string]>;
}

import type { Language } from '../types';

const baseConfig: Record<'en' | 'ta', SiteConfig> = {
  en: {
    brand: "MANAS",
    logo: "MANAS",
    tagline: "A kind friend in a quiet room.",
    sub: "AI COMPANION · REAL-TIME EMPATHY & CRISIS SAFETY",
    mainCtaText: "START TALKING →",
    bookCallText: "START TALKING →",
    langToggleLabel: "தமிழ்",
    statement: "Stress burnout and loneliness do not happen overnight; we built an AI companion that listens with genuine empathy before breaking point.",
    worksCount: "(07)",
    worksHeadTitle: "WORKS",
    worksHeadYear: "© 26",
    works: [
      {
        id: "mascot-companion",
        tag: "01 / COMPANION",
        title: "Personalized Avatar Companion",
        line: "A warm cartoon mascot with real-time empathetic expressions.",
        detail: "Adapts facial states between neutral, joyful, and calm-concerned based on detected emotions.",
        route: "#chat-demo",
        actionId: "chat",
        img: "/assets/mascot/mascot_happy.jpg",
      },
      {
        id: "speech-pipeline",
        tag: "02 / SPEECH",
        title: "Sarvam Multilingual Pipeline",
        line: "Natural Tamil, English and Tanglish speech models with barge-in support.",
        detail: "Streaming speech-to-text with on-screen editable transcripts and low-latency text-to-speech.",
        route: "#voice-mode",
        actionId: "voice",
        img: "/assets/mascot/mascot_neutral.jpg",
      },
      {
        id: "digital-twin",
        tag: "03 / DIGITAL TWIN",
        title: "Longitudinal Mood Modeling",
        line: "Virtual model of emotional well-being tracking baseline drift.",
        detail: "Analyzes rolling 7-day and 14-day trends against your personal baseline rather than generalized groups.",
        route: "#mood-twin",
        actionId: "mood",
        gradient: ["#5b2bff", "#b6a1ff", "#1a0a7a"],
      },
      {
        id: "safety-guardrails",
        tag: "04 / SAFETY NET",
        title: "Dual-Tier Crisis Guardrails",
        line: "Pre-screen crisis safety protocol connected to Tele-MANAS 14416.",
        detail: "Every turn is pre-screened. High-risk inputs immediately halt generative text to render verified human help.",
        route: "#help-safety",
        actionId: "safety",
        img: "/assets/mascot/mascot_concerned.jpg",
      },
      {
        id: "adaptive-cadence",
        tag: "05 / ADAPTIVE CADENCE",
        title: "Keystroke Cadence Dynamics",
        line: "Mirrors user pacing, pauses and length without copying distress.",
        detail: "Analyzes keystroke timing, cadence, and backspaces to mirror calm conversational pacing.",
        route: "#cadence",
        actionId: "cadence",
        gradient: ["#ff2d8a", "#ffb3d6", "#7a0a3d"],
      },
      {
        id: "calm-space",
        tag: "06 / MINDFULNESS",
        title: "Interactive Calm Space",
        line: "4-6 rhythmic breathing guide and browser-synthesized theta audio.",
        detail: "Box breathing and generative theta soundscape that reduce sympathetic nervous arousal in two minutes.",
        route: "#calm-space",
        actionId: "calm",
        gradient: ["#276E8B", "#5FA88B", "#101820"],
      },
      {
        id: "academic-lab",
        tag: "07 / RESEARCH LAB",
        title: "Emotional AI Intelligence",
        line: "Intelligent Systems & Mental Health Computing Architecture.",
        detail: "Advanced AI research initiative for proactive emotional wellness, voice empathy, and crisis safety.",
        route: "#team",
        actionId: "team",
        gradient: ["#ffffff", "#8a8a8a", "#111111"],
      },
    ],
    studio: {
      label: "( The Studio )",
      body: "MANAS bridges conversational empathy with computational rigor. Not a medical replacement, not a generic chatbot—a reliable companion grounded in explicit user consent, DPDP privacy compliance, and instant crisis response.",
      scramble: "WE BUILD COMPANIONS WORTH TRUSTING",
      guideLabel: "Research Initiative",
      guideName: "Intelligent Systems & Mental Health Computing Lab",
      guideTitle: "Proactive Emotional Wellness Architecture",
      members: [
        { name: "Longitudinal Mood Modeling", regNo: "01", role: "Baseline Drift Analysis" },
        { name: "Crisis Safety Guardrails", regNo: "02", role: "Tele-MANAS 14416 Protocol" },
        { name: "Sarvam Multilingual Voice", regNo: "03", role: "Indic Low-Latency Speech" },
        { name: "DPDP Privacy Architecture", regNo: "04", role: "Zero-Knowledge Encryption" },
        { name: "Real-Time 3D Mascot", regNo: "05", role: "Expressive Visual Empathy" },
      ],
    },
    wordsOverMedia: {
      title: "LAYERED INTELLIGENCE & CRISIS PROTOCOLS",
      fragments: [
        "REAL-TIME EMPATHY",
        "ZERO DIAGNOSIS BIAS",
        "SARVAM INDIC VOICE",
        "TELE-MANAS 14416",
        "7-DAY MOOD BASELINE",
        "END-TO-END CONSENT",
        "DPDP PRIVACY COMPLIANT",
        "CADENCE MATCHING",
      ],
      bgImage: "/assets/mascot/mascot_neutral.jpg",
    },
    footer: {
      cta: "Let’s start with MANAS",
      btnPrimary: "Talk to MANAS →",
      btnSecondary: "Tele-MANAS Helpline 14416",
      socials: [
        { label: "Tele-MANAS 14416", href: "tel:14416" },
        { label: "Emergency 112", href: "tel:112" },
      ],
      wordmark: "MANAS",
      deptLine: "Intelligent Systems & Emotional Wellness Computing Architecture",
      rights: "© 2026 MANAS — Emotional Wellness Project",
      disclaimer: "Strict Disclaimer: This software is an emotional-wellness companion designed for academic research. It is neither a diagnostic tool nor a substitute for licensed psychiatric care.",
    },
    textures: [
      ["#f5f5f5", "#8a8a8a", "#ffffff"], // Liquid chrome / mercury
      ["#5b2bff", "#b6a1ff", "#1a0a7a"], // Purple electric foil
      ["#ff2d8a", "#ffb3d6", "#7a0a3d"], // Hot pink liquid glossy
      ["#276e8b", "#5fa88b", "#0d2b38"], // Emerald / sage calming glass
      ["#ffffff", "#d4af37", "#1a1a1a"], // Obsidian & titanium foil
    ],
  },
  ta: {
    brand: "MANAS",
    logo: "மானஸ்",
    tagline: "ஒரு அமைதியான அறையில் கனிவான தோழன்.",
    sub: "மனநல AI தோழன் · நிகழ்நேர கருணை மற்றும் பாதுகாப்பு",
    mainCtaText: "உரையாடுங்கள் →",
    bookCallText: "மானஸிடம் பேசுங்கள் →",
    langToggleLabel: "English",
    statement: "மன அழுத்தமும் தனிமையும் ஒரு கணத்தில் தோன்றுவதில்லை; நீங்கள் சோர்வடையும் முன்பே கருணையுடன் கேட்கும் ஓர் AI தோழனை உருவாக்கியுள்ளோம்.",
    worksCount: "(07)",
    worksHeadTitle: "WORKS",
    worksHeadYear: "© 26",
    works: [
      {
        id: "mascot-companion",
        tag: "01 / தோழன்",
        title: "தனிப்பயனாக்கப்பட்ட கார்ட்டூன் சின்னம்",
        line: "நிகழ்நேர கனிவான முகபாவங்களுடன் கூடிய தோழன்.",
        detail: "உணர்ச்சிகளை உணர்ந்து மகிழ்ச்சி, அமைதி, கவலை ஆகிய முகபாவங்களை வெளிப்படுத்துகிறது.",
        route: "#chat-demo",
        actionId: "chat",
        img: "/assets/mascot/mascot_happy.jpg",
      },
      {
        id: "speech-pipeline",
        tag: "02 / குரல்",
        title: "பன்மொழி குரல் தொழில்நுட்பம்",
        line: "தமிழ், ஆங்கிலம் மற்றும் தங்கிலிஷ் உரையாடல் வசதி.",
        detail: "சர்வம் AI மாடல்கள் மூலம் நிகழ்நேர ஒலிபெயர்ப்பு மற்றும் குறைந்த தாமத குரல் வெளியீடு.",
        route: "#voice-mode",
        actionId: "voice",
        img: "/assets/mascot/mascot_neutral.jpg",
      },
      {
        id: "digital-twin",
        tag: "03 / மன மாதிரி",
        title: "நீண்டகால மனநிலை மாதிரி",
        line: "மன அமைதியை கண்காணிக்கும் மெய்நிகர் மாதிரி.",
        detail: "உங்கள் தனிப்பட்ட 7-நாள் மனநிலை மாற்றங்களை துல்லியமாக பகுப்பாய்வு செய்கிறது.",
        route: "#mood-twin",
        actionId: "mood",
        gradient: ["#5b2bff", "#b6a1ff", "#1a0a7a"],
      },
      {
        id: "safety-guardrails",
        tag: "04 / பாதுகாப்பு",
        title: "இரட்டை அடுக்கு அவசர பாதுகாப்பு",
        line: "டெலி-மானஸ் 14416 உடன் நேரடி இணைப்பு கொண்ட பாதுகாப்பு நெறிமுறை.",
        detail: "ஒவ்வொரு செய்தியும் ஆய்வு செய்யப்படுகிறது. அதிக ஆபத்துள்ள நேரங்களில் உடனடி மனித உதவி வழங்கப்படுகிறது.",
        route: "#help-safety",
        actionId: "safety",
        img: "/assets/mascot/mascot_concerned.jpg",
      },
      {
        id: "adaptive-cadence",
        tag: "05 / நடை வேகம்",
        title: "தட்டச்சு வேகத்தை உணரும் அமைப்பு",
        line: "பயனரின் தட்டச்சு வேகத்திற்கும் தாளத்திற்கும் ஏற்ப பதிலளித்தல்.",
        detail: "தட்டச்சு வேகம், இடைநிறுத்தங்களை உணர்ந்து அமைதியான வேகத்தில் பதிலளிக்கிறது.",
        route: "#cadence",
        actionId: "cadence",
        gradient: ["#ff2d8a", "#ffb3d6", "#7a0a3d"],
      },
      {
        id: "calm-space",
        tag: "06 / அமைதி வெளி",
        title: "சுவாசப் பயிற்சி & அமைதி ஒலி",
        line: "4-6 வினாடி மூச்சுப்பயிற்சி மற்றும் இயற்கையான பிரவுசர் பின்னணி ஒலி.",
        detail: "இரண்டு நிமிடங்களில் இதயத்துடிப்பையும் மன அழுத்தத்தையும் கட்டுப்படுத்தும் எளிய பயிற்சி.",
        route: "#calm-space",
        actionId: "calm",
        gradient: ["#276E8B", "#5FA88B", "#101820"],
      },
      {
        id: "academic-lab",
        tag: "07 / ஆய்வுக் கூடம்",
        title: "உணர்ச்சி கணிப்பியல் ஆராய்ச்சி",
        line: "அறிவுசார் அமைப்புகள் மற்றும் உணர்ச்சி நல்வாழ்வு கணிப்பியல்.",
        detail: "ஆழ்ந்த கனிவு, குரல் வழி உரையாடல் மற்றும் அவசரகால பாதுகாப்பிற்கான மேம்பட்ட AI ஆராய்ச்சி.",
        route: "#team",
        actionId: "team",
        gradient: ["#ffffff", "#8a8a8a", "#111111"],
      },
    ],
    studio: {
      label: "( ஆய்வகம் )",
      body: "மானஸ் (MANAS) உரையாடல் கனிவையும் கணக்கீட்டு துல்லியத்தையும் ஒருங்கிணைக்கிறது. இது மருத்துவ சிகிச்சைக்கான மாற்று அல்ல, பொதுவான சாட்பாட்டும் அல்ல—தெளிவான பயனர் ஒப்புதல், DPDP தனியுரிமை இணக்கம் மற்றும் உடனடி அவசரக்கால ஆதரவு கொண்ட நம்பகமான AI தோழன்.",
      scramble: "நம்பகமான தோழனை உருவாக்குகிறோம்",
      guideLabel: "ஆய்வுத் திட்டம்",
      guideName: "அறிவுசார் அமைப்புகள் மற்றும் மனநல கணினி ஆய்வகம்",
      guideTitle: "உணர்ச்சி நல்வாழ்வு கட்டமைப்பு",
      members: [
        { name: "நீண்டகால மனநிலை மாதிரி", regNo: "01", role: "அடிப்படை மனநிலை பகுப்பாய்வு" },
        { name: "அவசர கால பாதுகாப்பு", regNo: "02", role: "டெலி-மானஸ் 14416 நெறிமுறை" },
        { name: "சர்வம் பன்மொழி குரல்", regNo: "03", role: "இந்திய மொழி குரல் அமைப்பு" },
        { name: "DPDP 2023 தனியுரிமை", regNo: "04", role: "முழு பாதுகாப்பான குறியாக்கம்" },
        { name: "3D கார்ட்டூன் சின்னம்", regNo: "05", role: "நிகழ்நேர உணர்ச்சி வெளிப்பாடு" },
      ],
    },
    wordsOverMedia: {
      title: "பாதுகாப்பு & நுண்ணறிவு அடுக்குகள்",
      fragments: [
        "நிகழ்நேர கனிவு",
        "மருத்துவ சார்பின்மை",
        "சர்வம் குரல் வழி",
        "டெலி-மானஸ் 14416",
        "7-நாள் மனநிலை வரைபடம்",
        "முழு ஒப்புதல் பாதுகாப்பு",
        "தனியுரிமை உறுதி",
        "வேகத் தழுவல்",
      ],
      bgImage: "/assets/mascot/mascot_neutral.jpg",
    },
    footer: {
      cta: "மானஸ் தொடங்குவோம்",
      btnPrimary: "மானஸிடம் பேசுங்கள் →",
      btnSecondary: "டெலி-மானஸ் உதவி 14416",
      socials: [
        { label: "டெலி-மானஸ் 14416", href: "tel:14416" },
        { label: "அவசரகால உதவி 112", href: "tel:112" },
      ],
      wordmark: "MANAS",
      deptLine: "அறிவுசார் அமைப்புகள் மற்றும் உணர்ச்சி நல்வாழ்வு கணிப்பியல்",
      rights: "© 2026 MANAS — உணர்ச்சி நல்வாழ்வு திட்டம்",
      disclaimer: "முக்கிய குறிப்பு: இது மருத்துவ சிகிச்சை அல்ல. அவசர உதவிக்கு 14416 அல்லது 112 ஐ அழைக்கவும்.",
    },
    textures: [
      ["#f5f5f5", "#8a8a8a", "#ffffff"],
      ["#5b2bff", "#b6a1ff", "#1a0a7a"],
      ["#ff2d8a", "#ffb3d6", "#7a0a3d"],
      ["#276e8b", "#5fa88b", "#0d2b38"],
      ["#ffffff", "#d4af37", "#1a1a1a"],
    ],
  },
};

export const siteConfigByLang: Record<Language, SiteConfig> = new Proxy(baseConfig as any, {
  get(target, prop: string) {
    if (prop === 'ta') return target.ta;
    return target[prop] || target.en;
  },
});

