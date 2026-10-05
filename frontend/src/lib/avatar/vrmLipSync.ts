/**
 * vrmLipSync.ts
 *
 * Real-time Web Audio AnalyserNode formant vowel extractor and damped lip-sync engine
 * for 3D VRM Avatars (@pixiv/three-vrm).
 *
 * Maps audio spectral formants (F1, F2) to standard VRM vowel blendshapes:
 * - aa (open mouth, /a/, /ɑː/)
 * - ih (spread lips, /i/, /ɪ/)
 * - ou (rounded small lips, /uː/, /ʊ/)
 * - ee (wide smile opening, /eɪ/, /ɛ/)
 * - oh (rounded tall opening, /oʊ/, /ɔː/)
 *
 * Operates across all 8 Indian languages (en, ta, hi, te, kn, ml, bn, mr).
 * Uses exponential smoothing and damping to prevent mouth snapping.
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

export class VRMLipSync {
  private freqData: Uint8Array = new Uint8Array(256);
  private currentWeights: VowelWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private targetWeights: VowelWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private dampingSpeed: number = 22; // Natural attack/decay without snapping

  /**
   * Updates lip-sync and applies damped vowel blendshapes to the VRM instance.
   *
   * @param vrm - The active Three-VRM model
   * @param delta - Frame time in seconds
   * @param isSpeaking - Whether speech is currently active
   * @param audioEnergy - Fallback or synthesized RMS energy (0..1)
   * @param analyser - Optional Web Audio AnalyserNode connected to TTS audio
   * @param time - Cumulative elapsed time in seconds for natural cadence
   */
  public update(
    vrm: VRM | null,
    delta: number,
    isSpeaking: boolean,
    audioEnergy: number,
    analyser?: AnalyserNode | null,
    time: number = 0
  ): VowelWeights {
    if (!vrm || !vrm.expressionManager) {
      return this.currentWeights;
    }

    if (!isSpeaking) {
      // Smoothly close mouth to 0
      this.targetWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    } else if (analyser) {
      // 1. Web Audio API AnalyserNode Formant Extraction
      if (this.freqData.length !== analyser.frequencyBinCount) {
        this.freqData = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(this.freqData as any);

      const sampleRate = analyser.context.sampleRate || 44100;
      const binWidth = sampleRate / analyser.fftSize;

      // Frequency bands (Hz):
      // F1_low: 200 - 550 Hz (round vowels: oh, ou)
      // F1_mid: 550 - 1000 Hz (open vowels: aa)
      // F2_high: 1000 - 2400 Hz (front vowels: ih, ee)
      let energyLow = 0;
      let countLow = 0;
      let energyMid = 0;
      let countMid = 0;
      let energyHigh = 0;
      let countHigh = 0;
      let totalEnergy = 0;

      for (let i = 0; i < this.freqData.length; i++) {
        const freq = i * binWidth;
        const val = this.freqData[i] / 255;
        totalEnergy += val;

        if (freq >= 200 && freq < 550) {
          energyLow += val;
          countLow++;
        } else if (freq >= 550 && freq < 1000) {
          energyMid += val;
          countMid++;
        } else if (freq >= 1000 && freq < 2400) {
          energyHigh += val;
          countHigh++;
        }
      }

      const avgLow = countLow > 0 ? energyLow / countLow : 0;
      const avgMid = countMid > 0 ? energyMid / countMid : 0;
      const avgHigh = countHigh > 0 ? energyHigh / countHigh : 0;
      const rms = Math.min(1.0, (totalEnergy / this.freqData.length) * 3.5);

      if (rms > 0.04) {
        // Calculate vowel targets proportional to formant prevalence
        this.targetWeights.aa = THREE.MathUtils.clamp((avgMid * 1.8) * rms, 0, 0.95);
        this.targetWeights.ih = THREE.MathUtils.clamp((avgHigh * 1.6) * rms, 0, 0.7);
        this.targetWeights.oh = THREE.MathUtils.clamp((avgLow * 1.5) * rms, 0, 0.65);
        this.targetWeights.ou = THREE.MathUtils.clamp(((avgLow * 0.7 + avgMid * 0.3) * 1.3) * rms, 0, 0.55);
        this.targetWeights.ee = THREE.MathUtils.clamp((avgHigh * 1.4) * rms, 0, 0.6);
      } else {
        this.targetWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
      }
    } else {
      // 2. Synthesized Syllabic Cadence from Audio Energy (Fallback for Web Speech API)
      const energy = THREE.MathUtils.clamp(audioEnergy, 0, 1);
      if (energy > 0.05) {
        // Natural alternating syllables based on speech rhythm
        const syllabicAA = Math.max(0, Math.sin(time * 13)) * 0.75 + 0.25;
        const syllabicIH = Math.max(0, Math.cos(time * 11 + 0.8)) * 0.5;
        const syllabicOH = Math.max(0, Math.sin(time * 8.5 + 1.5)) * 0.4;
        const syllabicEE = Math.max(0, Math.cos(time * 14.5 + 2.1)) * 0.4;

        this.targetWeights.aa = energy * syllabicAA;
        this.targetWeights.ih = energy * syllabicIH;
        this.targetWeights.oh = energy * syllabicOH;
        this.targetWeights.ou = energy * (syllabicOH * 0.6);
        this.targetWeights.ee = energy * syllabicEE;
      } else {
        this.targetWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
      }
    }

    // 3. Smooth Damping to Prevent Mouth Snapping
    const factor = 1 - Math.exp(-delta * this.dampingSpeed);
    this.currentWeights.aa = THREE.MathUtils.lerp(this.currentWeights.aa, this.targetWeights.aa, factor);
    this.currentWeights.ih = THREE.MathUtils.lerp(this.currentWeights.ih, this.targetWeights.ih, factor);
    this.currentWeights.ou = THREE.MathUtils.lerp(this.currentWeights.ou, this.targetWeights.ou, factor);
    this.currentWeights.ee = THREE.MathUtils.lerp(this.currentWeights.ee, this.targetWeights.ee, factor);
    this.currentWeights.oh = THREE.MathUtils.lerp(this.currentWeights.oh, this.targetWeights.oh, factor);

    // 4. Apply to VRM Expression Manager
    try {
      vrm.expressionManager.setValue('aa', this.currentWeights.aa);
      vrm.expressionManager.setValue('ih', this.currentWeights.ih);
      vrm.expressionManager.setValue('ou', this.currentWeights.ou);
      vrm.expressionManager.setValue('ee', this.currentWeights.ee);
      vrm.expressionManager.setValue('oh', this.currentWeights.oh);
    } catch (_) {
      // In case expression names vary by model specification
    }

    return this.currentWeights;
  }

  public reset(vrm: VRM | null): void {
    this.currentWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.targetWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    if (vrm?.expressionManager) {
      try {
        vrm.expressionManager.setValue('aa', 0);
        vrm.expressionManager.setValue('ih', 0);
        vrm.expressionManager.setValue('ou', 0);
        vrm.expressionManager.setValue('ee', 0);
        vrm.expressionManager.setValue('oh', 0);
      } catch (_) {}
    }
  }
}
