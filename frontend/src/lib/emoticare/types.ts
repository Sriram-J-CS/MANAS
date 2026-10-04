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
    testSentence: 'Hey friend, take a deep breath; remember you are never alone in this.',
    defaultFemaleVoice: 'en-IN-Chirp3-HD-F',
    defaultMaleVoice: 'en-IN-Chirp3-HD-M',
  },
  'hi-IN': {
    code: 'hi-IN',
    shortCode: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    greetingColloquial: 'सुनो दोस्त, आज मन कैसा है तुम्हारा?',
    testSentence: 'अरे सुनो, इतना stress मत लो; हम मिलकर इसका रास्ता निकालेंगे।',
    defaultFemaleVoice: 'hi-IN-Chirp3-HD-F',
    defaultMaleVoice: 'hi-IN-Chirp3-HD-M',
  },
  'ta-IN': {
    code: 'ta-IN',
    shortCode: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    greetingColloquial: 'ஏய் தோழா, இன்னைக்கு மனசு எப்படி இருக்கு?',
    testSentence: 'ஏய் தோழா, மனசு விட்டுப் பேசு; நான் எப்பவும் உன் கூடவே இருக்கேன்.',
    defaultFemaleVoice: 'ta-IN-Chirp3-HD-F',
    defaultMaleVoice: 'ta-IN-Chirp3-HD-M',
  },
  'te-IN': {
    code: 'te-IN',
    shortCode: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    greetingColloquial: 'హేయ్ నేస్తం, ఈరోజు నీ మనసు ఎలా ఉంది?',
    testSentence: 'హేయ్ నేస్తం, అంత tension పడకు; నేను నీకు తోడుగా ఉంటాను.',
    defaultFemaleVoice: 'te-IN-Chirp3-HD-F',
    defaultMaleVoice: 'te-IN-Chirp3-HD-M',
  },
  'ml-IN': {
    code: 'ml-IN',
    shortCode: 'ml',
    nativeName: 'മലയാളം',
    englishName: 'Malayalam',
    greetingColloquial: 'ഹേയ് കൂട്ടുകാരാ, ഇന്ന് മനസ്സിൽ എന്താണ്?',
    testSentence: 'ഹേയ് കൂട്ടുകാരാ, ഒട്ടും വിഷമിക്കല്ലേ; ഞാൻ എപ്പോഴും കൂടെയുണ്ട്.',
    defaultFemaleVoice: 'ml-IN-Chirp3-HD-F',
    defaultMaleVoice: 'ml-IN-Chirp3-HD-M',
  },
  'kn-IN': {
    code: 'kn-IN',
    shortCode: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    greetingColloquial: 'ಹೇಯ್ ಗೆಳೆಯ, ಇವತ್ತು ಮನಸ್ಸು ಹೇಗಿದೆ?',
    testSentence: 'ಹೇಯ್ ಗೆಳೆಯ, ಅಷ್ಟೊಂದು tension ಮಾಡ್ಕೋಬೇಡ; ನಾನು ನಿನ್ನ ಜೊತೆಯಲ್ಲೇ ಇದ್ದೀನಿ.',
    defaultFemaleVoice: 'kn-IN-Chirp3-HD-F',
    defaultMaleVoice: 'kn-IN-Chirp3-HD-M',
  },
  'bn-IN': {
    code: 'bn-IN',
    shortCode: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    greetingColloquial: 'আরে বন্ধু, আজকের দিনটা কেমন কাটছে?',
    testSentence: 'আরে বন্ধু, একদম চিন্তা কোরো না; আমি সবসময় তোমার পাশে আছি।',
    defaultFemaleVoice: 'bn-IN-Chirp3-HD-F',
    defaultMaleVoice: 'bn-IN-Chirp3-HD-M',
  },
  'mr-IN': {
    code: 'mr-IN',
    shortCode: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    greetingColloquial: 'अरे दोस्ता, आज मन कसं वाटतंय तुझं?',
    testSentence: 'अरे दोस्ता, काळजी नको करू; मी प्रत्येक पावलावर तुझ्या सोबत आहे.',
    defaultFemaleVoice: 'mr-IN-Chirp3-HD-F',
    defaultMaleVoice: 'mr-IN-Chirp3-HD-M',
  },
};
