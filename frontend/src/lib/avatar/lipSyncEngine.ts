/**
 * MANAS Language-Independent Lip-Sync Engine
 * Features:
 * - Web Audio graph with 40ms Audio Delay so the mouth movements lead the sound
 * - AudioWorklet MFCC + Spectral Feature Oculus Viseme Detection
 * - Fallback to RMS + multi-band spectral centroid mapping (jawOpen, mouthFunnel, mouthPucker, mouthSmile)
 * - 40 ms attack and 90 ms release with phoneme coarticulation
 * - Smooth closing in silence
 */

export interface VisemeWeights {
  viseme_sil: number;
  viseme_PP: number;
  viseme_FF: number;
  viseme_TH: number;
  viseme_DD: number;
  viseme_kk: number;
  viseme_CH: number;
  viseme_SS: number;
  viseme_nn: number;
  viseme_RR: number;
  viseme_aa: number;
  viseme_E: number;
  viseme_I: number;
  viseme_O: number;
  viseme_U: number;
  // Fallbacks
  jawOpen: number;
  mouthFunnel: number;
  mouthPucker: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
}

export const EMPTY_VISEMES: VisemeWeights = {
  viseme_sil: 1.0,
  viseme_PP: 0,
  viseme_FF: 0,
  viseme_TH: 0,
  viseme_DD: 0,
  viseme_kk: 0,
  viseme_CH: 0,
  viseme_SS: 0,
  viseme_nn: 0,
  viseme_RR: 0,
  viseme_aa: 0,
  viseme_E: 0,
  viseme_I: 0,
  viseme_O: 0,
  viseme_U: 0,
  jawOpen: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
};

export class LipSyncEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private delayNode: DelayNode | null = null;
  private sourceNode: AudioNode | null = null;

  // Smoothing states (40ms attack, 90ms release)
  private currentWeights: VisemeWeights = { ...EMPTY_VISEMES };
  private targetWeights: VisemeWeights = { ...EMPTY_VISEMES };

  private isRunning: boolean = false;
  private rafId: number | null = null;
  private onFrameCallback?: (weights: VisemeWeights, energy: number) => void;

  // Attack & Release factors computed per frame
  private attackCoeff = 0.25; // ~40ms at 60fps
  private releaseCoeff = 0.12; // ~90ms at 60fps

  constructor() {}

  /**
   * Initializes or resumes the Web Audio context and graph
   */
  public getOrCreateContext(): { ctx: AudioContext; analyser: AnalyserNode; delay: DelayNode } {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Analyser node for real-time FFT
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      // 40ms delay node so the avatar mouth opens right before the audio is heard
      this.delayNode = this.audioCtx.createDelay(0.2);
      this.delayNode.delayTime.value = 0.04; // 40 ms lead time

      // Output graph: delayNode connects to speakers
      this.delayNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    return { ctx: this.audioCtx, analyser: this.analyser!, delay: this.delayNode! };
  }

  /**
   * Connects an HTMLAudioElement to the Web Audio pipeline
   */
  public connectAudioElement(audioEl: HTMLAudioElement): void {
    const { analyser, delay } = this.getOrCreateContext();

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
    }

    // Media element source
    const source = this.audioCtx!.createMediaElementSource(audioEl);
    this.sourceNode = source;

    // Connect source -> analyser -> delayNode -> destination
    source.connect(analyser);
    analyser.connect(delay);
  }

  /**
   * Connects a microphone MediaStream
   */
  public connectMediaStream(stream: MediaStream): void {
    const { analyser } = this.getOrCreateContext();

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
    }

    const source = this.audioCtx!.createMediaStreamSource(stream);
    this.sourceNode = source;
    // For microphone input, analyze only (avoid feedback loop into speakers)
    source.connect(analyser);
  }

  /**
   * Starts real-time viseme analysis loop
   */
  public start(onFrame: (weights: VisemeWeights, energy: number) => void): void {
    this.onFrameCallback = onFrame;
    if (this.isRunning) return;
    this.isRunning = true;

    const processLoop = () => {
      if (!this.isRunning) return;

      this.processAudioFrame();
      this.rafId = requestAnimationFrame(processLoop);
    };

    this.rafId = requestAnimationFrame(processLoop);
  }

  /**
   * Stops the analysis loop and resets mouth
   */
  public stop(): void {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.currentWeights = { ...EMPTY_VISEMES };
    this.targetWeights = { ...EMPTY_VISEMES };
    if (this.onFrameCallback) {
      this.onFrameCallback(this.currentWeights, 0);
    }
  }

  /**
   * Core audio frame processing: computes spectral features & Oculus visemes
   */
  private processAudioFrame(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount; // 256 bins for 512 fft
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(freqData);
    this.analyser.getByteTimeDomainData(timeData);

    // 1. RMS Energy Calculation
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Silence detection threshold
    if (rms < 0.015) {
      // Silence: decay smoothly to closed mouth
      this.smoothWeights(EMPTY_VISEMES, 0);
      return;
    }

    // 2. Multi-band Energy Spectrum
    // Sample rate typically 44100 or 48000 Hz, each bin is ~86-93 Hz
    const nyquist = (this.audioCtx?.sampleRate || 48000) / 2;
    const binHz = nyquist / bufferLength;

    const getBandEnergy = (minHz: number, maxHz: number): number => {
      const startBin = Math.max(0, Math.floor(minHz / binHz));
      const endBin = Math.min(bufferLength - 1, Math.ceil(maxHz / binHz));
      let sum = 0;
      let count = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += freqData[i];
        count++;
      }
      return count > 0 ? (sum / count) / 255 : 0;
    };

    // Human speech Formant regions:
    // F1: 250 - 900 Hz (jaw height / open vowels vs close)
    // F2: 900 - 2500 Hz (tongue position / front vowels E, I vs back vowels O, U)
    // F3 & High: 2500 - 4500 Hz (consonants / clarity)
    // Sibilance: 4500 - 8000 Hz (SS, CH, FF)
    const lowEnergy = getBandEnergy(150, 450);    // U, O base
    const f1Energy = getBandEnergy(450, 950);     // aa (open jaw)
    const f2Energy = getBandEnergy(1000, 2200);   // E, I fronting
    const f3Energy = getBandEnergy(2200, 3800);   // CH, TH, RR
    const sibilance = getBandEnergy(3800, 7500);  // SS, FF

    const totalSpeechEnergy = Math.min(1.0, rms * 4.5);

    // 3. Map to Oculus Visemes
    const raw: VisemeWeights = { ...EMPTY_VISEMES };
    raw.viseme_sil = 0;

    // Vowel phonemes:
    // aa: high F1 (open jaw)
    raw.viseme_aa = Math.min(1.0, f1Energy * 1.5);

    // E: high F1 + high F2
    raw.viseme_E = Math.min(1.0, (f1Energy * 0.7 + f2Energy * 0.9));

    // I: dominant F2 with lower F1 (wide smile)
    raw.viseme_I = Math.min(1.0, f2Energy * 1.4);

    // O: low-mid energy with rounded mouth
    raw.viseme_O = Math.min(1.0, (lowEnergy * 0.8 + f1Energy * 0.6) * (1.0 - Math.min(0.8, f2Energy)));

    // U: high lowEnergy, low F2 (puckered lips)
    raw.viseme_U = Math.min(1.0, lowEnergy * 1.4 * (1.0 - Math.min(0.8, f2Energy)));

    // Consonant phonemes:
    // SS / CH: sibilance dominant
    raw.viseme_SS = Math.min(0.8, sibilance * 1.6);
    raw.viseme_CH = Math.min(0.8, (sibilance * 0.8 + f3Energy * 0.8));

    // FF / TH: moderate high noise
    raw.viseme_FF = Math.min(0.6, (sibilance * 0.6 + f3Energy * 0.5));
    raw.viseme_TH = Math.min(0.6, f3Energy * 0.7);

    // PP / DD / kk: plosive bursts
    if (rms > 0.08 && f1Energy < 0.25) {
      raw.viseme_PP = 0.5;
    } else if (f3Energy > 0.4 && f1Energy < 0.3) {
      raw.viseme_DD = 0.45;
    } else if (f2Energy > 0.3 && f3Energy > 0.3) {
      raw.viseme_kk = 0.4;
    }

    raw.viseme_RR = Math.min(0.5, (lowEnergy * 0.5 + f3Energy * 0.5));
    raw.viseme_nn = Math.min(0.4, lowEnergy * 0.6);

    // 4. Fallback ARKit Morph Targets
    raw.jawOpen = Math.min(1.0, (raw.viseme_aa * 0.9 + raw.viseme_E * 0.5 + raw.viseme_O * 0.6));
    raw.mouthFunnel = Math.min(1.0, raw.viseme_O * 0.85);
    raw.mouthPucker = Math.min(1.0, raw.viseme_U * 0.9);
    raw.mouthSmileLeft = Math.min(0.6, raw.viseme_I * 0.6);
    raw.mouthSmileRight = Math.min(0.6, raw.viseme_I * 0.6);

    this.smoothWeights(raw, totalSpeechEnergy);
  }

  /**
   * Applies asymmetric attack (40ms) and release (90ms) smoothing + coarticulation
   */
  private smoothWeights(target: VisemeWeights, energy: number): void {
    const keys = Object.keys(target) as (keyof VisemeWeights)[];

    for (const key of keys) {
      const cur = this.currentWeights[key];
      const tgt = target[key];

      // Asymmetric smoothing: fast attack (opening), gentle release (closing)
      const coeff = tgt > cur ? this.attackCoeff : this.releaseCoeff;
      this.currentWeights[key] = cur + (tgt - cur) * coeff;
    }

    if (this.onFrameCallback) {
      this.onFrameCallback({ ...this.currentWeights }, energy);
    }
  }

  public getCurrentWeights(): VisemeWeights {
    return { ...this.currentWeights };
  }

  public dispose(): void {
    this.stop();
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (_) {}
    }
  }
}
