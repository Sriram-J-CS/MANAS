/**
 * EmotiCare Multi-Language Safety Classifier
 * Runs deterministic rule-based safety triage across all 8 supported Indian languages:
 * en-IN, hi-IN, ta-IN, te-IN, ml-IN, kn-IN, bn-IN, mr-IN.
 */

import type { SupportedLanguage } from './types';
import { getCrisisTemplate, type CrisisTemplate } from './crisisTemplates';

export interface SafetyClassificationResult {
  isSafe: boolean;
  safetyFlag: boolean;
  category: 'none' | 'suicide_self_harm' | 'violence' | 'crisis';
  detectedPatterns: string[];
  crisisTemplate?: CrisisTemplate;
}

const SAFETY_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  'en-IN': [
    /\b(suicide|kill\s+(myself|me)|end\s+my\s+life|want\s+to\s+die|hang\s+(myself|me)|cut\s+my\s+wrists?)\b/i,
    /\b(overdose|drink\s+poison|slit\s+my\s+throat|jump\s+off\s+a?\s+(bridge|building|roof))\b/i,
    /\b(better\s+off\s+dead|no\s+reason\s+to\s+live|don'?t\s+want\s+to\s+live|tired\s+of\s+living|goodbye\s+cruel\s+world)\b/i,
    /\b(self\s*harm|hurt\s+myself|harming\s+myself|bleeding\s+myself)\b/i
  ],
  'hi-IN': [
    /(आत्महत्या|खुदकुशी|मर\s*जाना|जान\s*दे\s*(दूंगा|दूंगी|देना)|फांसी|जहर|मरने\s*का\s*मन)/i,
    /(जीना\s*नहीं\s*चाहता|जीने\s*की\s*इच्छा\s*नहीं|सब\s*खत्म\s*कर\s*(दूंगा|लूंगा)|जिंदगी\s*से\s*थक\s*गया)/i,
    /\b(suicide|khatam\s+kar\s+dunga|jaan\s+de\s+dunga|mar\s+jaunga|mar\s+jaungi|jeena\s+nahi\s+hai)\b/i
  ],
  'ta-IN': [
    /(தற்கொலை|சாக\s*வேண்டும்|சாகப்\s*போறேன்|செத்துடலாம்|உயிரை\s*விட|விஷம்\s*குடிக்க)/i,
    /(வாழ\s*பிடிக்கல|வாழ்க்கை\s*முடிஞ்சிடுச்சு|என்னை\s*நானே\s*அழித்து|தற்கொலைப்படை)/i,
    /\b(sethudalam|saaganum|vaazha\s+pidikala|uyira\s+vudanum|suicide|sethuruven)\b/i
  ],
  'te-IN': [
    /(ఆత్మహత్య|చనిపోవాలి|చనిపోతాను|ప్రాణం\s*తీసుకోవాలి|విషం\s*తాగడం|ఉరి\s*వేసుకోవడం)/i,
    /(బతకాలని\s*లేదు|జీవితం\s*ముగిసిపోయింది|నన్ను\s*నేను\s*చంపుకుంటా)/i,
    /\b(chanipovali|bathakalani\s+ledu|pranam\s+theesukunta|suicide|chanipothanu)\b/i
  ],
  'ml-IN': [
    /(ആത്മഹത്യ|മരിക്കണം|ജീവനൊടുക്കാൻ|വിഷം\s*കഴിക്കുക|തൂങ്ങിമരിക്കുക)/i,
    /(ജീവിക്കാൻ\s*തോന്നുന്നില്ല|എല്ലാം\s*അവസാനിപ്പിക്കാൻ|എന്നെത്തന്നെ\s*ഇല്ലാതാക്കാൻ)/i,
    /\b(marikanam|jeevikan\s+thonnunilla|suicide|kooduthal\s+sahikan\s+kazhiyilla)\b/i
  ],
  'kn-IN': [
    /(ಆತ್ಮಹತ್ಯೆ|ಸಾಯಬೇಕು|ಸಾಯ್ತೀನಿ|ಪ್ರಾಣ\s*ಬಿಡಬೇಕು|ವಿಷ\s*ಕುಡಿಯುವುದು|ನೇಣು\s*ಹಾಕಿಕೊಳ್ಳುವುದು)/i,
    /(ಬದುಕೋಕೆ\s*ಇಷ್ಟವಿಲ್ಲ|ಜೀವನ\s*ಸಾಕು\s*ಅನಿಸಿದೆ|ನನ್ನನ್ನು\s*ನಾನೇ\s*ಮುಗಿಸಿಕೊಳ್ಳುವೆ)/i,
    /\b(sayabeku|badukoke\s+ishta\s+illa|praana\s+bidabeku|suicide)\b/i
  ],
  'bn-IN': [
    /(আত্মহত্যা|মরতে\s*চাই|মরে\s*যাব|বিষ\s*খাওয়া|গলায়\s*দড়ি|জীবন\s*শেষ\s*করতে)/i,
    /(বেঁচে\s*থাকার\s*ইচ্ছা\s*নেই|আর\s*বাঁচতে\s*চাই\s*না|নিজেকে\s*শেষ\s*করে\s*দেব)/i,
    /\b(morte\s+chai|more\s+jabo|benche\s+thakte\s+chai\s+na|suicide)\b/i
  ],
  'mr-IN': [
    /(आत्महत्या|मरायचं\s*आहे|जीव\s*द्यायचा|विष\s*पिऊन|फाशी\s*घेऊन|स्वतःला\s*संपवायचं)/i,
    /(जगायची\s*इच्छा\s*नाही|जगावं\s*वाटत\s*नाही|आयुष्य\s*संपवून\s*टाकतो)/i,
    /\b(maraycha\s+aahe|jeev\s+dyaycha|jagaychi\s+iccha\s+nahi|suicide)\b/i
  ]
};

export function classifySafety(
  message: string,
  preferredLanguage: SupportedLanguage = 'en-IN'
): SafetyClassificationResult {
  const clean = (message || '').trim();
  if (!clean) {
    return {
      isSafe: true,
      safetyFlag: false,
      category: 'none',
      detectedPatterns: []
    };
  }

  const matches: string[] = [];
  let triggeredLang: SupportedLanguage = preferredLanguage;

  const langPatterns = SAFETY_PATTERNS[preferredLanguage] || [];
  for (const pattern of langPatterns) {
    if (pattern.test(clean)) {
      matches.push(pattern.source);
    }
  }

  if (matches.length === 0) {
    for (const [lang, patterns] of Object.entries(SAFETY_PATTERNS) as [SupportedLanguage, RegExp[]][]) {
      for (const pattern of patterns) {
        if (pattern.test(clean)) {
          matches.push(pattern.source);
          triggeredLang = lang;
          break;
        }
      }
      if (matches.length > 0) break;
    }
  }

  if (matches.length > 0) {
    const crisisTemplate = getCrisisTemplate(triggeredLang, Math.floor(Math.random() * 4));
    return {
      isSafe: false,
      safetyFlag: true,
      category: 'suicide_self_harm',
      detectedPatterns: matches,
      crisisTemplate
    };
  }

  return {
    isSafe: true,
    safetyFlag: false,
    category: 'none',
    detectedPatterns: []
  };
}
