import type { LanguageInfo, SupportedLanguage } from './types';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    description: 'Clear, empathetic dialogue and evidence-based guidance',
    speechVoiceLang: 'en-IN'
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    description: 'எளிய தமிழ் உரையாடல் மற்றும் ஆறுதல்',
    speechVoiceLang: 'ta-IN'
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    description: 'सहज, आत्मीय और सरल हिंदी बातचीत',
    speechVoiceLang: 'hi-IN'
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    description: 'ప్రశాంతమైన మరియు ఆప్యాయమైన సంభాషణ',
    speechVoiceLang: 'te-IN'
  },
  {
    code: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    description: 'ಸರಳ, ಆತ್ಮೀಯ ಮತ್ತು ನೆಮ್ಮದಿಯ ಸಂಭಾಷಣೆ',
    speechVoiceLang: 'kn-IN'
  },
  {
    code: 'ml',
    nativeName: 'മലയാളം',
    englishName: 'Malayalam',
    description: 'ശാന്തവും ആശ്വാസകരവുമായ സംഭാഷണം',
    speechVoiceLang: 'ml-IN'
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    description: 'সহজ, সহানুভূতিশীল ও ভরসার কথোপকথন',
    speechVoiceLang: 'bn-IN'
  },
  {
    code: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    description: 'मनमोकळा, आश्वासक आणि काळजीपूर्वक संवाद',
    speechVoiceLang: 'mr-IN'
  }
];

export const LANGUAGE_MAP = SUPPORTED_LANGUAGES.reduce((acc, curr) => {
  acc[curr.code] = curr;
  return acc;
}, {} as Record<SupportedLanguage, LanguageInfo>);
