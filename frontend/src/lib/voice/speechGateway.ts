/**
 * speechGateway.ts - The Unified Voice Gateway for EmotiCare AI / MANAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point: speak({ text, lang, gender, tone, purpose, ... })
 *
 * Rules:
 * 1. Routing: ALL 8 languages → Sarvam Bulbul v3 via /api/voice/tts.
 *    - ta, te, kn, ml, bn, mr: target_language_code = {lang}-IN (native Indic).
 *    - en, hi: routed to Sarvam (en-IN / hi-IN) using correct companion speaker.
 *    - Browser TTS BANNED for native-6; permitted only as last resort for en/hi.
 * 2. Gender Bug Fix: gender+tone resolved at call-time from localStorage
 *    manas_twin_profile (companion: 'boy'|'girl', voiceTone: 'aarav'|'ananya'|...).
 *    Never rely on stale closure state.
 * 3. Speaker Map (per companion gender, with tone support via /api/voice/tts):
 *    - Uses SARVAM_DEFAULT_SPEAKERS as fallback when tone not set.
 * 4. Script Purity: Rejects text with Latin / digits for the 6 Indic languages.
 * 5. Audio-driven Lip-Sync: all audio routed through shared AudioContext / AnalyserNode.
 * 6. Debug HUD (?voicedebug=1): records lang, gender, tone, speaker, engine, latency.
 */

import { sharedAudioManager } from '../audio/sharedAudioContext';
import { getPreGeneratedAudioPath } from './onboardingVoiceLines';

export type CompanionGender = 'girl' | 'boy' | 'female' | 'male';

export interface SpeakOptions {
  text: string;
  lang: string;
  gender?: CompanionGender;
  tone?: string;           // voice tone key: 'ananya'|'diya'|'meera'|'aarav'|'kabir'|'arjun'
  companion?: string;      // 'girl' | 'boy' — explicit companion override
  engine?: 'sarvam' | 'legacy'; // 'sarvam' (Bulbul v3) or 'legacy' (Chirp 3 HD) for A/B testing
  purpose?: 'onboarding_step' | 'onboarding_greeting' | 'chat_reply' | 'voice_sample' | 'avatar_greeting' | 'breathing' | 'test' | string;
  lineId?: string;
  voiceSpeed?: number;
  speed?: number;
  pitch?: number;
  voice_gender?: string;
  speaking_style?: string;
  voiceName?: string;
  emotion?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onEnergy?: (energy: number) => void;
}

export interface VoiceDebugEntry {
  id: string;
  timestamp: string;
  lang: string;
  bcp47: string;
  engine: 'pregenerated_mp3' | 'sarvam_bulbul_v3' | 'google_chirp3_hd' | 'web_speech' | 'banned_fallback';
  speaker: string;
  companion: string;
  voice_gender: string;
  gender: string;
  tone: string;
  text: string;
  latencyMs: number;
  hasLatin: boolean;
  hasDigits: boolean;
  isWarning: boolean;
  warningReason?: string;
  purpose?: string;
}

// Default Sarvam Bulbul v3 speakers (per companion gender) — matches voice_config.py
export const SARVAM_SPEAKER_MAP: Record<string, { girl: string; boy: string }> = {
  en: { girl: 'ishita', boy: 'ratan' },
  hi: { girl: 'priya',  boy: 'shubh' },
  ta: { girl: 'ishita', boy: 'ratan' },
  te: { girl: 'priya',  boy: 'shubh' },
  kn: { girl: 'ishita', boy: 'shubh' },
  ml: { girl: 'pooja',  boy: 'shubh' },
  bn: { girl: 'roopa',  boy: 'rehan' },
  mr: { girl: 'priya',  boy: 'ratan' },
};

export const NATIVE_6_LANGS = new Set(['ta', 'te', 'kn', 'ml', 'bn', 'mr']);
export const ALL_8_LANGS = new Set(['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr']);

/** Reads companion and voice profile preferences from localStorage at call-time. Never stale. */
export function resolveCompanionFromProfile(): {
  companion: 'boy' | 'girl';
  voiceGender: 'boy' | 'girl';
  voiceTone: string;
  speakingStyle: string;
  voiceSpeed: number;
  replyLength: string;
  voiceFollowsCompanion: boolean;
} {
  try {
    const raw = localStorage.getItem('manas_user_profile_v2') || localStorage.getItem('manas_twin_profile');
    if (raw) {
      const p = JSON.parse(raw);
      const isBoy = (p.companion || p.avatarType || p.gender) === 'boy';
      const companion: 'boy' | 'girl' = isBoy ? 'boy' : 'girl';
      const voiceFollowsCompanion = p.voice_follows_companion ?? p.voiceFollowsCompanion ?? true;
      const rawVg = p.voice_gender || p.voiceGender;
      const voiceGender: 'boy' | 'girl' = voiceFollowsCompanion
        ? companion
        : (rawVg === 'boy' || rawVg === 'male' ? 'boy' : 'girl');
      const voiceTone = (p.voice_tone || p.voiceTone || p.voicePref || (voiceGender === 'boy' ? 'aarav' : 'ananya')).toLowerCase();
      const speakingStyle = p.speaking_style || p.speakingStyle || 'Warm & Caring';
      const voiceSpeed = Number(p.voice_speed || p.voiceSpeed || 1.0);
      const replyLength = p.reply_length || p.replyLength || 'Balanced';
      return { companion, voiceGender, voiceTone, speakingStyle, voiceSpeed, replyLength, voiceFollowsCompanion };
    }
  } catch (_) {}
  return {
    companion: 'girl',
    voiceGender: 'girl',
    voiceTone: 'ananya',
    speakingStyle: 'Warm & Caring',
    voiceSpeed: 1.0,
    replyLength: 'Balanced',
    voiceFollowsCompanion: true,
  };
}

class VoiceDebugStore {
  private entries: VoiceDebugEntry[] = [];
  private listeners: Set<(entries: VoiceDebugEntry[]) => void> = new Set();

  public addEntry(entry: VoiceDebugEntry) {
    this.entries = [entry, ...this.entries.slice(0, 49)];
    this.listeners.forEach((l) => l(this.entries));
  }

  public getEntries(): VoiceDebugEntry[] {
    return this.entries;
  }

  public clear() {
    this.entries = [];
    this.listeners.forEach((l) => l(this.entries));
  }

  public subscribe(listener: (entries: VoiceDebugEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => this.listeners.delete(listener);
  }
}

export const voiceDebugStore = new VoiceDebugStore();

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:audio\/\w+;base64,/, '').trim();
  const binary = window.atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function trimAudioBufferSilence(ctx: AudioContext, buffer: AudioBuffer, threshold = 0.005): AudioBuffer {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  let start = 0;
  let end = length - 1;

  outerStart: for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        start = Math.max(0, i - 128);
        break outerStart;
      }
    }
  }

  outerEnd: for (let i = length - 1; i >= start; i--) {
    for (let c = 0; c < numChannels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        end = Math.min(length - 1, i + 128);
        break outerEnd;
      }
    }
  }

  const trimmedLength = end - start + 1;
  if (trimmedLength <= 0 || trimmedLength === length) {
    return buffer;
  }

  const trimmedBuffer = ctx.createBuffer(numChannels, trimmedLength, buffer.sampleRate);
  for (let c = 0; c < numChannels; c++) {
    trimmedBuffer.copyToChannel(buffer.getChannelData(c).subarray(start, end + 1), c);
  }
  return trimmedBuffer;
}

function normalizeAudioBuffer(buffer: AudioBuffer, targetPeak = 0.88): void {
  const numChannels = buffer.numberOfChannels;
  let maxVal = 0;
  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > maxVal) maxVal = v;
    }
  }

  if (maxVal > 0.01) {
    const gain = Math.min(2.5, targetPeak / maxVal);
    for (let c = 0; c < numChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }
}

class SpeechGateway {
  private currentSessionId = 0;
  private currentAbortController: AbortController | null = null;
  private activeAudios: Set<HTMLAudioElement> = new Set();
  private activeBufferSources: Set<AudioBufferSourceNode> = new Set();
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private analyserRAF: number | null = null;
  private isSpeaking = false;
  private analyserNode: AnalyserNode | null = null;
  private nextScheduledStartTime = 0;
  private lastAnalyserPollTime = 0;

  public isSpeakingActive(): boolean {
    return this.isSpeaking;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public stopSpeaking(): void {
    // 1. Invalidate current session so any pending async callbacks immediately exit
    this.currentSessionId++;

    // 2. Abort any active network requests
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch (_) {}
      this.currentAbortController = null;
    }

    // 3. Halt all active scheduled AudioBuffer sources
    this.activeBufferSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    });
    this.activeBufferSources.clear();
    this.nextScheduledStartTime = 0;

    // 4. Immediately halt, silence, and clean up all active audio elements
    this.activeAudios.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.onended = null;
        audio.onerror = null;
      } catch (_) {}
    });
    this.activeAudios.clear();

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch (_) {}
      this.currentAudio = null;
    }

    // 5. Cancel browser speech synthesis if active
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    this.currentUtterance = null;

    // 6. Cancel analyser loop
    if (this.analyserRAF) {
      cancelAnimationFrame(this.analyserRAF);
      this.analyserRAF = null;
    }
    this.isSpeaking = false;
  }

  /**
   * Main unified entry point.
   * Reads companion gender + voiceTone from localStorage at call-time (never stale).
   */
  public async speak(opts: SpeakOptions): Promise<void> {
    this.stopSpeaking();

    const sessionId = this.currentSessionId;
    const abortCtrl = new AbortController();
    this.currentAbortController = abortCtrl;

    const startTime = performance.now();
    const rawLang = (opts.lang || 'en').toLowerCase().trim();
    const cleanLang = rawLang.split('-')[0];
    const isNative6 = NATIVE_6_LANGS.has(cleanLang);
    const targetBcp47 = `${cleanLang}-IN`;

    // ── Gender + Tone resolution at call-time (never stale) ──────────────────
    // Single source of truth: profile.companion (boy|girl) and profile.voice_gender (defaults to companion)
    const profile = resolveCompanionFromProfile();
    const explicitCompanion = opts.companion?.toLowerCase().trim();
    const companionKey: 'boy' | 'girl' = explicitCompanion
      ? (explicitCompanion === 'boy' || explicitCompanion === 'male' ? 'boy' : 'girl')
      : profile.companion;

    const explicitVoiceGender = opts.gender?.toLowerCase().trim();
    const voiceGenderKey: 'boy' | 'girl' = explicitVoiceGender
      ? (explicitVoiceGender === 'boy' || explicitVoiceGender === 'male' ? 'boy' : 'girl')
      : profile.voiceGender;

    const isBoyVoice = voiceGenderKey === 'boy';
    const resolvedTone = (opts.tone || profile.voiceTone || (isBoyVoice ? 'aarav' : 'ananya')).toLowerCase().trim();

    // Default speaker from map for current voice gender
    const defaultSpeaker = SARVAM_SPEAKER_MAP[cleanLang]?.[voiceGenderKey]
      || (isBoyVoice ? 'ratan' : 'ishita');

    const rawText = opts.text?.trim() || '';
    if (!rawText) {
      opts.onEnd?.();
      return;
    }

    // Script purity check for native-6
    const hasLatin = /[A-Za-z]/.test(rawText);
    const hasDigits = /\d/.test(rawText);
    let isWarning = false;
    let warningReason = '';
    if (isNative6 && (hasLatin || hasDigits)) {
      isWarning = true;
      warningReason = `Text contains ${hasLatin ? 'Latin letters' : ''} ${hasDigits ? 'digits' : ''} for ${cleanLang}! Must be pure native script.`;
      console.warn(`[VOICE GATEWAY WARN] ${warningReason}: "${rawText.slice(0, 80)}"`);
    }

    // Ensure voice master gain is unmuted
    sharedAudioManager.setVoiceMute(false);

    // Check session validity before proceeding
    if (this.currentSessionId !== sessionId || abortCtrl.signal.aborted) {
      return;
    }

    // Step 1: Pre-generated audio (onboarding fixed lines)
    if (opts.lineId) {
      const pregenUrl = getPreGeneratedAudioPath(cleanLang, voiceGenderKey, opts.lineId);
      const played = await this.tryPlayAudioUrl(pregenUrl, opts, {
        lang: cleanLang, bcp47: targetBcp47, engine: 'pregenerated_mp3',
        speaker: defaultSpeaker, companion: companionKey, voice_gender: voiceGenderKey,
        gender: voiceGenderKey, tone: resolvedTone,
        text: rawText, startTime, hasLatin, hasDigits, isWarning, warningReason,
        purpose: opts.purpose,
      }, sessionId);
      if (played || this.currentSessionId !== sessionId) return;
    }

    if (this.currentSessionId !== sessionId || abortCtrl.signal.aborted) {
      return;
    }

    // Step 2: Server-side TTS via /api/voice/tts (ALL 8 languages → Sarvam Bulbul v3)
    try {
      const ttsBody: Record<string, any> = {
        text: rawText,
        language: targetBcp47,
        gender: isBoyVoice ? 'male' : 'female',
        emotion: opts.emotion || 'calm',
        companion: companionKey,
        voice_gender: isBoyVoice ? 'male' : 'female',
        speaking_style: profile.speakingStyle,
        speed: opts.voiceSpeed || profile.voiceSpeed || 1.0,
        pace: opts.voiceSpeed || profile.voiceSpeed || 1.0,
      };
      if (opts.engine) ttsBody.engine = opts.engine;
      // Only pass tone if set — server will use it to pick exact Sarvam speaker
      if (resolvedTone) ttsBody.tone = resolvedTone;
      // Explicit voice override (e.g. voice sample playback)
      if (opts.voiceName) ttsBody.voice = opts.voiceName;

      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ttsBody),
        signal: abortCtrl.signal,
      });

      if (this.currentSessionId !== sessionId || abortCtrl.signal.aborted) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (this.currentSessionId !== sessionId || abortCtrl.signal.aborted) {
          return;
        }

        if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
          const latencyMs = Math.round(performance.now() - startTime);
          const usedSpeaker = data.voice_used || data.speech_metadata?.speaker || defaultSpeaker;
          const engineTag = data.speech_metadata?.engine === 'google_chirp_legacy' || opts.engine === 'legacy'
            ? 'google_chirp3_hd'
            : 'sarvam_bulbul_v3';
          voiceDebugStore.addEntry({
            id: Math.random().toString(36).slice(2),
            timestamp: new Date().toLocaleTimeString(),
            lang: cleanLang,
            bcp47: targetBcp47,
            engine: engineTag,
            speaker: usedSpeaker,
            companion: companionKey,
            voice_gender: voiceGenderKey,
            gender: voiceGenderKey,
            tone: resolvedTone || profile.speakingStyle || '(default)',
            text: rawText,
            latencyMs,
            hasLatin,
            hasDigits,
            isWarning,
            warningReason,
            purpose: opts.purpose,
          });
          console.log(
            `[VOICE GATEWAY] lang=${cleanLang} companion=${companionKey} voice_gender=${voiceGenderKey} tone=${resolvedTone} speaker=${usedSpeaker} latency=${latencyMs}ms chunks=${data.audios.length}`
          );
          await this.playMultiChunkAudio(data.audios, opts, sessionId);
          return;
        } else if (data.audio_base64) {
          const latencyMs = Math.round(performance.now() - startTime);
          const usedSpeaker = data.voice_used || data.speech_metadata?.speaker || defaultSpeaker;
          const engineTag = data.speech_metadata?.engine === 'google_chirp_legacy' || opts.engine === 'legacy'
            ? 'google_chirp3_hd'
            : 'sarvam_bulbul_v3';
          voiceDebugStore.addEntry({
            id: Math.random().toString(36).slice(2),
            timestamp: new Date().toLocaleTimeString(),
            lang: cleanLang,
            bcp47: targetBcp47,
            engine: engineTag,
            speaker: usedSpeaker,
            companion: companionKey,
            voice_gender: voiceGenderKey,
            gender: voiceGenderKey,
            tone: resolvedTone || profile.speakingStyle || '(default)',
            text: rawText,
            latencyMs,
            hasLatin,
            hasDigits,
            isWarning,
            warningReason,
            purpose: opts.purpose,
          });
          console.log(
            `[VOICE GATEWAY] lang=${cleanLang} companion=${companionKey} voice_gender=${voiceGenderKey} tone=${resolvedTone} speaker=${usedSpeaker} latency=${latencyMs}ms`
          );
          await this.playBase64Audio(data.audio_base64, opts, sessionId);
          return;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || this.currentSessionId !== sessionId) {
        return;
      }
      console.warn(`[VOICE GATEWAY] Server TTS fetch failed for ${targetBcp47}:`, err);
    }

    if (this.currentSessionId !== sessionId || abortCtrl.signal.aborted) {
      return;
    }

    // Step 3: Fallback
    // BANNED BROWSER TTS FOR NATIVE 6
    if (isNative6) {
      const latencyMs = Math.round(performance.now() - startTime);
      voiceDebugStore.addEntry({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toLocaleTimeString(),
        lang: cleanLang, bcp47: targetBcp47, engine: 'banned_fallback',
        speaker: 'none (silenced)',
        companion: companionKey,
        voice_gender: voiceGenderKey,
        gender: voiceGenderKey,
        tone: resolvedTone || '(default)',
        text: rawText, latencyMs, hasLatin, hasDigits, isWarning: true,
        warningReason: `Browser TTS BANNED for ${cleanLang}. Showing text without audio.`,
        purpose: opts.purpose,
      });
      console.warn(`[VOICE GATEWAY BAN] Browser speechSynthesis strictly banned for ${cleanLang}.`);
      opts.onEnd?.();
      return;
    }

    // LAST RESORT ONLY FOR ENGLISH & HINDI:
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const latencyMs = Math.round(performance.now() - startTime);
      voiceDebugStore.addEntry({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toLocaleTimeString(),
        lang: cleanLang, bcp47: targetBcp47, engine: 'web_speech',
        speaker: 'browser_system_voice',
        companion: companionKey,
        voice_gender: voiceGenderKey,
        gender: voiceGenderKey,
        tone: resolvedTone || '(default)',
        text: rawText, latencyMs, hasLatin, hasDigits, isWarning: true,
        warningReason: 'Browser SpeechSynthesis used as last resort for en/hi.',
        purpose: opts.purpose,
      });
      this.speakBrowserWebSpeech(rawText, targetBcp47, isBoyVoice, opts, sessionId);
      return;
    }

    opts.onEnd?.();
  }

  /** Attempts to play a pre-generated audio URL via AudioContext. */
  private async tryPlayAudioUrl(url: string, opts: SpeakOptions, debugInfo: any, sessionId: number): Promise<boolean> {
    try {
      const headCheck = await fetch(url, {
        method: 'HEAD',
        signal: this.currentAbortController?.signal,
      });
      if (this.currentSessionId !== sessionId || !headCheck.ok) return false;

      const audio = new Audio(url);
      if (this.currentSessionId !== sessionId) return false;

      this.currentAudio = audio;
      this.activeAudios.add(audio);
      const latencyMs = Math.round(performance.now() - debugInfo.startTime);

      voiceDebugStore.addEntry({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toLocaleTimeString(),
        lang: debugInfo.lang, bcp47: debugInfo.bcp47, engine: 'pregenerated_mp3',
        speaker: `${debugInfo.speaker} (cached mp3)`,
        companion: debugInfo.companion || 'girl',
        voice_gender: debugInfo.voice_gender || 'girl',
        gender: debugInfo.gender,
        tone: debugInfo.tone || '(default)',
        text: debugInfo.text, latencyMs,
        hasLatin: debugInfo.hasLatin, hasDigits: debugInfo.hasDigits,
        isWarning: debugInfo.isWarning, warningReason: debugInfo.warningReason,
        purpose: debugInfo.purpose,
      });

      this.setupAudioPlayback(audio, opts, sessionId);
      if (this.currentSessionId !== sessionId) {
        audio.pause();
        audio.src = '';
        this.activeAudios.delete(audio);
        return false;
      }

      await audio.play();
      if (this.currentSessionId !== sessionId) {
        audio.pause();
        audio.src = '';
        this.activeAudios.delete(audio);
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Plays multi-chunk synthesized audio gaplessly using Web Audio AudioBuffer scheduling. */
  private async playMultiChunkAudio(chunks: string[], opts: SpeakOptions, sessionId: number): Promise<void> {
    if (this.currentSessionId !== sessionId || chunks.length === 0) return;

    try {
      const ctx = sharedAudioManager.getAudioContext();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) {}
      }
      if (this.currentSessionId !== sessionId) return;

      const decodePromises = chunks.map(async (b64) => {
        const arr = base64ToArrayBuffer(b64);
        const decoded = await ctx.decodeAudioData(arr);
        const trimmed = trimAudioBufferSilence(ctx, decoded);
        normalizeAudioBuffer(trimmed);
        return trimmed;
      });

      const buffers = await Promise.all(decodePromises);
      if (this.currentSessionId !== sessionId) return;

      await this.playAudioBufferSequence(buffers, opts, sessionId);
    } catch (err) {
      console.warn('[VOICE GATEWAY] AudioBuffer decoding error, falling back to sequential audio element:', err);
      if (chunks[0]) {
        await this.playBase64Audio(chunks[0], opts, sessionId);
      }
    }
  }

  /** Plays base64 audio through Web Audio AudioBuffer or fallback Audio element. */
  private async playBase64Audio(base64Data: string, opts: SpeakOptions, sessionId: number): Promise<void> {
    if (this.currentSessionId !== sessionId) return;

    try {
      const ctx = sharedAudioManager.getAudioContext();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) {}
      }
      if (this.currentSessionId !== sessionId) return;

      const arr = base64ToArrayBuffer(base64Data);
      const decoded = await ctx.decodeAudioData(arr);
      const trimmed = trimAudioBufferSilence(ctx, decoded);
      normalizeAudioBuffer(trimmed);

      if (this.currentSessionId !== sessionId) return;
      await this.playAudioBufferSequence([trimmed], opts, sessionId);
      return;
    } catch (_) {
      // Graceful fallback to HTML5 Audio element if decodeAudioData fails
    }

    if (this.currentSessionId !== sessionId) return;

    const isMp3 = base64Data.startsWith('//O') || base64Data.startsWith('SUQz') || base64Data.startsWith('/+M');
    const mime = isMp3 ? 'audio/mp3' : 'audio/wav';
    const audioUrl = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Data}`;

    const audio = new Audio(audioUrl);
    if (this.currentSessionId !== sessionId) return;

    this.currentAudio = audio;
    this.activeAudios.add(audio);
    this.setupAudioPlayback(audio, opts, sessionId);

    if (this.currentSessionId !== sessionId) {
      audio.pause();
      audio.src = '';
      this.activeAudios.delete(audio);
      return;
    }

    try {
      await audio.play();
      if (this.currentSessionId !== sessionId) {
        audio.pause();
        audio.src = '';
        this.activeAudios.delete(audio);
      }
    } catch (e) {
      this.activeAudios.delete(audio);
      if (this.currentSessionId === sessionId) {
        this.isSpeaking = false;
        opts.onError?.(e);
        opts.onEnd?.();
      }
    }
  }

  /** Gapless sequential playback of AudioBuffers scheduled on AudioContext.currentTime */
  private async playAudioBufferSequence(
    buffers: AudioBuffer[],
    opts: SpeakOptions,
    sessionId: number
  ): Promise<void> {
    if (this.currentSessionId !== sessionId || buffers.length === 0) return;

    const ctx = sharedAudioManager.getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (_) {}
    }

    if (this.currentSessionId !== sessionId) return;

    this.isSpeaking = true;
    opts.onStart?.();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    analyser.connect(sharedAudioManager.getVoiceMasterGainNode());
    this.analyserNode = analyser;

    // Throttle analyser poller loop to <= 30 Hz (interval >= 33 ms)
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const poll = () => {
      if (!this.isSpeaking || !this.analyserNode || this.currentSessionId !== sessionId) return;
      const now = performance.now();
      if (now - this.lastAnalyserPollTime >= 33) {
        this.lastAnalyserPollTime = now;
        this.analyserNode.getByteFrequencyData(dataArray);
        const len = Math.min(80, dataArray.length);
        let sumSq = 0;
        for (let i = 0; i < len; i++) sumSq += (dataArray[i] / 255) ** 2;
        const rms = Math.sqrt(sumSq / len);
        opts.onEnergy?.(Math.min(1.0, Math.max(0.0, rms * 2.2)));
      }
      this.analyserRAF = requestAnimationFrame(poll);
    };
    this.analyserRAF = requestAnimationFrame(poll);

    // Schedule chunks gaplessly: start = max(now, nextStart)
    const startLeadTime = 0.01;
    this.nextScheduledStartTime = Math.max(ctx.currentTime + startLeadTime, this.nextScheduledStartTime);

    for (let i = 0; i < buffers.length; i++) {
      if (this.currentSessionId !== sessionId) return;
      const buf = buffers[i];
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(analyser);

      const scheduledStart = Math.max(ctx.currentTime + 0.005, this.nextScheduledStartTime);
      source.start(scheduledStart);
      this.nextScheduledStartTime = scheduledStart + buf.duration;
      this.activeBufferSources.add(source);

      const isLast = i === buffers.length - 1;
      source.onended = () => {
        this.activeBufferSources.delete(source);
        if (isLast && this.currentSessionId === sessionId && this.activeBufferSources.size === 0) {
          this.isSpeaking = false;
          opts.onEnergy?.(0);
          opts.onEnd?.();
        }
      };
    }
  }

  /** Connects HTML5 audio element to Web Audio analyser for VRM avatar visemes. */
  private setupAudioPlayback(audio: HTMLAudioElement, opts: SpeakOptions, sessionId: number): void {
    if (this.currentSessionId !== sessionId) return;
    this.isSpeaking = true;
    opts.onStart?.();

    try {
      const ctx = sharedAudioManager.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (ctx.state === 'running') {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(sharedAudioManager.getVoiceMasterGainNode());
        this.analyserNode = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const poll = () => {
          if (!this.isSpeaking || !this.analyserNode || this.currentSessionId !== sessionId) return;
          const now = performance.now();
          if (now - this.lastAnalyserPollTime >= 33) {
            this.lastAnalyserPollTime = now;
            this.analyserNode.getByteFrequencyData(dataArray);
            const len = Math.min(80, dataArray.length);
            let sumSq = 0;
            for (let i = 0; i < len; i++) sumSq += (dataArray[i] / 255) ** 2;
            const rms = Math.sqrt(sumSq / len);
            opts.onEnergy?.(Math.min(1.0, Math.max(0.0, rms * 2.2)));
          }
          this.analyserRAF = requestAnimationFrame(poll);
        };
        this.analyserRAF = requestAnimationFrame(poll);
      }
    } catch (_) {}

    audio.onended = () => {
      this.activeAudios.delete(audio);
      if (this.currentSessionId === sessionId) {
        this.isSpeaking = false;
        opts.onEnergy?.(0);
        opts.onEnd?.();
      }
    };

    audio.onerror = (e) => {
      this.activeAudios.delete(audio);
      if (this.currentSessionId === sessionId) {
        this.isSpeaking = false;
        opts.onEnergy?.(0);
        opts.onError?.(e);
        opts.onEnd?.();
      }
    };
  }

  /** Browser SpeechSynthesis ONLY for en and hi as last resort. */
  private speakBrowserWebSpeech(text: string, bcp47: string, isBoy: boolean, opts: SpeakOptions, sessionId: number): void {
    if (this.currentSessionId !== sessionId) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = bcp47;
    utt.rate = (opts.voiceSpeed ?? 0.95);
    utt.pitch = opts.pitch ?? (isBoy ? 0.85 : 1.15);

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = bcp47.split('-')[0].toLowerCase();
    const matched = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matched) utt.voice = matched;

    utt.onstart = () => {
      if (this.currentSessionId !== sessionId) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
        return;
      }
      this.isSpeaking = true;
      opts.onStart?.();
    };
    utt.onend = () => {
      if (this.currentSessionId === sessionId) {
        this.isSpeaking = false;
        opts.onEnergy?.(0);
        opts.onEnd?.();
      }
    };
    utt.onerror = (e) => {
      if (this.currentSessionId === sessionId) {
        this.isSpeaking = false;
        opts.onEnergy?.(0);
        opts.onError?.(e);
        opts.onEnd?.();
      }
    };

    this.currentUtterance = utt;
    window.speechSynthesis.speak(utt);
  }

  public getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  public isAudioPlaying(): boolean {
    if (this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended && this.currentAudio.currentTime > 0) {
      return true;
    }
    return false;
  }
}

export const speechGateway = new SpeechGateway();
