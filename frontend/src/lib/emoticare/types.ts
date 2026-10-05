/**
 * EmotiCare Multilingual Voice Chat Module - Core Type Definitions
 * Languages: en-IN, hi-IN, ta-IN, te-IN, ml-IN, kn-IN, bn-IN, mr-IN
 */

export type SupportedLanguage =
  | 'en-IN'
  | 'hi-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'ml-IN'
  | 'kn-IN'
  | 'bn-IN'
  | 'mr-IN';

export type VoiceGender = 'male' | 'female';

export type EmotionTag =
  | 'calm'
  | 'concerned'
  | 'happy'
  | 'sad'
  | 'thoughtful'
  | 'empathetic';

export type ReplyMode =
  | 'validate'
  | 'curious_question'
  | 'reflect'
  | 'tiny_tip'
  | 'light_humor'
  | 'just_listen';

export interface VisemeMarker {
  timeMs: number;
  viseme: string;
  weight: number;
}

export interface SentenceAudioSegment {
  sentenceIndex: number;
  text: string;
  audioBase64: string;
  durationMs: number;
  visemes: VisemeMarker[];
}

export interface SpeakResult {
  lang: SupportedLanguage;
  voiceGender: VoiceGender;
  voiceName: string;
  fullSpeechText: string;
  segments: SentenceAudioSegment[];
  totalDurationMs: number;
}

export interface STTRecognitionResult {
  transcript: string;
  confidence: number;
  detectedLanguage: SupportedLanguage;
  isFinal: boolean;
  model: string;
  provider: 'google_chirp_3' | 'web_speech_fallback';
}

export interface LLMOutputJSON {
  display_text: string;
  speech_text: string;
  language: SupportedLanguage;
  emotion: EmotionTag;
  safety_flag: boolean;
  reply_mode?: ReplyMode;
}

export interface VoiceRatingSubmission {
  id?: string;
  language: SupportedLanguage;
  voiceGender: VoiceGender;
  voiceName: string;
  overallRating: number; // 1 to 5
  naturalness: number;   // 1 to 5
  pronunciation: number; // 1 to 5
  pacing: number;        // 1 to 5
  nativeSpeaker: boolean;
  feedbackText?: string;
  timestamp: string;
}

export interface LanguageMeta {
  code: SupportedLanguage;
  shortCode: string;
  nativeName: string;
  englishName: string;
  greetingColloquial: string;
  testSentence: string;
  defaultFemaleVoice: string;
  defaultMaleVoice: string;
}

export const LANGUAGE_CATALOG: Record<SupportedLanguage, LanguageMeta> = {
  'en-IN': {
    code: 'en-IN',
    shortCode: 'en',
    nativeName: 'English (India)',
    englishName: 'English (India)',
    greetingColloquial: 'Hey friend, how are things with you today?',
    testSentence: 'Whenever things feel heavy, you never have to carry it all by yourself. I am right here with you.',
    defaultFemaleVoice: 'en-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'en-IN-Chirp3-HD-Charon',
  },
  'hi-IN': {
    code: 'hi-IN',
    shortCode: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    greetingColloquial: 'सुनो दोस्त, आज मन कैसा है तुम्हारा?',
    testSentence: 'जब मन थोड़ा परेशान या भारी लगे, तो सब कुछ अकेले सहने की ज़रूरत नहीं है। मैं हमेशा आपके साथ हूँ।',
    defaultFemaleVoice: 'hi-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'hi-IN-Chirp3-HD-Charon',
  },
  'ta-IN': {
    code: 'ta-IN',
    shortCode: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    greetingColloquial: 'ஏய் தோழா, இன்னைக்கு மனசு எப்படி இருக்கு?',
    testSentence: 'மனசு ரொம்ப பாரமா இருக்கும்போது, தனியா தாங்கிக்க வேண்டியதில்லை. உங்க கூட பேச நான் இங்க இருக்கேன்.',
    defaultFemaleVoice: 'ta-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'ta-IN-Chirp3-HD-Charon',
  },
  'te-IN': {
    code: 'te-IN',
    shortCode: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    greetingColloquial: 'హేయ్ నేస్తం, ఈరోజు నీ మనసు ఎలా ఉంది?',
    testSentence: 'మనసు కాస్త భారంగా అనిపించినప్పుడు, ఒంటరిగా బాధపడాల్సిన పనిలేదు. మీ కోసం నేను ఎప్పుడూ ఇక్కడే ఉన్నాను.',
    defaultFemaleVoice: 'te-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'te-IN-Chirp3-HD-Charon',
  },
  'ml-IN': {
    code: 'ml-IN',
    shortCode: 'ml',
    nativeName: 'മലയാളം',
    englishName: 'Malayalam',
    greetingColloquial: 'ഹേയ് കൂട്ടുകാരാ, ഇന്ന് മനസ്സിൽ എന്താണ്?',
    testSentence: 'മനസ്സിന് വല്ലാത്ത ഭാരം തോന്നുമ്പോൾ, എല്ലാം ഒറ്റയ്ക്ക് ചുമക്കേണ്ടതില്ല. നിങ്ങളോടൊപ്പം സംസാരിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.',
    defaultFemaleVoice: 'ml-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'ml-IN-Chirp3-HD-Charon',
  },
  'kn-IN': {
    code: 'kn-IN',
    shortCode: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    greetingColloquial: 'ಹೇಯ್ ಗೆಳೆಯ, ಇವತ್ತು ಮನಸ್ಸು ಹೇಗಿದೆ?',
    testSentence: 'ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾದಾಗ, ಎಲ್ಲವನ್ನೂ ನೀವೊಬ್ಬರೇ ಸಹಿಸಿಕೊಳ್ಳಬೇಕಾಗಿಲ್ಲ. ನಿಮ್ಮ ಜೊತೆ ಮಾತನಾಡಲು ನಾನಿದ್ದೇನೆ.',
    defaultFemaleVoice: 'kn-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'kn-IN-Chirp3-HD-Charon',
  },
  'bn-IN': {
    code: 'bn-IN',
    shortCode: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    greetingColloquial: 'আরে বন্ধু, আজকের দিনটা কেমন কাটছে?',
    testSentence: 'মন যখন খুব ভারী লাগে, তখন একা একা সবকিছু সহ্য করার কোনো দরকার নেই। আমি সবসময় তোমার পাশে আছি।',
    defaultFemaleVoice: 'bn-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'bn-IN-Chirp3-HD-Charon',
  },
  'mr-IN': {
    code: 'mr-IN',
    shortCode: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    greetingColloquial: 'अरे दोस्ता, आज मन कसं वाटतंय तुझं?',
    testSentence: 'जेव्हा मन खूप जड वाटतं, तेव्हा सगळं काही एकट्याने सोसण्याची गरज नाही. तुमच्याशी बोलायला मी इथेच आहे.',
    defaultFemaleVoice: 'mr-IN-Chirp3-HD-Aoede',
    defaultMaleVoice: 'mr-IN-Chirp3-HD-Charon',
  },
};
