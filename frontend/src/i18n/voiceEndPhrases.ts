/**
 * voiceEndPhrases.ts
 * 
 * End-phrase dictionaries for 8 Indian languages:
 * English (en), Tamil (ta), Hindi (hi), Telugu (te), Kannada (kn), Malayalam (ml), Bengali (bn), Marathi (mr).
 * 
 * When a user finishes their speech with one of these phrases (e.g. "answer me", "what should I do"),
 * speech recognition triggers a 1.2-second continuation timer, showing "Sending… tap to cancel".
 * If no further speech is detected, the message is automatically dispatched.
 */

export const VOICE_END_PHRASES: Record<string, string[]> = {
  en: [
    "answer me",
    "give me the solution",
    "what should i do",
    "tell me what to do",
    "what do you think",
    "please help me",
    "how can i fix this",
    "what is the solution",
    "can you reply",
    "tell me the answer",
    "what do i do now",
    "what do you suggest",
    "give me advice",
    "help me out"
  ],
  ta: [
    "பதில் சொல்லு",
    "பதில் சொல்லுங்க",
    "தீர்வு கொடுங்க",
    "நான் என்ன செய்ய வேண்டும்",
    "எனக்கு என்ன பண்ணனும்னு சொல்லுங்க",
    "பதில் தாங்க",
    "வழி சொல்லுங்க",
    "உதவி பண்ணுங்க",
    "இப்ப நான் என்ன பண்ணட்டும்",
    "தீர்வு என்ன",
    "ஆலோசனை கொடுங்க"
  ],
  hi: [
    "मुझे जवाब दो",
    "समाधान बताओ",
    "मुझे क्या करना चाहिए",
    "हल बताओ",
    "मेरी मदद करो",
    "बताओ क्या करूँ",
    "उत्तर दो",
    "अब मैं क्या करूँ",
    "मुझे सलाह दो",
    "उपाय बताओ",
    "कोई उपाय है क्या"
  ],
  te: [
    "నాకు సమాధానం చెప్పు",
    "పరిష్కారం చెప్పు",
    "నేను ఏమి చేయాలి",
    "నాకు సహాయం చేయి",
    "ఏం చేయాలో చెప్పు",
    "సలహా ఇవ్వండి",
    "సమాధానం ఇవ్వండి",
    "ఇప్పుడు నేనేం చేయాలి",
    "పరిష్కారం ఏంటి"
  ],
  kn: [
    "ನನಗೆ ಉತ್ತರಿಸು",
    "ಪರಿಹಾರ ನೀಡು",
    "ನಾನು ಏನು ಮಾಡಬೇಕು",
    "ನನಗೆ ಸಹಾಯ ಮಾಡು",
    "ಏನು ಮಾಡಬೇಕೆಂದು ಹೇಳು",
    "ಉತ್ತರ ಕೊಡಿ",
    "ಪರಿಹಾರ ಹೇಳಿ",
    "ಈಗ ನಾನು ಏನು ಮಾಡಲಿ",
    "ಸಲಹೆ ನೀಡಿ"
  ],
  ml: [
    "എനിക്ക് ഉത്തരം തരൂ",
    "പരിഹാരം തരൂ",
    "ഞാൻ എന്തുചെയ്യണം",
    "എന്നെ സഹായിക്കൂ",
    "എന്താണ് ചെയ്യേണ്ടത് എന്ന് പറയൂ",
    "മറുപടി തരൂ",
    "വഴി പറഞ്ഞു തരൂ",
    "ഇനി ഞാൻ എന്തുചെയ്യും"
  ],
  bn: [
    "আমাকে উত্তর দিন",
    "আমাকে সমাধান দিন",
    "আমার কী করা উচিত",
    "আমাকে সাহায্য করুন",
    "কী করব বলো",
    "উত্তর দাও",
    "সমাধান বলো",
    "এখন আমি কী করব"
  ],
  mr: [
    "मला उत्तर दे",
    "मला उपाय सांग",
    "मी काय करू",
    "मला मदत कर",
    "मला काय करायला हवे",
    "उत्तर सांग",
    "काहीतरी उपाय सांग",
    "आता मी काय करू"
  ]
};

/**
 * Normalizes text and tests whether it terminates with an established end-phrase
 * in the active language (or English).
 */
export function isVoiceEndPhrase(text: string, language = "en"): boolean {
  if (!text) return false;

  const normalized = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()।?!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const phrases = [
    ...(VOICE_END_PHRASES[language] || []),
    ...(language !== "en" ? VOICE_END_PHRASES.en : [])
  ];

  return phrases.some((phrase) => {
    const cleanPhrase = phrase.toLowerCase().trim();
    return normalized.endsWith(cleanPhrase) || normalized === cleanPhrase;
  });
}
