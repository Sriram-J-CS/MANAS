/**
 * MANAS 3D FaceDriver
 * Production-grade facial animation driver for Three.js / R3F humanoid avatars.
 * - ARKit 52 emotion weight maps: neutral, warm_smile, happy, empathetic, concerned, sad, surprised, thinking, encouraging, calm
 * - 15 Oculus visemes lip-sync blending
 * - Natural randomized blink scheduler with realistic eyelid curves
 * - Cursor gaze tracking with micro-saccades
 * - Dynamic mouth weight reduction during speech so visemes cleanly win
 */

import * as THREE from 'three';

export type AvatarEmotion =
  | 'neutral'
  | 'warm_smile'
  | 'happy'
  | 'empathetic'
  | 'concerned'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'encouraging'
  | 'calm';

/**
 * ARKit weight presets for the 10 core emotions
 */
export const EMOTION_PRESETS: Record<AvatarEmotion, Record<string, number>> = {
  neutral: {},

  warm_smile: {
    mouthSmileLeft: 0.38,
    mouthSmileRight: 0.38,
    cheekSquintLeft: 0.22,
    cheekSquintRight: 0.22,
    browInnerUp: 0.12,
  },

  happy: {
    mouthSmileLeft: 0.82,
    mouthSmileRight: 0.82,
    cheekSquintLeft: 0.55,
    cheekSquintRight: 0.55,
    browInnerUp: 0.25,
    eyeSquintLeft: 0.28,
    eyeSquintRight: 0.28,
  },

  empathetic: {
    browInnerUp: 0.60,
    mouthSmileLeft: 0.28,
    mouthSmileRight: 0.28,
    eyeSquintLeft: 0.18,
    eyeSquintRight: 0.18,
    browOuterUpLeft: 0.12,
    browOuterUpRight: 0.12,
  },

  concerned: {
    browDownLeft: 0.42,
    browDownRight: 0.42,
    browInnerUp: 0.55,
    mouthFrownLeft: 0.28,
    mouthFrownRight: 0.28,
    eyeWideLeft: 0.12,
    eyeWideRight: 0.12,
  },

  sad: {
    browInnerUp: 0.72,
    mouthFrownLeft: 0.55,
    mouthFrownRight: 0.55,
    mouthLowerDownLeft: 0.25,
    mouthLowerDownRight: 0.25,
    browDownLeft: 0.20,
    browDownRight: 0.20,
  },

  surprised: {
    jawOpen: 0.45,
    mouthFunnel: 0.30,
    browInnerUp: 0.85,
    browOuterUpLeft: 0.80,
    browOuterUpRight: 0.80,
    eyeWideLeft: 0.75,
    eyeWideRight: 0.75,
  },

  thinking: {
    browDownLeft: 0.32,
    browInnerUp: 0.22,
    mouthPucker: 0.22,
    mouthLeft: 0.25,
    eyeLookUpRight: 0.45,
  },

  encouraging: {
    mouthSmileLeft: 0.65,
    mouthSmileRight: 0.65,
    browInnerUp: 0.35,
    eyeSquintLeft: 0.22,
    eyeSquintRight: 0.22,
    cheekPuff: 0.12,
  },

  calm: {
    mouthSmileLeft: 0.18,
    mouthSmileRight: 0.18,
    browInnerUp: 0.08,
    eyeSquintLeft: 0.10,
    eyeSquintRight: 0.10,
  },
};

/**
 * List of mouth-related blendshapes to suppress during speech
 */
const MOUTH_MORPH_KEYS = new Set([
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight'
]);

export class FaceDriver {
  private targetMesh: THREE.SkinnedMesh | THREE.Mesh | null = null;
  private morphDict: Record<string, number> = {};

  // Current and target weights
  private currentWeights: Map<string, number> = new Map();
  private targetEmotionWeights: Map<string, number> = new Map();
  private targetVisemeWeights: Map<string, number> = new Map();

  // Emotion transition
  private currentEmotion: AvatarEmotion = 'calm';
  private emotionIntensity: number = 1.0;
  private transitionSpeed: number = 8.0; // lerp rate

  // Speaking state
  private isSpeaking: boolean = false;
  private currentVisemeEnergy: number = 0;

  // Blink state
  private blinkTimer: number = 2.5;
  private isBlinking: boolean = false;
  private blinkPhase: number = 0; // 0 to 1
  private blinkDuration: number = 0.24; // 240ms total blink

  // Gaze & micro-saccades
  private cursorGaze: { x: number; y: number } = { x: 0, y: 0 };
  private saccadeOffset: { x: number; y: number } = { x: 0, y: 0 };
  private saccadeTimer: number = 1.8;

  constructor(targetMesh?: THREE.SkinnedMesh | THREE.Mesh) {
    if (targetMesh) {
      this.attachMesh(targetMesh);
    }
    this.setEmotion('calm');
  }

  /**
   * Attaches the target head mesh containing morphTargetDictionary
   */
  public attachMesh(mesh: THREE.SkinnedMesh | THREE.Mesh): void {
    this.targetMesh = mesh;
    this.morphDict = mesh.morphTargetDictionary || {};

    // Initialize all morph influences
    if (!mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences = new Array(Object.keys(this.morphDict).length).fill(0);
    }

    Object.keys(this.morphDict).forEach((name) => {
      this.currentWeights.set(name, 0);
    });
  }

  /**
   * Sets the current emotion with intensity and transition duration
   */
  public setEmotion(name: AvatarEmotion, intensity = 1.0, transitionMs = 400): void {
    this.currentEmotion = name;
    this.emotionIntensity = Math.max(0, Math.min(1.5, intensity));
    this.transitionSpeed = Math.max(2.0, 1000 / Math.max(50, transitionMs));

    const preset = EMOTION_PRESETS[name] || EMOTION_PRESETS.neutral;
    this.targetEmotionWeights.clear();

    Object.entries(preset).forEach(([morphName, weight]) => {
      this.targetEmotionWeights.set(morphName, weight * this.emotionIntensity);
    });
  }

  /**
   * Sets current Oculus / ARKit viseme weights
   */
  public setViseme(weights: Record<string, number>): void {
    this.targetVisemeWeights.clear();
    let totalEnergy = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const clamped = Math.max(0, Math.min(1.0, weight));
      this.targetVisemeWeights.set(key, clamped);
      totalEnergy += clamped;
    });

    this.currentVisemeEnergy = Math.min(1.0, totalEnergy);
    this.isSpeaking = this.currentVisemeEnergy > 0.04;
  }

  /**
   * Updates gaze from mouse/cursor [-1, 1]
   */
  public setGaze(x: number, y: number): void {
    this.cursorGaze.x = Math.max(-1, Math.min(1, x));
    this.cursorGaze.y = Math.max(-1, Math.min(1, y));
  }

  /**
   * Main per-frame update loop
   */
  public update(delta: number): void {
    if (!this.targetMesh || !this.targetMesh.morphTargetInfluences) return;

    const dt = Math.min(0.1, Math.max(0.001, delta));

    // 1. Update Blink Scheduler
    this.updateBlinking(dt);

    // 2. Update Micro-Saccades
    this.updateSaccades(dt);

    // 3. Compute Gaze blendshapes
    const totalGazeX = this.cursorGaze.x * 0.8 + this.saccadeOffset.x;
    const totalGazeY = this.cursorGaze.y * 0.8 + this.saccadeOffset.y;

    const gazeTargets: Record<string, number> = {
      eyeLookDownLeft: totalGazeY < 0 ? -totalGazeY * 0.6 : 0,
      eyeLookDownRight: totalGazeY < 0 ? -totalGazeY * 0.6 : 0,
      eyeLookUpLeft: totalGazeY > 0 ? totalGazeY * 0.6 : 0,
      eyeLookUpRight: totalGazeY > 0 ? totalGazeY * 0.6 : 0,
      eyeLookInLeft: totalGazeX > 0 ? totalGazeX * 0.6 : 0,
      eyeLookOutLeft: totalGazeX < 0 ? -totalGazeX * 0.6 : 0,
      eyeLookInRight: totalGazeX < 0 ? -totalGazeX * 0.6 : 0,
      eyeLookOutRight: totalGazeX > 0 ? totalGazeX * 0.6 : 0,
    };

    // 4. Compute composite target weights for every morph
    // While speaking, reduce mouth-related emotion weights so visemes win cleanly
    const mouthSuppression = this.isSpeaking
      ? Math.max(0, 1.0 - this.currentVisemeEnergy * 0.85)
      : 1.0;

    const influences = this.targetMesh.morphTargetInfluences;

    Object.entries(this.morphDict).forEach(([name, idx]) => {
      let targetWeight = 0;

      // Base emotion contribution
      const emoWeight = this.targetEmotionWeights.get(name) || 0;
      if (MOUTH_MORPH_KEYS.has(name)) {
        targetWeight += emoWeight * mouthSuppression;
      } else {
        targetWeight += emoWeight;
      }

      // Viseme contribution
      const visWeight = this.targetVisemeWeights.get(name) || 0;
      targetWeight += visWeight;

      // Blink contribution
      if (name === 'eyeBlinkLeft' || name === 'eyeBlinkRight') {
        const blinkValue = this.getBlinkWeight();
        targetWeight = Math.max(targetWeight, blinkValue);
      }

      // Gaze contribution
      if (gazeTargets[name] !== undefined) {
        targetWeight += gazeTargets[name];
      }

      targetWeight = Math.max(0, Math.min(1.0, targetWeight));

      // Critically damped smoothing
      const current = this.currentWeights.get(name) || 0;
      // Faster attack for visemes, smooth decay for emotions
      const rate = this.targetVisemeWeights.has(name) ? 24.0 : this.transitionSpeed;
      const smoothed = THREE.MathUtils.lerp(current, targetWeight, 1.0 - Math.exp(-rate * dt));

      this.currentWeights.set(name, smoothed);
      influences[idx] = smoothed;
    });
  }

  /**
   * Blink cycle: rapid closure (80ms), micro hold (20ms), smooth reopen (140ms)
   */
  private updateBlinking(dt: number): void {
    if (this.isBlinking) {
      this.blinkPhase += dt / this.blinkDuration;
      if (this.blinkPhase >= 1.0) {
        this.isBlinking = false;
        this.blinkPhase = 0;
        // Next blink in 2.5 to 5.5 seconds
        this.blinkTimer = 2.5 + Math.random() * 3.0;
      }
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        this.blinkPhase = 0;
      }
    }
  }

  /**
   * Non-linear eyelid velocity curve
   */
  private getBlinkWeight(): number {
    if (!this.isBlinking) return 0;
    const p = this.blinkPhase;
    // 0 to 0.35: fast closing
    if (p < 0.35) {
      return Math.sin((p / 0.35) * (Math.PI / 2));
    }
    // 0.35 to 0.45: hold closed
    if (p < 0.45) {
      return 1.0;
    }
    // 0.45 to 1.0: smooth ease-out reopen
    const reopen = (p - 0.45) / 0.55;
    return 1.0 - Math.sin(reopen * (Math.PI / 2));
  }

  /**
   * Micro-saccades: natural involuntary eye darting
   */
  private updateSaccades(dt: number): void {
    this.saccadeTimer -= dt;
    if (this.saccadeTimer <= 0) {
      this.saccadeTimer = 1.2 + Math.random() * 2.2;
      this.saccadeOffset.x = (Math.random() - 0.5) * 0.12;
      this.saccadeOffset.y = (Math.random() - 0.5) * 0.08;
    }
  }

  public getEmotion(): AvatarEmotion {
    return this.currentEmotion;
  }

  public getSpeaking(): boolean {
    return this.isSpeaking;
  }

  public dispose(): void {
    this.targetMesh = null;
    this.currentWeights.clear();
    this.targetEmotionWeights.clear();
    this.targetVisemeWeights.clear();
  }
}
