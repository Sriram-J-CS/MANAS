/**
 * musicPlayerService.ts
 * 
 * Spotify-style Music Player Service for MANAS.
 * 
 * Audio Fix Requirements:
 * 1. Default to OFF in chat (user can switch on).
 * 2. Volume capped at max -30 dB (scaled via sharedAudioContext).
 * 3. Filtered via 600 Hz lowpass filter in sharedAudioContext.
 * 4. Slow fade-in and slow fade-out (1.5 seconds) on play/pause.
 * 5. Integrated with sharedAudioContext: companion voice is at least 12 dB louder than music.
 * 6. Auto-ducking: ducks music to ~10% in 300ms when voice plays or mic is active;
 *    restores 1.5s after both cease.
 */

import { THERAPEUTIC_TRACKS, type MusicTrack } from './musicTracks';
import { sharedAudioManager } from '../audio/sharedAudioContext';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: MusicTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  userVolume: number;       // 0.0 to 1.0 (set by user)
  effectiveVolume: number;  // Linear gain with -30 dB max and ducking applied
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isDucked: boolean;
  playlist: MusicTrack[];
}

type Listener = (state: PlayerState) => void;

class MusicPlayerService {
  private activeNodes: Array<AudioNode> = [];
  private trackGain: GainNode | null = null;
  private fadeTimeout: any = null;
  private progressInterval: any = null;
  private listeners: Set<Listener> = new Set();

  private state: PlayerState;

  constructor() {
    const savedTrackId = typeof window !== 'undefined' ? localStorage.getItem('manas_music_last_track') : null;
    const savedShuffle = typeof window !== 'undefined' ? localStorage.getItem('manas_music_shuffle') : null;
    const savedRepeat = typeof window !== 'undefined' ? localStorage.getItem('manas_music_repeat') : null;

    const initialTrack = THERAPEUTIC_TRACKS.find((t) => t.id === savedTrackId) || THERAPEUTIC_TRACKS[0];
    const initialVol = sharedAudioManager.getMusicVolume();

    // Default to OFF in chat (isPlaying: false)
    this.state = {
      currentTrack: initialTrack,
      isPlaying: false,
      currentTime: 0,
      duration: initialTrack.duration,
      userVolume: initialVol,
      effectiveVolume: sharedAudioManager.computeMusicTargetGain(),
      isMuted: sharedAudioManager.getIsMusicMuted(),
      isShuffle: savedShuffle === 'true',
      repeatMode: (savedRepeat as RepeatMode) || 'all',
      isDucked: false,
      playlist: [...THERAPEUTIC_TRACKS],
    };

    // Keep synced with sharedAudioManager
    sharedAudioManager.subscribe(() => {
      this.state.userVolume = sharedAudioManager.getMusicVolume();
      this.state.isMuted = sharedAudioManager.getIsMusicMuted();
      this.state.isDucked = sharedAudioManager.getIsDucked();
      this.state.effectiveVolume = sharedAudioManager.computeMusicTargetGain();
      this.notify();
    });
  }

  public getState(): PlayerState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (_) {}
    });
  }

  /**
   * Ducking: delegate to sharedAudioManager.
   * Ducks music to ~10% in 300ms when voice plays or mic is active;
   * restores 1.5s after both cease.
   */
  public setDuckingSource(source: 'voice' | 'mic', active: boolean): void {
    sharedAudioManager.setDuckingSource(source, active);
    this.state.isDucked = sharedAudioManager.getIsDucked();
    this.notify();
  }

  public setAvatarSpeaking(isSpeaking: boolean): void {
    this.setDuckingSource('voice', isSpeaking);
  }

  public setMicListening(isListening: boolean): void {
    this.setDuckingSource('mic', isListening);
  }

  /**
   * Synthesizes therapeutic ambient soundscape in real time.
   * Routed to sharedAudioManager.getMusicDestinationNode() (600 Hz lowpass -> -30 dB master gain).
   */
  private startSynthesis(track: MusicTrack): void {
    this.stopSynthesisImmediate();

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    const ctx = sharedAudioManager.getAudioContext();
    const now = ctx.currentTime;
    const baseFreq = track.audioFreq || 432;
    const chords = track.audioChords || [baseFreq, baseFreq * 1.25, baseFreq * 1.5];

    // Master track envelope for smooth 1.5s fade-in
    const trackEnvelope = ctx.createGain();
    trackEnvelope.gain.setValueAtTime(0.0001, now);
    // Slow fade-in over 1.5 seconds
    trackEnvelope.gain.linearRampToValueAtTime(1.0, now + 1.5);
    trackEnvelope.connect(sharedAudioManager.getMusicDestinationNode());
    this.trackGain = trackEnvelope;
    this.activeNodes.push(trackEnvelope);

    // Create polyphonic harmonic oscillators
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = track.soundType === 'singing_bowl' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Micro-detune for acoustic warmth & lush chorus
      const detuneCents = (idx - 1) * 3 + Math.sin(idx) * 2;
      osc.detune.setValueAtTime(detuneCents, now);

      // Subtle slow harmonic swell LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.08 + idx * 0.03, now); // 12-second slow breath cycle
      lfoGain.gain.setValueAtTime(0.06, now);
      lfo.connect(oscGain.gain);
      lfo.start(now);
      this.activeNodes.push(lfo, lfoGain);

      // Initial gain
      const baseGain = 0.18 / Math.sqrt(chords.length);
      oscGain.gain.setValueAtTime(0.01, now);
      oscGain.gain.linearRampToValueAtTime(baseGain, now + 1.5);

      if (panner) {
        panner.pan.setValueAtTime((idx / (chords.length - 1 || 1)) * 1.2 - 0.6, now);
        osc.connect(panner);
        panner.connect(oscGain);
        this.activeNodes.push(panner);
      } else {
        osc.connect(oscGain);
      }

      oscGain.connect(trackEnvelope);
      osc.start(now);
      this.activeNodes.push(osc, oscGain);
    });

    // Add soft warm pink noise for rain/nature or vinyl warmth
    if (track.soundType === 'nature_rain' || track.soundType === 'lofi_piano' || track.soundType === 'stream') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Lowpass filter for warm calming rain wash
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(track.soundType === 'stream' ? 850 : 520, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.045, now);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(trackEnvelope);
      whiteNoise.start(now);
      this.activeNodes.push(whiteNoise, filter, noiseGain);
    }
  }

  /**
   * Immediate disconnection of nodes without fade (internal cleanup).
   */
  private stopSynthesisImmediate(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    if (this.activeNodes.length > 0) {
      this.activeNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            (node as any).stop();
          }
          node.disconnect();
        } catch (_) {}
      });
      this.activeNodes = [];
    }
    this.trackGain = null;
  }

  /**
   * Slow 1.5s fade-out of synthesis nodes.
   */
  private fadeOutAndStopSynthesis(): void {
    if (this.trackGain) {
      const ctx = sharedAudioManager.getAudioContext();
      const now = ctx.currentTime;
      this.trackGain.gain.cancelScheduledValues(now);
      // Slow fade-out over 1.5 seconds
      this.trackGain.gain.linearRampToValueAtTime(0.0001, now + 1.5);

      this.fadeTimeout = setTimeout(() => {
        this.stopSynthesisImmediate();
      }, 1550);
    } else {
      this.stopSynthesisImmediate();
    }
  }

  public playTrack(track: MusicTrack): void {
    this.state.currentTrack = track;
    this.state.currentTime = 0;
    this.state.duration = track.duration;
    this.state.isPlaying = true;

    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_music_last_track', track.id);
    }

    this.startSynthesis(track);
    this.startProgressTicker();
    this.notify();
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public resume(): void {
    this.state.isPlaying = true;
    this.startSynthesis(this.state.currentTrack);
    this.startProgressTicker();
    this.notify();
  }

  public pause(): void {
    this.state.isPlaying = false;
    this.fadeOutAndStopSynthesis();
    this.stopProgressTicker();
    this.notify();
  }

  public nextTrack(): void {
    const playlist = this.state.playlist;
    if (playlist.length === 0) return;

    let nextIndex = 0;
    if (this.state.isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      const currentIndex = playlist.findIndex((t) => t.id === this.state.currentTrack.id);
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    this.playTrack(playlist[nextIndex]);
  }

  public prevTrack(): void {
    const playlist = this.state.playlist;
    if (playlist.length === 0) return;

    if (this.state.currentTime > 4) {
      this.seek(0);
      return;
    }

    const currentIndex = playlist.findIndex((t) => t.id === this.state.currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    this.playTrack(playlist[prevIndex]);
  }

  public seek(seconds: number): void {
    this.state.currentTime = Math.max(0, Math.min(seconds, this.state.duration));
    this.notify();
  }

  public setVolume(volume: number): void {
    sharedAudioManager.setMusicVolume(volume);
  }

  public toggleMute(): void {
    sharedAudioManager.toggleMusicMute();
  }

  public toggleShuffle(): void {
    this.state.isShuffle = !this.state.isShuffle;
    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_music_shuffle', this.state.isShuffle.toString());
    }
    this.notify();
  }

  public cycleRepeatMode(): void {
    const modes: RepeatMode[] = ['all', 'one', 'off'];
    const currentIdx = modes.indexOf(this.state.repeatMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.state.repeatMode = nextMode;

    if (typeof window !== 'undefined') {
      localStorage.setItem('manas_music_repeat', nextMode);
    }
    this.notify();
  }

  private startProgressTicker(): void {
    this.stopProgressTicker();
    this.progressInterval = setInterval(() => {
      if (this.state.isPlaying) {
        this.state.currentTime += 1;
        if (this.state.currentTime >= this.state.duration) {
          if (this.state.repeatMode === 'one') {
            this.seek(0);
          } else if (this.state.repeatMode === 'all') {
            this.nextTrack();
          } else {
            this.pause();
            this.seek(0);
          }
        }
        this.notify();
      }
    }, 1000);
  }

  private stopProgressTicker(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}

export const musicPlayer = new MusicPlayerService();
if (typeof window !== 'undefined') {
  (window as any).musicPlayer = musicPlayer;
}
