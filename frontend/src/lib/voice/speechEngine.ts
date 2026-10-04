/**
 * speechEngine.ts
 * 
 * Multilingual Speech Synthesis (TTS) & Continuous Speech Recognition (STT) engine.
 * 
 * Key Features:
 * 1. Continuous STT in 8 Indian languages (en, ta, hi, te, kn, ml, bn, mr).
 * 2. Live interim transcript updates directly into input box.
 * 3. Server-side fallback (POST /api/voice/stt via Sarvam/Gemini) when browser Web Speech API is absent.
 * 4. Immediate Barge-in: mascot avatar stops speaking the instant the user produces vocal input.
 * 5. Text-to-Speech (TTS):
 *    - Uses spoken_text or cleansed text.
 *    - Strips emojis and markdown formatting.
 *    - Pronounces emergency helplines ("14416", "112", "1098") digit by digit across all 8 languages.
 *    - Caching and sentence-level streaming with synchronized mouth viseme energy callbacks.
 */

export interface SpeechEngineOptions {
  voiceSpeed?: number;
  pitch?: number;
  voiceName?: string;
  onEnergy?: (energy: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface ContinuousListeningOptions {
  language?: string;
  onInterimText?: (interim: string) => void;
  onFinalText?: (final: string) => void;
  onSpeechDetected?: () => void;
  onError?: (err: any) => void;
}

// Helpline numbers digit-by-digit translations across all 8 languages
const EMERGENCY_DIGIT_MAP: Record<string, Record<string, string>> = {
  '14416': {
    en: 'one, four, four, one, six',
    ta: 'ஒன்று, நான்கு, நான்கு, ஒன்று, ஆறு',
    hi: 'एक, चार, चार, एक, छह',
    te: 'ఒకటి, నాలుగు, నాలుగు, ఒకటి, ఆరు',
    kn: 'ಒಂದು, ನಾಲ್ಕು, ನಾಲ್ಕು, ಒಂದು, ಆರು',
    ml: 'ഒന്ന്, നാല്, നാല്, ഒന്ന്, ആറ്',
    bn: 'এক, চার, চার, এক, ছয়',
    mr: 'एक, चार, चार, एक, सहा',
  },
  '112': {
    en: 'one, one, two',
    ta: 'ஒன்று, ஒன்று, இரண்டு',
    hi: 'एक, एक, दो',
    te: 'ఒకటి, ఒకటి, రెండు',
    kn: 'ಒಂದು, ಒಂದು, ಎರಡು',
    ml: 'ഒന്ന്, ഒന്ന്, രണ്ട്',
    bn: 'এক, এক, দুই',
    mr: 'एक, एक, दोन',
  },
  '1098': {
    en: 'one, zero, nine, eight',
    ta: 'ஒன்று, பூஜ்ஜியம், ஒன்பது, எட்டு',
    hi: 'एक, शून्य, नौ, आठ',
    te: 'ఒకటి, సున్నా, తొమ్మిది, ఎనిమిది',
    kn: 'ಒಂದು, ಸೊನ್ನೆ, ಒಂಬತ್ತು, ಎಂಟು',
    ml: 'ഒന്ന്, പൂജ്യം, ഒൻപത്, എട്ട്',
    bn: 'এক, शून्य, নয়, আট',
    mr: 'एक, शून्य, नऊ, आठ',
  },
};

const BROWSER_LANG_CODES: Record<string, string> = {
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  en: 'en-US',
};

class SpeechEngine {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private energyInterval: any = null;
  private recognition: any = null;
  private isListeningActive = false;
  private isSpeaking = false;
  private bargeInListeners: Set<() => void> = new Set();
  
  // MediaRecorder fallback state for browsers without Web Speech STT
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  /**
   * Registers a barge-in listener (called when user speech begins).
   */
  public onBargeIn(callback: () => void): () => void {
    this.bargeInListeners.add(callback);
    return () => this.bargeInListeners.delete(callback);
  }

  /**
   * Triggers barge-in: avatar immediately ceases vocalizing.
   */
  public triggerBargeIn(): void {
    this.stopSpeaking();
    this.bargeInListeners.forEach((cb) => {
      try {
        cb();
      } catch (_) {}
    });
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  public stopSpeaking(): void {
    this.isSpeaking = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (_) {}
      this.currentAudioElement = null;
    }
    if (this.energyInterval) {
      clearInterval(this.energyInterval);
      this.energyInterval = null;
    }
    this.currentUtterance = null;
  }

  public isSpeakingActive(): boolean {
    return this.isSpeaking || this.currentUtterance !== null || this.currentAudioElement !== null;
  }

  /**
   * Preprocesses text: removes markdown & emojis, replaces helpline numbers digit by digit.
   */
  public sanitizeSpokenText(text: string, lang = 'en'): string {
    if (!text) return '';
    let clean = text
      .replace(/[*_~`#\[\]\(\)<>]|https?:\/\/\S+/g, ' ')
      // Strip emojis
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      );

    // Expand emergency numbers digit by digit
    const langKey = lang in EMERGENCY_DIGIT_MAP['14416'] ? lang : 'en';
    for (const [number, digitDict] of Object.entries(EMERGENCY_DIGIT_MAP)) {
      if (clean.includes(number)) {
        const spokenDigits = digitDict[langKey] || digitDict.en;
        clean = clean.split(number).join(` ${spokenDigits} `);
      }
    }

    return clean.replace(/\s+/g, ' ').trim();
  }

  /**
   * Splits text into sentence chunks for progressive streaming.
   */
  public splitSentences(text: string): string[] {
    const clean = text.trim();
    if (!clean) return [];
    return clean.split(/(?<=[.!?।])\s+/).filter(Boolean);
  }

  /**
   * Speaks text using per-language provider chain:
   * 1. Calls backend /api/voice/tts (checks cache or Sarvam AI).
   * 2. If backend returns base64 audio, plays through HTML5 Audio element.
   * 3. Falls back to browser SpeechSynthesis with sentence-level streaming.
   */
  public async speak(
    text: string,
    lang = 'en',
    opts: SpeechEngineOptions = {}
  ): Promise<void> {
    this.stopSpeaking();
    const clean = this.sanitizeSpokenText(text, lang);
    if (!clean) return;

    // Check backend provider for pre-synthesized or cached audio
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          language: lang,
          voice: opts.voiceName || 'ananya',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audio_base64) {
          // Play returned server audio
          this.playBase64Audio(data.audio_base64, opts);
          return;
        }
      }
    } catch (err) {
      // Backend request failure, seamlessly proceed to Web Speech fallback
    }

    // Client-side Web Speech Synthesis fallback with sentence streaming
    this.speakWithBrowserWebSpeech(clean, lang, opts);
  }

  /**
   * Plays base64 audio and animates mouth energy.
   */
  private playBase64Audio(base64Data: string, opts: SpeechEngineOptions): void {
    const audioUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioUrl);
    this.currentAudioElement = audio;

    audio.onplay = () => {
      opts.onStart?.();
      this.startVisemeEnergyInterval(opts.onEnergy);
    };

    audio.onended = () => {
      this.stopVisemeEnergyInterval(opts.onEnergy);
      this.currentAudioElement = null;
      opts.onEnd?.();
    };

    audio.onerror = (e) => {
      this.stopVisemeEnergyInterval(opts.onEnergy);
      this.currentAudioElement = null;
      opts.onError?.(e);
    };

    audio.play().catch((err) => {
      opts.onError?.(err);
      this.currentAudioElement = null;
    });
  }

  /**
   * Browser SpeechSynthesis with sentence streaming.
   */
  private speakWithBrowserWebSpeech(
    cleanText: string,
    lang: string,
    opts: SpeechEngineOptions
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      opts.onError?.(new Error('Speech synthesis not supported in this browser'));
      return;
    }

    const sentences = this.splitSentences(cleanText);
    if (sentences.length === 0) return;

    let index = 0;

    const speakNextSentence = () => {
      if (index >= sentences.length) {
        this.stopVisemeEnergyInterval(opts.onEnergy);
        this.currentUtterance = null;
        opts.onEnd?.();
        return;
      }

      const sentence = sentences[index++];
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.rate = opts.voiceSpeed ?? 0.95;
      utterance.pitch = opts.pitch ?? 1.02;
      utterance.lang = BROWSER_LANG_CODES[lang] || 'en-US';

      if (opts.voiceName && opts.voiceName !== 'default') {
        const voices = this.getAvailableVoices();
        const match = voices.find((v) => v.name === opts.voiceName);
        if (match) utterance.voice = match;
      }

      utterance.onstart = () => {
        if (index === 1) {
          opts.onStart?.();
          this.startVisemeEnergyInterval(opts.onEnergy);
        }
      };

      utterance.onend = () => {
        speakNextSentence();
      };

      utterance.onerror = (e) => {
        this.stopVisemeEnergyInterval(opts.onEnergy);
        this.currentUtterance = null;
        opts.onError?.(e);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    };

    speakNextSentence();
  }

  private startVisemeEnergyInterval(onEnergy?: (e: number) => void): void {
    if (this.energyInterval) clearInterval(this.energyInterval);
    let phase = 0;
    this.energyInterval = setInterval(() => {
      phase += 0.35;
      const base = Math.sin(phase) * 0.5 + 0.5;
      const jitter = Math.random() * 0.4;
      const energy = Math.min(1.0, Math.max(0.15, base * 0.7 + jitter));
      onEnergy?.(energy);
    }, 120);
  }

  private stopVisemeEnergyInterval(onEnergy?: (e: number) => void): void {
    if (this.energyInterval) {
      clearInterval(this.energyInterval);
      this.energyInterval = null;
    }
    onEnergy?.(0);
  }

  /**
   * Continuous Speech-to-Text with live interim text & server fallback.
   */
  public startListening(
    lang = 'en',
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: any) => void,
    onSpeechDetected?: () => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    this.stopListening();
    this.isListeningActive = true;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = BROWSER_LANG_CODES[lang] || 'en-US';

        rec.onspeechstart = () => {
          this.triggerBargeIn();
          onSpeechDetected?.();
        };

        rec.onsoundstart = () => {
          this.triggerBargeIn();
          onSpeechDetected?.();
        };

        rec.onresult = (event: any) => {
          this.triggerBargeIn();
          onSpeechDetected?.();

          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interimTranscript += res[0].transcript;
            }
          }

          if (interimTranscript) {
            onResult(interimTranscript, false);
          }
          if (finalTranscript) {
            onResult(finalTranscript, true);
          }
        };

        rec.onerror = (event: any) => {
          // 'no-speech' is benign in continuous mode
          if (event.error !== 'no-speech') {
            onError(event.error);
          }
        };

        rec.onend = () => {
          // Restart continuous listening if still active
          if (this.isListeningActive) {
            try {
              rec.start();
            } catch (_) {}
          }
        };

        rec.start();
        this.recognition = rec;

        return () => {
          this.stopListening();
        };
      } catch (err) {
        console.warn('Browser SpeechRecognition error, attempting server fallback:', err);
        return this.startServerSideRecordingFallback(lang, onResult, onError);
      }
    } else {
      // Browser lacks SpeechRecognition, fallback to MediaRecorder + /api/voice/stt
      return this.startServerSideRecordingFallback(lang, onResult, onError);
    }
  }

  /**
   * MediaRecorder fallback for browsers without SpeechRecognition.
   */
  private startServerSideRecordingFallback(
    lang: string,
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: any) => void
  ): () => void {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError(new Error('Audio input not supported in this browser.'));
      return () => {};
    }

    this.recordedChunks = [];
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!this.isListeningActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const recorder = new MediaRecorder(stream);
        this.mediaRecorder = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (this.recordedChunks.length === 0) return;

          const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = reader.result as string;
              const res = await fetch('/api/voice/stt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audio_base64: base64Audio,
                  language: lang,
                  content_type: 'audio/webm',
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.transcript) {
                  onResult(data.transcript, true);
                }
              }
            } catch (postErr) {
              onError(postErr);
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        recorder.start(1000);
      })
      .catch((err) => {
        onError(err);
      });

    return () => {
      this.stopListening();
    };
  }

  public stopListening(): void {
    this.isListeningActive = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
      this.mediaRecorder = null;
    }
  }
}

export const speechEngine = new SpeechEngine();
if (typeof window !== 'undefined') {
  (window as any).speechEngine = speechEngine;
}

