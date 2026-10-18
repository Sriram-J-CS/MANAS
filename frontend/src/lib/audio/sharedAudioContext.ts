/**
 * sharedAudioContext.ts
 *
 * Single shared Web Audio API AudioContext for the entire MANAS application.
 *
 * Strict Requirements Met:
 * 1. ONE SHARED AudioContext: All voice and music pipelines share this singleton instance.
 * 2. VOLUME CEILING & LOWPASS: Ambient music is capped at -30 dBFS (≈0.0316 linear gain)
 *    and passed through a warm 600 Hz Butterworth lowpass filter.
 * 3. 12 dB LOUDNESS HEADROOM: Companion voice is guaranteed to be at least 12 dB louder
 *    than music at all times (nominal difference is +30 dB; dynamically clamped if voice is lowered).
 * 4. AUTO-DUCKING: When companion voice plays OR microphone is listening, music gain ducks
 *    to ~10% in 300ms; restored 1.5s after BOTH cease.
 */

// -30 dBFS in linear amplitude: 10^(-30/20) = 10^(-1.5) ≈ 0.0316228
export const MAX_MUSIC_GAIN_LINEAR = Math.pow(10, -30 / 20);

// 12 dB headroom ratio: 10^(12/20) = 10^(0.6) ≈ 3.98107
export const MIN_VOICE_HEADROOM_RATIO = Math.pow(10, 12 / 20);

class SharedAudioManager {
  private audioCtx: AudioContext | null = null;

  // Master Gain Nodes
  private voiceMasterGain: GainNode | null = null;
  private musicMasterGain: GainNode | null = null;
  private musicLowpassFilter: BiquadFilterNode | null = null;

  // Volumes (0.0 to 1.0)
  private voiceUserVolume: number = 1.0;
  private musicUserVolume: number = 0.35;
  private isVoiceMuted: boolean = false;
  private isMusicMuted: boolean = false;

  // Ducking State
  private isVoiceDucking: boolean = false;
  private isMicDucking: boolean = false;
  private isDucked: boolean = false;
  private unduckTimer: any = null;

  // Listeners for UI state reactivity
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedVoiceVol = localStorage.getItem('manas_voice_vol');
      const savedMusicVol = localStorage.getItem('manas_music_vol');
      const savedVoiceMute = localStorage.getItem('manas_voice_muted');
      const savedMusicMute = localStorage.getItem('manas_music_muted');

      if (savedVoiceVol !== null) this.voiceUserVolume = parseFloat(savedVoiceVol);
      if (savedMusicVol !== null) this.musicUserVolume = parseFloat(savedMusicVol);
      if (savedVoiceMute !== null) this.isVoiceMuted = savedVoiceMute === 'true';
      if (savedMusicMute !== null) this.isMusicMuted = savedMusicMute === 'true';
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }

  /**
   * Lazily initializes and returns the single shared AudioContext at fixed 24000 Hz sample rate.
   */
  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        // Fix for Part D: Request fixed sample rate 24000 Hz to match Sarvam Bulbul v3
        this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      } catch (_) {
        this.audioCtx = new AudioCtxClass();
      }
      this.buildAudioGraph();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Constructs the routing graph:
   * Voice: voiceMasterGain -> audioCtx.destination
   * Music: musicLowpassFilter -> musicMasterGain -> audioCtx.destination
   */
  private buildAudioGraph(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    // 1. Voice Master Gain (0 dBFS nominal ceiling)
    this.voiceMasterGain = ctx.createGain();
    this.voiceMasterGain.gain.setValueAtTime(this.computeVoiceTargetGain(), ctx.currentTime);
    this.voiceMasterGain.connect(ctx.destination);

    // 2. Music Lowpass Filter (Warm, gentle 600 Hz cutoff)
    this.musicLowpassFilter = ctx.createBiquadFilter();
    this.musicLowpassFilter.type = 'lowpass';
    this.musicLowpassFilter.frequency.setValueAtTime(600, ctx.currentTime);
    this.musicLowpassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

    // 3. Music Master Gain (Max -30 dBFS ceiling with ducking support)
    this.musicMasterGain = ctx.createGain();
    this.musicMasterGain.gain.setValueAtTime(this.computeMusicTargetGain(), ctx.currentTime);

    this.musicLowpassFilter.connect(this.musicMasterGain);
    this.musicMasterGain.connect(ctx.destination);
  }

  public getVoiceMasterGainNode(): GainNode {
    this.getAudioContext();
    return this.voiceMasterGain!;
  }

  public getMusicDestinationNode(): AudioNode {
    this.getAudioContext();
    // Route music sources through the lowpass filter
    return this.musicLowpassFilter!;
  }

  public getMusicMasterGainNode(): GainNode {
    this.getAudioContext();
    return this.musicMasterGain!;
  }

  /**
   * Computes voice gain: nominal 0 dBFS (1.0).
   */
  private computeVoiceTargetGain(): number {
    if (this.isVoiceMuted) return 0.0;
    return Math.max(0.0, Math.min(1.0, this.voiceUserVolume));
  }

  /**
   * Computes music target gain:
   * 1. Clamped to -30 dBFS (MAX_MUSIC_GAIN_LINEAR = 0.03162).
   * 2. Guaranteed companion voice is at least 12 dB louder (MIN_VOICE_HEADROOM_RATIO = 3.981).
   * 3. Ducked down to ~10% when voice or mic is active.
   */
  public computeMusicTargetGain(): number {
    if (this.isMusicMuted) return 0.0;

    // Base gain mapped from user volume [0, 1] to [0, MAX_MUSIC_GAIN_LINEAR]
    let target = this.musicUserVolume * MAX_MUSIC_GAIN_LINEAR;

    // Enforce 12 dB loudness headroom relative to companion voice:
    // When voice is active and unmuted, voiceGain must be >= 12 dB louder than musicGain
    const currentVoiceGain = this.computeVoiceTargetGain();
    if (!this.isVoiceMuted && currentVoiceGain > 0.001) {
      const allowedMaxFor12dBHeadroom = currentVoiceGain / MIN_VOICE_HEADROOM_RATIO;
      if (target > allowedMaxFor12dBHeadroom) {
        target = allowedMaxFor12dBHeadroom;
      }
    }

    // Auto-ducking: if ducked, reduce to ~10% of nominal gain
    if (this.isDucked) {
      target = target * 0.10;
    }

    return target;
  }

  /**
   * Smoothly ramps the music gain to target.
   */
  public applyMusicVolumeRamp(rampDurationMs = 300): void {
    if (!this.musicMasterGain || !this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const target = this.computeMusicTargetGain();

    this.musicMasterGain.gain.cancelScheduledValues(now);
    // Linear ramp for predictable transition timing
    this.musicMasterGain.gain.linearRampToValueAtTime(target, now + rampDurationMs / 1000);
    this.notify();
  }

  /**
   * Smoothly ramps the voice gain.
   */
  public applyVoiceVolumeRamp(rampDurationMs = 150): void {
    if (!this.voiceMasterGain || !this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const target = this.computeVoiceTargetGain();

    this.voiceMasterGain.gain.cancelScheduledValues(now);
    this.voiceMasterGain.gain.linearRampToValueAtTime(target, now + rampDurationMs / 1000);

    // Re-verify music headroom if voice volume lowered
    this.applyMusicVolumeRamp(rampDurationMs);
    this.notify();
  }

  // ==========================================
  // Auto-Ducking Logic (Voice & Mic)
  // ==========================================

  /**
   * Sets ducking trigger from voice or microphone.
   * Ducks music to ~10% in 300ms.
   * Restores music 1.5s after BOTH voice and mic cease.
   */
  public setDuckingSource(source: 'voice' | 'mic', active: boolean): void {
    if (source === 'voice') {
      this.isVoiceDucking = active;
    } else {
      this.isMicDucking = active;
    }

    const shouldDuck = this.isVoiceDucking || this.isMicDucking;

    if (shouldDuck) {
      // Clear any pending unduck timer
      if (this.unduckTimer) {
        clearTimeout(this.unduckTimer);
        this.unduckTimer = null;
      }

      if (!this.isDucked) {
        this.isDucked = true;
        // Duck music to ~10% in 300ms
        this.applyMusicVolumeRamp(300);
      }
    } else {
      // Both voice and mic are inactive: schedule unduck after 1.5s
      if (this.isDucked && !this.unduckTimer) {
        this.unduckTimer = setTimeout(() => {
          this.unduckTimer = null;
          // Check that neither source reactivated during the 1.5s window
          if (!this.isVoiceDucking && !this.isMicDucking) {
            this.isDucked = false;
            // Restore smoothly over 500ms
            this.applyMusicVolumeRamp(500);
          }
        }, 1500); // 1.5 seconds restore delay
      }
    }
  }

  // ==========================================
  // Controls: Voice & Music Volumes
  // ==========================================

  public setVoiceVolume(vol: number): void {
    const clean = Math.max(0, Math.min(1, vol));
    this.voiceUserVolume = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_voice_vol', clean.toString());
    }
    this.applyVoiceVolumeRamp(150);
  }

  public getVoiceVolume(): number {
    return this.voiceUserVolume;
  }

  public setVoiceMute(muted: boolean): void {
    this.isVoiceMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_voice_muted', muted.toString());
    }
    this.applyVoiceVolumeRamp(100);
  }

  public toggleVoiceMute(): void {
    this.setVoiceMute(!this.isVoiceMuted);
  }

  public getIsVoiceMuted(): boolean {
    return this.isVoiceMuted;
  }

  public setMusicVolume(vol: number): void {
    const clean = Math.max(0, Math.min(1, vol));
    this.musicUserVolume = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_music_vol', clean.toString());
    }
    this.applyMusicVolumeRamp(150);
  }

  public getMusicVolume(): number {
    return this.musicUserVolume;
  }

  public setMusicMute(muted: boolean): void {
    this.isMusicMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_music_muted', muted.toString());
    }
    this.applyMusicVolumeRamp(150);
  }

  public toggleMusicMute(): void {
    this.setMusicMute(!this.isMusicMuted);
  }

  public getIsMusicMuted(): boolean {
    return this.isMusicMuted;
  }

  public getIsDucked(): boolean {
    return this.isDucked;
  }
}

export const sharedAudioManager = new SharedAudioManager();
export const getSharedAudioContext = (): AudioContext => sharedAudioManager.getAudioContext();
