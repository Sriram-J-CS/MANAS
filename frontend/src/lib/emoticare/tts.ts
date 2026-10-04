/**
 * EmotiCare Client-Side TTS Adapter
 * Calls server-side /api/voice/tts (Sarvam AI Bulbul v2 – real native speakers)
 * with a rich browser Web SpeechSynthesis fallback that gender/language-matches voices.
 */

import type {
  SupportedLanguage,
  VoiceGender,
  SpeakResult,
  SentenceAudioSegment,
  EmotionTag,
} from './types';
import { LANGUAGE_CATALOG } from './types';

// BCP-47 → browser voice search terms (ordered by quality preference)
const BROWSER_VOICE_HINTS: Record<string, string[]> = {
  'en-IN': ['en-IN', 'en_IN', 'en-in', 'en-GB', 'en-US', 'en'],
  'hi-IN': ['hi-IN', 'hi_IN', 'hi-in', 'hi'],
  'ta-IN': ['ta-IN', 'ta_IN', 'ta-in', 'ta'],
  'te-IN': ['te-IN', 'te_IN', 'te-in', 'te'],
  'ml-IN': ['ml-IN', 'ml_IN', 'ml-in', 'ml'],
  'kn-IN': ['kn-IN', 'kn_IN', 'kn-in', 'kn'],
  'bn-IN': ['bn-IN', 'bn_IN', 'bn-in', 'bn'],
  'mr-IN': ['mr-IN', 'mr_IN', 'mr-in', 'mr'],
};

// Gender keywords to scan in voice.name
const FEMALE_KEYWORDS = ['female', 'woman', 'girl', 'ananya', 'meera', 'divya', 'priya', 'lekha'];
const MALE_KEYWORDS   = ['male', 'man', 'boy', 'achal', 'arjun', 'karan', 'raj'];

export async function speak(
  lang: SupportedLanguage,
  speechText: string,
  voiceGender: VoiceGender = 'female',
  emotion: EmotionTag = 'calm'
): Promise<SpeakResult> {
  try {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: speechText,
        language: lang.split('-')[0], // 'hi-IN' → 'hi'
        gender: voiceGender,
        emotion,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.audio_base64) {
        // Play the returned audio directly and build segment metadata
        const audioBlob = _base64ToBlob(data.audio_base64, 'audio/wav');
        const audioUrl  = URL.createObjectURL(audioBlob);
        const audio     = new Audio(audioUrl);
        audio.play().catch(() => {});

        const sentences = (speechText.split(/((?<=[.!?।])\s+)/).filter(Boolean));
        const segments: SentenceAudioSegment[] = sentences.map((s, idx) => ({
          sentenceIndex: idx,
          text: s,
          audioBase64: idx === 0 ? data.audio_base64 : '',
          durationMs: Math.max(1200, s.length * 68),
          visemes: _estimateVisemes(s),
        }));

        const meta = LANGUAGE_CATALOG[lang];
        return {
          lang,
          voiceGender,
          voiceName: data.voice_used ?? (voiceGender === 'female' ? meta.defaultFemaleVoice : meta.defaultMaleVoice),
          fullSpeechText: speechText,
          segments,
          totalDurationMs: segments.reduce((a, s) => a + s.durationMs, 0),
        };
      }

      // Server returned use_client_tts fallback payload
      if (data?.use_client_tts) {
        return _browserSpeak(lang, data.clean_text ?? speechText, voiceGender);
      }
    }
  } catch (err) {
    console.warn('[TTS] Server fetch failed, using browser fallback:', err);
  }

  return _browserSpeak(lang, speechText, voiceGender);
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser SpeechSynthesis fallback – gender + language aware
// ─────────────────────────────────────────────────────────────────────────────

function _browserSpeak(
  lang: SupportedLanguage,
  speechText: string,
  voiceGender: VoiceGender
): SpeakResult {
  const meta = LANGUAGE_CATALOG[lang] ?? LANGUAGE_CATALOG['en-IN'];
  const sentences = speechText.split(/((?<=[.!?।])\s+)/).filter(Boolean);
  const segments: SentenceAudioSegment[] = sentences.map((s, idx) => ({
    sentenceIndex: idx,
    text: s,
    audioBase64: '',
    durationMs: Math.max(1200, s.length * 70),
    visemes: _estimateVisemes(s),
  }));

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    const bestVoice = _pickBestBrowserVoice(voices, lang, voiceGender);

    const utt   = new SpeechSynthesisUtterance(speechText);
    utt.lang    = lang;
    utt.rate    = 0.94;
    utt.pitch   = voiceGender === 'female' ? 1.15 : 0.85;
    utt.volume  = 1.0;
    if (bestVoice) utt.voice = bestVoice;

    window.speechSynthesis.speak(utt);
  }

  return {
    lang,
    voiceGender,
    voiceName: voiceGender === 'female' ? meta.defaultFemaleVoice : meta.defaultMaleVoice,
    fullSpeechText: speechText,
    segments,
    totalDurationMs: segments.reduce((a, s) => a + s.durationMs, 0),
  };
}

/** Scored browser voice picker: prefers exact lang+gender match. */
function _pickBestBrowserVoice(
  voices: SpeechSynthesisVoice[],
  lang: SupportedLanguage,
  gender: VoiceGender
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const hints    = BROWSER_VOICE_HINTS[lang] ?? [lang.split('-')[0]];
  const keywords = gender === 'female' ? FEMALE_KEYWORDS : MALE_KEYWORDS;

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const v of voices) {
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();

    // Language score: higher = closer match
    let langScore = 0;
    for (let i = 0; i < hints.length; i++) {
      if (vLang.startsWith(hints[i].toLowerCase())) {
        langScore = hints.length - i;
        break;
      }
    }
    if (langScore === 0) continue; // skip off-language voices entirely

    // Gender score
    const genderScore = keywords.some(k => vName.includes(k)) ? 2 : 0;

    const total = langScore * 10 + genderScore;
    if (total > bestScore) {
      bestScore = total;
      best = v;
    }
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function _base64ToBlob(b64: string, mimeType: string): Blob {
  const stripped = b64.includes(',') ? b64.split(',')[1] : b64;
  const bytes    = atob(stripped);
  const arr      = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

function _estimateVisemes(text: string): Array<{ timeMs: number; viseme: string; weight: number }> {
  const count = Math.max(3, Math.floor(text.length / 8));
  const step  = Math.floor(1200 / count);
  const pool  = ['jawOpen', 'viseme_aa', 'viseme_O', 'viseme_I', 'viseme_E', 'viseme_U'];
  return Array.from({ length: count }, (_, i) => ({
    timeMs:  i * step,
    viseme:  pool[i % pool.length],
    weight:  0.5 + (i % 3) * 0.15,
  }));
}
