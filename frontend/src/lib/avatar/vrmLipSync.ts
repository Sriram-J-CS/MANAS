/**
 * vrmLipSync.ts
 *
 * Real Audio-Driven Lip-Sync Engine for 3D VRM 1.0 Avatars (@pixiv/three-vrm).
 *
 * Rules:
 * 1. REAL AUDIO ONLY:
 *    - Driven ONLY while TTS audio element is actively playing.
 *    - Noise gate with hysteresis: open at -42 dB, close at -48 dB.
 *    - Mouth fully closed (all weights 0) within 120ms after audio ends.
 *    - Zero random or fake mouth movement during idle, listening, or thinking.
 * 2. VOWEL SHAPE FROM AUDIO SPECTRUM:
 *    - Estimates formants: F1 (jaw opening) and F2 (spread vs rounded).
 *    - Maps to VRM presets: aa, ih, ou, ee, oh (shared across Indian languages).
 *    - Normalized total weight <= 0.75.
 *    - Caps: aa <= 0.65 (avoids tongue exposure), ih <= 0.50, ee <= 0.50, ou <= 0.55, oh <= 0.60.
 *    - Smooth filtering: attack ~35ms, release ~80ms at 60fps.
 * 3. SYLLABLE RHYTHM:
 *    - Follows amplitude envelope with natural syllable cadence (4-7 syllables/sec).
 *    - Dips close the mouth on consonants (p/b/m). Never holds the mouth wide open.
 */

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

export interface VowelWeights {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

export const EMPTY_VOWELS: VowelWeights = {
  aa: 0,
  ih: 0,
  ou: 0,
  ee: 0,
  oh: 0,
};

// Weight caps
export const VOWEL_CAPS: Record<keyof VowelWeights, number> = {
  aa: 0.65,
  ih: 0.50,
  ee: 0.50,
  ou: 0.55,
  oh: 0.60,
};

export const MAX_TOTAL_WEIGHT = 0.75;

// Noise gate thresholds (linear amplitude)
const GATE_OPEN_LINEAR = Math.pow(10, -42 / 20); // ~0.00794 (-42 dB)
const GATE_CLOSE_LINEAR = Math.pow(10, -48 / 20); // ~0.00398 (-48 dB)

export class VRMLipSync {
  private freqData: Uint8Array = new Uint8Array(256);
  private timeData: Float32Array = new Float32Array(256);

  private currentWeights: VowelWeights = { ...EMPTY_VOWELS };
  private targetWeights: VowelWeights = { ...EMPTY_VOWELS };

  // Noise gate state
  private isGateOpen: boolean = false;

  // Syllable tracking
  private prevRms: number = 0;
  private smoothedRms: number = 0;
  private silenceTimer: number = 0;

  // Attack (~35ms) & Release (~80ms) speeds
  private attackSpeed: number = 1 / 0.035; // ~28.6 s^-1
  private releaseSpeed: number = 1 / 0.080; // ~12.5 s^-1
  private fastCloseSpeed: number = 1 / 0.040; // Fast decay within 120ms

  /**
   * Resets all vowel weights and closes mouth immediately.
   */
  public reset(vrm?: VRM | null): void {
    this.currentWeights = { ...EMPTY_VOWELS };
    this.targetWeights = { ...EMPTY_VOWELS };
    this.isGateOpen = false;
    this.prevRms = 0;
    this.smoothedRms = 0;
    this.silenceTimer = 1.0;

    if (vrm && vrm.expressionManager) {
      try {
        vrm.expressionManager.setValue('aa', 0);
        vrm.expressionManager.setValue('ih', 0);
        vrm.expressionManager.setValue('ou', 0);
        vrm.expressionManager.setValue('ee', 0);
        vrm.expressionManager.setValue('oh', 0);
      } catch (_) {}
    }
  }

  /**
   * Main per-frame update loop.
   *
   * @param vrm - Active VRM model
   * @param delta - Frame elapsed time in seconds
   * @param isAudioPlaying - Strictly whether the TTS audio element is currently playing sound
   * @param analyser - Web Audio AnalyserNode connected to speech audio
   */
  public update(
    vrm: VRM | null,
    delta: number,
    isAudioPlaying: boolean,
    analyser?: AnalyserNode | null
  ): VowelWeights {
    const dt = Math.max(0.001, Math.min(0.1, delta));

    // If audio is not playing (idle, listening, thinking, paused, ended):
    // Force target weights to 0 and decay swiftly to reach 0 within 120ms.
    if (!isAudioPlaying || !analyser) {
      this.isGateOpen = false;
      this.targetWeights = { ...EMPTY_VOWELS };
      this.silenceTimer += dt;

      // Swift decay to 0 within 120ms
      const decayFactor = 1 - Math.exp(-dt * this.fastCloseSpeed);
      this.currentWeights.aa = THREE.MathUtils.lerp(this.currentWeights.aa, 0, decayFactor);
      this.currentWeights.ih = THREE.MathUtils.lerp(this.currentWeights.ih, 0, decayFactor);
      this.currentWeights.ou = THREE.MathUtils.lerp(this.currentWeights.ou, 0, decayFactor);
      this.currentWeights.ee = THREE.MathUtils.lerp(this.currentWeights.ee, 0, decayFactor);
      this.currentWeights.oh = THREE.MathUtils.lerp(this.currentWeights.oh, 0, decayFactor);

      // Snap to exact 0 below noise floor
      if (this.currentWeights.aa < 0.005) this.currentWeights.aa = 0;
      if (this.currentWeights.ih < 0.005) this.currentWeights.ih = 0;
      if (this.currentWeights.ou < 0.005) this.currentWeights.ou = 0;
      if (this.currentWeights.ee < 0.005) this.currentWeights.ee = 0;
      if (this.currentWeights.oh < 0.005) this.currentWeights.oh = 0;

      this.applyToVRM(vrm);
      return this.currentWeights;
    }

    // 1. Fetch real frequency and time-domain data from AnalyserNode
    if (this.freqData.length !== analyser.frequencyBinCount) {
      this.freqData = new Uint8Array(analyser.frequencyBinCount);
      this.timeData = new Float32Array(analyser.fftSize);
    }
    analyser.getByteFrequencyData(this.freqData as any);
    if (analyser.getFloatTimeDomainData) {
      analyser.getFloatTimeDomainData(this.timeData as any);
    }

    const sampleRate = analyser.context.sampleRate || 44100;
    const computed = this.computeVowelsFromData(this.timeData, this.freqData, sampleRate, dt);

    this.targetWeights = computed;

    // 2. Exponential attack (~35ms) and release (~80ms) smoothing at 60fps
    const smoothFactor = (current: number, target: number) => {
      const speed = target > current ? this.attackSpeed : this.releaseSpeed;
      const alpha = 1 - Math.exp(-dt * speed);
      return THREE.MathUtils.lerp(current, target, alpha);
    };

    this.currentWeights.aa = smoothFactor(this.currentWeights.aa, this.targetWeights.aa);
    this.currentWeights.ih = smoothFactor(this.currentWeights.ih, this.targetWeights.ih);
    this.currentWeights.ou = smoothFactor(this.currentWeights.ou, this.targetWeights.ou);
    this.currentWeights.ee = smoothFactor(this.currentWeights.ee, this.targetWeights.ee);
    this.currentWeights.oh = smoothFactor(this.currentWeights.oh, this.targetWeights.oh);

    this.applyToVRM(vrm);
    return this.currentWeights;
  }

  /**
   * Pure mathematical formant and vowel estimator.
   * Can be tested offline in OfflineAudioContext unit tests.
   */
  public computeVowelsFromData(
    timeData: Float32Array,
    freqData: Uint8Array,
    sampleRate: number,
    dt: number = 0.016
  ): VowelWeights {
    // 1. Calculate RMS from time domain (or fallback from frequency domain)
    let sumSquares = 0;
    if (timeData && timeData.length > 0) {
      for (let i = 0; i < timeData.length; i++) {
        sumSquares += timeData[i] * timeData[i];
      }
    }
    let rms = timeData && timeData.length > 0 ? Math.sqrt(sumSquares / timeData.length) : 0;

    if (rms === 0 && freqData && freqData.length > 0) {
      let freqSum = 0;
      for (let i = 0; i < freqData.length; i++) {
        const v = freqData[i] / 255;
        freqSum += v * v;
      }
      rms = Math.sqrt(freqSum / freqData.length);
    }

    // 2. Noise Gate with Hysteresis:
    // Open threshold: -42 dB (~0.00794)
    // Close threshold: -48 dB (~0.00398)
    if (this.isGateOpen) {
      if (rms < GATE_CLOSE_LINEAR) {
        this.isGateOpen = false;
      }
    } else {
      if (rms > GATE_OPEN_LINEAR) {
        this.isGateOpen = true;
      }
    }

    if (!this.isGateOpen) {
      this.prevRms = rms;
      return { ...EMPTY_VOWELS };
    }

    // 3. Syllable Envelope & Consonant Dip Tracking
    // Smooth RMS over ~100ms window (syllable frequency ~ 4-7 Hz)
    this.smoothedRms = THREE.MathUtils.lerp(this.smoothedRms, rms, 1 - Math.exp(-dt * 15));
    // Dip detection: if RMS drops significantly below smoothed moving average,
    // mouth briefly closes on dips (p/b/m bilabial plosives)
    const isDip = rms < this.smoothedRms * 0.55;
    if (isDip) {
      return { ...EMPTY_VOWELS };
    }

    // 4. Formant Estimation from Spectral Bands
    const binCount = freqData.length;
    const binWidth = (sampleRate / 2) / binCount;

    // Spectral bands for Indian vowel formants:
    // F1 low (250 - 500 Hz): closed / rounded vowels (ou, oh, ih)
    // F1 high (550 - 1100 Hz): open vowels (aa)
    // F2 low (800 - 1400 Hz): back vowels (ou, oh)
    // F2 high (1600 - 2800 Hz): front spread vowels (ee, ih)
    let energyF1Low = 0, countF1Low = 0;
    let energyF1High = 0, countF1High = 0;
    let energyF2Low = 0, countF2Low = 0;
    let energyF2High = 0, countF2High = 0;

    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth;
      const amp = freqData[i] / 255;

      if (freq >= 250 && freq < 500) {
        energyF1Low += amp;
        countF1Low++;
      } else if (freq >= 550 && freq < 1100) {
        energyF1High += amp;
        countF1High++;
      }

      if (freq >= 800 && freq < 1400) {
        energyF2Low += amp;
        countF2Low++;
      } else if (freq >= 1600 && freq < 2800) {
        energyF2High += amp;
        countF2High++;
      }
    }

    const avgF1Low = countF1Low > 0 ? energyF1Low / countF1Low : 0;
    const avgF1High = countF1High > 0 ? energyF1High / countF1High : 0;
    const avgF2Low = countF2Low > 0 ? energyF2Low / countF2Low : 0;
    const avgF2High = countF2High > 0 ? energyF2High / countF2High : 0;

    // Amplitude scaling factor (speech dynamic range)
    const ampGain = Math.min(1.0, Math.max(0, (rms - GATE_OPEN_LINEAR) / 0.12));

    // Map formant energies to Indian language vowels
    // aa: dominant F1 high opening
    let rawAA = avgF1High * 1.5 * ampGain;
    // ee: mid F1 + prominent F2 high spread
    let rawEE = ((avgF1Low * 0.4 + avgF1High * 0.4) + avgF2High * 1.2) * 0.8 * ampGain;
    // ih: closed mouth front spread
    let rawIH = (avgF1Low * 0.6 + avgF2High * 1.0) * 0.7 * ampGain;
    // oh: mid F1 opening + low F2 rounding
    let rawOH = (avgF1High * 0.7 + avgF2Low * 0.9) * 0.75 * ampGain;
    // ou: small closed rounded lips
    let rawOU = (avgF1Low * 1.0 + avgF2Low * 0.8) * 0.7 * ampGain;

    // Tongue protection: if aa is high, blend ih/ee slightly to avoid exposing the tongue
    if (rawAA > 0.45) {
      const blend = (rawAA - 0.45) * 0.25;
      rawIH += blend;
      rawEE += blend * 0.5;
    }

    // Apply individual caps
    rawAA = Math.min(VOWEL_CAPS.aa, rawAA);
    rawIH = Math.min(VOWEL_CAPS.ih, rawIH);
    rawEE = Math.min(VOWEL_CAPS.ee, rawEE);
    rawOU = Math.min(VOWEL_CAPS.ou, rawOU);
    rawOH = Math.min(VOWEL_CAPS.oh, rawOH);

    // Normalize so total sum of weights <= 0.75
    const totalWeight = rawAA + rawIH + rawEE + rawOU + rawOH;
    if (totalWeight > MAX_TOTAL_WEIGHT) {
      const scale = MAX_TOTAL_WEIGHT / totalWeight;
      rawAA *= scale;
      rawIH *= scale;
      rawEE *= scale;
      rawOU *= scale;
      rawOH *= scale;
    }

    this.prevRms = rms;

    return {
      aa: rawAA,
      ih: rawIH,
      ou: rawOU,
      ee: rawEE,
      oh: rawOH,
    };
  }

  /**
   * Applies the current smoothed vowel weights to the VRM model expression manager.
   */
  private applyToVRM(vrm: VRM | null): void {
    if (!vrm || !vrm.expressionManager) return;

    try {
      vrm.expressionManager.setValue('aa', this.currentWeights.aa);
      vrm.expressionManager.setValue('ih', this.currentWeights.ih);
      vrm.expressionManager.setValue('ou', this.currentWeights.ou);
      vrm.expressionManager.setValue('ee', this.currentWeights.ee);
      vrm.expressionManager.setValue('oh', this.currentWeights.oh);
    } catch (_) {}
  }

  public getCurrentWeights(): VowelWeights {
    return { ...this.currentWeights };
  }
}
