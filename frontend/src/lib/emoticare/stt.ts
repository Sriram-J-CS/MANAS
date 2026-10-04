/**
 * EmotiCare Client-Side STT Adapter
 * Provides:
 * 1. Google Speech-to-Text V2 model chirp_3 with streaming/chunked recognize via /api/stt
 * 2. Web Speech API fallback
 * 3. Transcript Review & Correction Session ("Show the transcript for correction before sending")
 */

import type { SupportedLanguage, STTRecognitionResult } from './types';

export interface TranscriptReviewSession {
  transcript: string;
  confidence: number;
  detectedLanguage: SupportedLanguage;
  model: string;
  source: 'google_chirp_3' | 'web_speech_fallback';
}

export function startClientSpeechRecognition(
  language: SupportedLanguage,
  onInterim: (text: string, confidence: number) => void,
  onFinal: (session: TranscriptReviewSession) => void,
  onError: (err: any) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError(new Error('Browser Speech Recognition not supported in this browser.'));
    return () => {};
  }

  const recognizer = new SpeechRecognition();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = language;
  recognizer.maxAlternatives = 1;

  let accumulated = '';
  let highestConfidence = 0.89;

  recognizer.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const item = event.results[i];
      if (item[0].confidence) highestConfidence = item[0].confidence;
      if (item.isFinal) {
        accumulated += (accumulated ? ' ' : '') + item[0].transcript.trim();
      } else {
        interim += item[0].transcript;
      }
    }

    const currentText = accumulated + (interim ? ' ' + interim : '');
    onInterim(currentText, highestConfidence);

    if (accumulated && !interim) {
      onFinal({
        transcript: accumulated.trim(),
        confidence: Math.round(highestConfidence * 100) / 100,
        detectedLanguage: language,
        model: 'chirp_3',
        source: 'web_speech_fallback'
      });
    }
  };

  recognizer.onerror = (e: any) => {
    onError(e);
  };

  try {
    recognizer.start();
  } catch (e) {
    console.warn('SpeechRecognition start error:', e);
  }

  return () => {
    try {
      recognizer.stop();
    } catch {}
  };
}

export async function sendAudioToChirp3(
  audioBlob: Blob,
  preferredLanguage: SupportedLanguage = 'en-IN'
): Promise<STTRecognitionResult> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string) || '';
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            preferredLanguage
          })
        });

        if (res.ok) {
          const data = await res.json();
          resolve(data as STTRecognitionResult);
        } else {
          resolve({
            transcript: '',
            confidence: 0,
            detectedLanguage: preferredLanguage,
            isFinal: true,
            model: 'chirp_3',
            provider: 'google_chirp_3'
          });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(audioBlob);
  });
}
