/**
 * speechEngine.ts
 * 
 * Multilingual Speech Synthesis (TTS) & Continuous Speech Recognition (STT) engine for MANAS.
 * 
 * Audio Fix Requirements:
 * 1. Single shared AudioContext: routes base64 audio and AnalyserNode to sharedAudioManager voice master gain.
 * 2. Microphone echo suppression: requests getUserMedia with { echoCancellation: true, noiseSuppression: true, autoGainControl: true }.
 * 3. While TTS is playing, pauses speech recognition, and restarts it 400ms after playback ends.
 * 4. Never triggers barge-in or auto-sends text while bot is speaking.
 * 5. Voice volume and mute controlled via sharedAudioManager (voice is at least 12 dB louder than music).
 */

import { sharedAudioManager } from '../audio/sharedAudioContext';

export interface SpeechEngineOptions {
  voiceSpeed?: number;
  pitch?: number;
  voiceName?: string;
  gender?: 'boy' | 'girl' | 'male' | 'female';
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
    te: 'ఒకటి, సున్నా, తొమ్మిది, ఎనిमिది',
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
  en: 'en-IN',
  'ta-IN': 'ta-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
  'bn-IN': 'bn-IN',
  'mr-IN': 'mr-IN',
  'en-IN': 'en-IN',
  'en-US': 'en-IN',
};

const CLIENT_LOANWORDS: Record<string, Record<string, string>> = {
  ta: { stress: 'ஸ்ட்ரெஸ்', tension: 'டென்ஷன்', relax: 'ரிலாக்ஸ்', anxiety: 'ஆன்ஸைட்டி', doctor: 'டாக்டர்', ok: 'சரி' },
  hi: { stress: 'स्ट्रेस', tension: 'टेंशन', relax: 'रिलैक्स', anxiety: 'एंग्जायटी', doctor: 'डॉक्टर', ok: 'ठीक है' },
  te: { stress: 'స్ట్రెస్', tension: 'టెన్షన్', relax: 'రిలాక్స్', anxiety: 'యాంగ్జైటీ', doctor: 'డాక్టర్', ok: 'సరే' },
  ml: { stress: 'സ്ട്രെസ്സ്', tension: 'ടെൻഷൻ', relax: 'റിലാക്സ്', anxiety: 'ആങ്സൈറ്റി', doctor: 'ഡോക്ടർ', ok: 'ശരി' },
  kn: { stress: 'ಸ್ಟ್ರೆಸ್', tension: 'ಟೆನ್ಷನ್', relax: 'ರಿಲ್ಯಾಕ್ಸ್', anxiety: 'ಆಂಗ್ಸೈಟಿ', doctor: 'ಡಾಕ್ಟರ್', ok: 'ಸರಿ' },
  bn: { stress: 'স্ট্রেস', tension: 'টেনশন', relax: 'রিল্যাক্স', anxiety: 'অ্যাংজাইটি', doctor: 'ডাক্তার', ok: 'ঠিক আছে' },
  mr: { stress: 'स्ट्रेस', tension: 'टेंशन', relax: 'रिलॅक्स', anxiety: 'अँग्झायटी', doctor: 'डॉक्टर', ok: 'ठीक आहे' },
};

class SpeechEngine {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private energyInterval: any = null;
  private recognition: any = null;
  private isListeningActive = false;
  private isPausedForTTS = false;
  private ttsRestartTimer: any = null;
  private isSpeaking = false;
  private bargeInListeners: Set<() => void> = new Set();
  private analyserNode: AnalyserNode | null = null;
  private analyserRAF: number | null = null;
  private currentBlobUrl: string | null = null;

  // Active mic stream with hardware AEC / NS / AGC
  private micStream: MediaStream | null = null;

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
    // Only trigger barge-in if we are actually speaking
    if (this.isSpeakingActive()) {
      this.stopSpeaking();
      this.bargeInListeners.forEach((cb) => {
        try {
          cb();
        } catch (_) {}
      });
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  /**
   * Handles TTS start: pauses speech recognition to prevent mic echo.
   */
  private handleTTSStart(opts: SpeechEngineOptions): void {
    this.isSpeaking = true;
    sharedAudioManager.setDuckingSource('voice', true);

    // Pause speech recognition while TTS is playing to avoid picking up speaker output
    this.pauseRecognitionForTTS();
    opts.onStart?.();
  }

  /**
   * Handles TTS end: schedules speech recognition restart 400ms after playback ends.
   */
  private handleTTSEnd(opts: SpeechEngineOptions): void {
    this.isSpeaking = false;
    sharedAudioManager.setDuckingSource('voice', false);

    if (this.analyserRAF !== null) {
      cancelAnimationFrame(this.analyserRAF);
      this.analyserRAF = null;
    }
    this.stopVisemeEnergyInterval(opts.onEnergy);

    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_) {}
      this.currentBlobUrl = null;
    }
    this.currentAudioElement = null;
    this.currentUtterance = null;

    opts.onEnd?.();

    // Restart speech recognition 400ms after playback ends
    this.scheduleRecognitionRestartAfterTTS();
  }

  private pauseRecognitionForTTS(): void {
    if (this.ttsRestartTimer) {
      clearTimeout(this.ttsRestartTimer);
      this.ttsRestartTimer = null;
    }
    if (this.isListeningActive && this.recognition) {
      this.isPausedForTTS = true;
      try {
        this.recognition.abort();
      } catch (_) {}
    }
  }

  private scheduleRecognitionRestartAfterTTS(): void {
    if (this.ttsRestartTimer) {
      clearTimeout(this.ttsRestartTimer);
      this.ttsRestartTimer = null;
    }
    // Restart exactly 400ms after playback ends
    this.ttsRestartTimer = window.setTimeout(() => {
      this.ttsRestartTimer = null;
      if (this.isListeningActive && this.isPausedForTTS && !this.isSpeaking) {
        this.isPausedForTTS = false;
        try {
          if (this.recognition) {
            this.recognition.start();
          }
        } catch (_) {}
      }
    }, 400);
  }

  public stopSpeaking(): void {
    this.isSpeaking = false;
    sharedAudioManager.setDuckingSource('voice', false);

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
    if (this.analyserRAF !== null) {
      cancelAnimationFrame(this.analyserRAF);
      this.analyserRAF = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (_) {}
      this.analyserNode = null;
    }
    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (_) {}
      this.currentBlobUrl = null;
    }
    if (this.energyInterval) {
      clearInterval(this.energyInterval);
      this.energyInterval = null;
    }
    this.currentUtterance = null;

    // Restart speech recognition 400ms after playback ends
    this.scheduleRecognitionRestartAfterTTS();
  }

  public isSpeakingActive(): boolean {
    return this.isSpeaking || this.currentUtterance !== null || this.currentAudioElement !== null;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.currentAudioElement;
  }

  /**
   * Preprocesses text: removes markdown & emojis, replaces helpline numbers digit by digit.
   */
  public sanitizeSpokenText(text: string, lang = 'en'): string {
    if (!text) return '';
    let clean = text
      .replace(/[*_~`#\[\]\(\)<>]|https?:\/\/\S+/g, ' ')
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      );

    const langKey = lang in EMERGENCY_DIGIT_MAP['14416'] ? lang : 'en';
    for (const [number, digitDict] of Object.entries(EMERGENCY_DIGIT_MAP)) {
      if (clean.includes(number)) {
        const spokenDigits = digitDict[langKey] || digitDict.en;
        clean = clean.split(number).join(` ${spokenDigits} `);
      }
    }

    // Transliterate English loanwords into native script for non-English speech
    const langPrefix = lang.split('-')[0].toLowerCase();
    const loanwords = CLIENT_LOANWORDS[langPrefix];
    if (loanwords) {
      for (const [enW, natW] of Object.entries(loanwords)) {
        clean = clean.replace(new RegExp(`\\b${enW}\\b`, 'gi'), natW);
      }
    }

    return clean.replace(/\s+/g, ' ').trim();
  }

  public splitSentences(text: string): string[] {
    const clean = text.trim();
    if (!clean) return [];
    return clean.split(/(?<=[.!?।])\s+/).filter(Boolean);
  }

  /**
   * Speaks text using per-language provider chain:
   * 1. Calls backend /api/voice/tts with exact BCP-47 language code (checks cache or Chirp 3 HD / Gemini TTS).
   * 2. Falls back smoothly to browser Web Speech API (strictly native voice only).
   */
  public async speak(
    text: string,
    lang = 'en',
    opts: SpeechEngineOptions = {}
  ): Promise<void> {
    this.stopSpeaking();

    // Respect voice mute
    if (sharedAudioManager.getIsVoiceMuted()) {
      opts.onEnd?.();
      return;
    }

    const clean = this.sanitizeSpokenText(text, lang);
    if (!clean) return;

    const targetBcp47 = BROWSER_LANG_CODES[lang] || (lang.includes('-') ? lang : `${lang}-IN`);
    const isBoy = opts.gender === 'boy' || opts.gender === 'male';
    const genderStr = isBoy ? 'male' : 'female';
    const defaultVoice = isBoy ? 'achal' : 'ananya';

    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          language: targetBcp47,
          voice: opts.voiceName || defaultVoice,
          gender: genderStr,
          emotion: 'calm',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audio_base64) {
          this.playBase64Audio(data.audio_base64, opts);
          return;
        }
      }
    } catch (_) {}

    // Fallback: Web Speech API
    this.speakWithBrowserWebSpeech(clean, lang, opts);
  }

  /**
   * Plays base64 audio routed into shared AudioContext voice master gain.
   */
  private playBase64Audio(base64Data: string, opts: SpeechEngineOptions): void {
    const audioUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioUrl);
    if (audioUrl.startsWith('blob:')) {
      this.currentBlobUrl = audioUrl;
    }
    this.currentAudioElement = audio;

    const startWebAudioAnalysis = (): boolean => {
      try {
        const ctx = sharedAudioManager.getAudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        // Connect directly to the voice master gain node
        analyser.connect(sharedAudioManager.getVoiceMasterGainNode());
        this.analyserNode = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const poll = () => {
          if (!this.analyserNode || !this.isSpeaking) return;
          this.analyserNode.getByteFrequencyData(dataArray);
          const len = Math.min(80, dataArray.length);
          let sumSq = 0;
          for (let i = 0; i < len; i++) sumSq += (dataArray[i] / 255) ** 2;
          const rms = Math.sqrt(sumSq / len);
          opts.onEnergy?.(Math.min(1.0, Math.max(0.0, rms * 2.2)));
          this.analyserRAF = requestAnimationFrame(poll);
        };
        this.analyserRAF = requestAnimationFrame(poll);
        return true;
      } catch (_) {
        return false;
      }
    };

    audio.onplay = () => {
      this.handleTTSStart(opts);
      const usedWebAudio = startWebAudioAnalysis();
      if (!usedWebAudio) {
        this.startVisemeEnergyInterval(opts.onEnergy);
      }
    };

    audio.onended = () => {
      this.handleTTSEnd(opts);
    };

    audio.onerror = (e) => {
      this.handleTTSEnd(opts);
      opts.onError?.(e);
    };

    audio.play().catch((err) => {
      this.handleTTSEnd(opts);
      opts.onError?.(err);
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
        this.handleTTSEnd(opts);
        return;
      }

      const sentence = sentences[index++];
      const utterance = new SpeechSynthesisUtterance(sentence);

      // Volume controlled via sharedAudioManager
      if (sharedAudioManager.getIsVoiceMuted()) {
        utterance.volume = 0.0;
      } else {
        utterance.volume = sharedAudioManager.getVoiceVolume();
      }

      const isBoy = opts.gender === 'boy' || opts.gender === 'male';
      const isGirl = opts.gender === 'girl' || opts.gender === 'female';

      if (opts.pitch !== undefined) {
        utterance.pitch = opts.pitch;
      } else if (isBoy) {
        utterance.pitch = 0.82;
      } else if (isGirl) {
        utterance.pitch = 1.18;
      } else {
        utterance.pitch = 1.0;
      }

      utterance.rate = (opts.voiceSpeed ?? 0.95) * (isBoy ? 0.94 : 0.98);

      const targetLang = BROWSER_LANG_CODES[lang] || 'en-US';
      utterance.lang = targetLang;
      const langPrefix = targetLang.split('-')[0].toLowerCase();

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        if (opts.voiceName) {
          const found = voices.find(
            (v) => v.name.toLowerCase() === opts.voiceName!.toLowerCase()
          );
          if (found) utterance.voice = found;
        }

        if (!utterance.voice) {
          const matchingLangVoices = voices.filter((v) => {
            const vLang = v.lang.toLowerCase();
            return vLang.startsWith(langPrefix) || vLang.includes(langPrefix);
          });

          const maleKeywords = [
            'david', 'mark', 'george', 'guy', 'ravi', 'valluvar', 'madhur', 
            'mohan', 'arvind', 'hemant', 'achal', 'arjun', 'karan', 'male', 
            'boy', 'man', 'paul', 'james', 'richard', 'daniel', 'stefan', 
            'neil', 'alex', 'fred', 'bruce', 'sean', 'oliver', 'rishi'
          ];
          const femaleKeywords = [
            'zira', 'jenny', 'heera', 'priya', 'ananya', 'swara', 'kalpana', 
            'shruthi', 'pavithra', 'maitreyi', 'female', 'girl', 'woman', 
            'samantha', 'victoria', 'karen', 'moira', 'tessa', 'veena', 
            'linda', 'susan', 'catherine', 'fiona', 'alice', 'aditi', 'neerja'
          ];

          const isVoiceMatch = (v: SpeechSynthesisVoice, keywords: string[]) => {
            const name = v.name.toLowerCase();
            return keywords.some((k) => name.includes(k));
          };

          // Strictly NEVER speak non-English text with an English voice
          if (matchingLangVoices.length === 0 && langPrefix !== 'en') {
            console.warn(`[SpeechEngine] No native browser voice found for ${targetLang}. Refusing to speak with an English voice.`);
            this.handleTTSEnd(opts);
            return;
          }

          const pool = matchingLangVoices.length > 0 ? matchingLangVoices : voices;
          let matchedVoice: SpeechSynthesisVoice | undefined;

          if (isBoy) {
            matchedVoice = pool.find((v) => isVoiceMatch(v, maleKeywords));
          } else if (isGirl) {
            matchedVoice = pool.find((v) => isVoiceMatch(v, femaleKeywords));
          }

          utterance.voice = matchedVoice || pool[0];
        }
      }

      utterance.onstart = () => {
        if (index === 1) {
          this.handleTTSStart(opts);
          this.startVisemeEnergyInterval(opts.onEnergy);
        }
      };

      utterance.onend = () => {
        speakNextSentence();
      };

      utterance.onerror = (e) => {
        this.handleTTSEnd(opts);
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
   * Continuous Speech-to-Text with hardware echo suppression & server fallback.
   * Requests getUserMedia with { echoCancellation: true, noiseSuppression: true, autoGainControl: true }.
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
    this.isPausedForTTS = false;
    sharedAudioManager.setDuckingSource('mic', true);

    // Hardware Echo Cancellation, Noise Suppression, and AGC Request
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((stream) => {
          this.micStream = stream;
        })
        .catch((err) => {
          console.warn('getUserMedia mic hardware AEC initialization:', err);
        });
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = BROWSER_LANG_CODES[lang] || 'en-US';

        rec.onspeechstart = () => {
          if (this.isSpeaking || this.isPausedForTTS) return;
          onSpeechDetected?.();
        };

        rec.onsoundstart = () => {
          if (this.isSpeaking || this.isPausedForTTS) return;
          onSpeechDetected?.();
        };

        rec.onresult = (event: any) => {
          // Never process or auto-send text that arrives while bot is speaking
          if (this.isSpeaking || this.isPausedForTTS) {
            return;
          }

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
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            onError(event.error);
          }
        };

        rec.onend = () => {
          // Only restart if still active and not paused for TTS
          if (this.isListeningActive && !this.isPausedForTTS && !this.isSpeaking) {
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
      return this.startServerSideRecordingFallback(lang, onResult, onError);
    }
  }

  /**
   * MediaRecorder fallback with hardware AEC constraints for browsers without SpeechRecognition.
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
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        this.micStream = stream;
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
          if (this.recordedChunks.length === 0) return;
          if (this.isSpeaking || this.isPausedForTTS) return;

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
                if (data.transcript && !this.isSpeaking && !this.isPausedForTTS) {
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
    this.isPausedForTTS = false;
    sharedAudioManager.setDuckingSource('mic', false);

    if (this.ttsRestartTimer) {
      clearTimeout(this.ttsRestartTimer);
      this.ttsRestartTimer = null;
    }
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
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.micStream = null;
    }
  }
}

export const speechEngine = new SpeechEngine();
if (typeof window !== 'undefined') {
  (window as any).speechEngine = speechEngine;
}
