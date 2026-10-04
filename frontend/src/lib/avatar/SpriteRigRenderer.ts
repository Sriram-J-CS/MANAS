/**
 * SpriteRigRenderer
 * High-performance 2D Canvas Rig implementation of AvatarRenderer.
 * Features:
 * - Full-body Pixar-style cartoon mascot
 * - Dynamic breathing (torso scale anchored at feet)
 * - Natural 2-6s blinking and subtle eye gaze micro-saccades
 * - Audio-driven lip sync (spectral centroid + volume mapping)
 * - 150ms emotion crossfading
 * - 3D cursor perspective tilt with soft studio ground shadow
 * - Gesture crossfades (wave, nod, thumbs-up, guided breathing)
 * - Wardrobe outfit swapping
 * - Reduced motion accessibility support
 */

import type {
  AvatarRenderer,
  AvatarRendererOptions,
  MascotEmotion,
  MascotGesture,
  MouthShape,
  OutfitType,
  MascotGender,
} from './AvatarRenderer';

export class SpriteRigRenderer implements AvatarRenderer {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  // Options & State
  private gender: MascotGender = 'boy';
  private outfit: OutfitType = 'yellow_tshirt';
  private currentEmotion: MascotEmotion = 'neutral';
  private targetEmotion: MascotEmotion = 'neutral';
  private emotionTransitionStart = 0;
  private emotionTransitionDuration = 150; // ms crossfade

  private currentMouth: MouthShape = 'closed_smile';
  private currentGesture: MascotGesture = 'idle';
  private gestureStartTime = 0;

  private isSpeaking = false;
  private isListening = false;
  private reducedMotion = false;
  private enableTilt = true;

  // Lip-sync smoothing
  private smoothedVolume = 0;
  private smoothedSpectral = 0;

  // Perspective Tilt
  private targetTiltX = 0;
  private targetTiltY = 0;
  private currentTiltX = 0;
  private currentTiltY = 0;

  // Always-on life timers
  private nextBlinkTime = 0;
  private blinkDuration = 140; // ms
  private isBlinking = false;
  private breathPhase = 0;
  private swayPhase = 0;

  // Preloaded Image Cache
  private imageCache: Map<string, HTMLImageElement> = new Map();

  async init(container: HTMLElement, options: AvatarRendererOptions = {}): Promise<void> {
    this.container = container;
    this.gender = options.gender || 'boy';
    this.outfit = options.outfit || 'yellow_tshirt';
    this.enableTilt = options.enableTilt ?? true;
    this.reducedMotion = options.reducedMotion ?? (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    // Create & setup canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full object-contain pointer-events-none select-none';
    this.ctx = this.canvas.getContext('2d');
    container.innerHTML = '';
    container.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', this.handleResize);

    // Preload base assets
    await this.preloadAssets();

    this.scheduleNextBlink();
    this.startRenderLoop();

    if (options.onReady) {
      options.onReady();
    }
  }

  private handleResize = () => {
    this.resize();
  };

  private resize() {
    if (!this.container || !this.canvas) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = (rect.width || 400) * dpr;
    this.canvas.height = (rect.height || 600) * dpr;
  }

  private async preloadAssets(): Promise<void> {
    const urls: string[] = [
      // Base approved
      `/avatars/${this.gender}.png`,
      // Emotions
      `/avatars/faces/${this.gender}_face_neutral.png`,
      `/avatars/faces/${this.gender}_face_happy.png`,
      `/avatars/faces/${this.gender}_face_concerned.png`,
      `/avatars/faces/${this.gender}_face_sad.png`,
      `/avatars/faces/${this.gender}_face_surprised.png`,
      `/avatars/faces/${this.gender}_face_blink.png`,
      // Mouths
      `/avatars/faces/${this.gender}_mouth_closed_smile.png`,
      `/avatars/faces/${this.gender}_mouth_wide_open.png`,
      `/avatars/faces/${this.gender}_mouth_wide_smile.png`,
      `/avatars/faces/${this.gender}_mouth_round_o.png`,
      `/avatars/faces/${this.gender}_mouth_small_closed.png`,
      // Gestures
      `/avatars/faces/${this.gender}_gesture_wave.png`,
      `/avatars/faces/${this.gender}_gesture_thumbs_up.png`,
      `/avatars/faces/${this.gender}_gesture_breathe.png`,
      // Outfits
      `/avatars/outfits/${this.gender}_outfit_yellow_tshirt.png`,
      `/avatars/outfits/${this.gender}_outfit_hoodie.png`,
      `/avatars/outfits/${this.gender}_outfit_formal.png`,
      `/avatars/outfits/${this.gender}_outfit_kurta_saree.png`,
      `/avatars/outfits/${this.gender}_outfit_sports.png`,
      `/avatars/outfits/${this.gender}_outfit_pyjamas.png`,
      `/avatars/outfits/${this.gender}_outfit_festive.png`,
    ];

    await Promise.all(
      urls.map((url) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            this.imageCache.set(url, img);
            resolve();
          };
          img.onerror = () => {
            // Graceful fallback to base image if sub-layer is missing
            resolve();
          };
        });
      })
    );
  }

  private scheduleNextBlink() {
    const interval = 2000 + Math.random() * 4000; // 2 to 6 seconds
    this.nextBlinkTime = performance.now() + interval;
  }

  setEmotion(emotion: MascotEmotion, crossfadeMs = 150): void {
    if (this.targetEmotion === emotion) return;
    this.currentEmotion = this.targetEmotion;
    this.targetEmotion = emotion;
    this.emotionTransitionDuration = crossfadeMs;
    this.emotionTransitionStart = performance.now();
  }

  setViseme(mouthShape: MouthShape, energy = 0.5): void {
    this.currentMouth = mouthShape;
    this.smoothedVolume = energy;
  }

  setGesture(gesture: MascotGesture): void {
    this.currentGesture = gesture;
    this.gestureStartTime = performance.now();
    // Auto reset momentary gestures after 2.8s
    if (gesture === 'wave' || gesture === 'thumbs_up' || gesture === 'nod') {
      setTimeout(() => {
        if (this.currentGesture === gesture) {
          this.currentGesture = 'idle';
        }
      }, 2800);
    }
  }

  setOutfit(outfit: OutfitType): void {
    this.outfit = outfit;
  }

  onAudioFrame(volume: number, spectralCentroid: number): void {
    // Smooth input with 0.35 lerp
    this.smoothedVolume = this.smoothedVolume * 0.65 + volume * 0.35;
    this.smoothedSpectral = this.smoothedSpectral * 0.65 + spectralCentroid * 0.35;

    if (this.smoothedVolume > 0.08) {
      this.isSpeaking = true;
      // Spectral feature mapping to phonetic mouth shapes:
      // High centroid (~ s, t, ee, i) -> wide_smile
      // Mid centroid + high volume (~ ah, aa) -> wide_open
      // Low centroid (~ o, u, w) -> round_o
      // Low energy / transition -> small_closed
      if (this.smoothedSpectral > 0.65) {
        this.currentMouth = 'wide_smile';
      } else if (this.smoothedVolume > 0.45) {
        this.currentMouth = 'wide_open';
      } else if (this.smoothedSpectral < 0.35) {
        this.currentMouth = 'round_o';
      } else {
        this.currentMouth = 'small_closed';
      }
    } else {
      this.isSpeaking = false;
      this.currentMouth = 'closed_smile';
    }
  }

  onUserGaze(normalizedX: number, normalizedY: number): void {
    if (!this.enableTilt || this.reducedMotion) return;
    // Normalized [-1, 1], clamp to realistic range
    this.targetTiltX = Math.max(-0.25, Math.min(0.25, normalizedX * 0.2));
    this.targetTiltY = Math.max(-0.2, Math.min(0.2, normalizedY * 0.15));
  }

  setIsListening(listening: boolean): void {
    this.isListening = listening;
  }

  setIsSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
    if (!speaking) {
      this.currentMouth = 'closed_smile';
    }
  }

  private startRenderLoop() {
    const loop = (now: number) => {
      this.renderFrame(now);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private renderFrame(now: number) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Calculate dynamic animation values
    if (!this.reducedMotion) {
      // 1. Blinking state
      if (!this.isBlinking && now >= this.nextBlinkTime) {
        this.isBlinking = true;
      }
      if (this.isBlinking && now >= this.nextBlinkTime + this.blinkDuration) {
        this.isBlinking = false;
        this.scheduleNextBlink();
      }

      // 2. Breathing cycle (torso scale anchor at feet)
      const breathSpeed = this.currentGesture === 'breathe' ? 0.0016 : 0.0024;
      this.breathPhase += breathSpeed * 16;
      // 3. Sway cycle
      this.swayPhase += 0.0012 * 16;

      // 4. Perspective Tilt smoothing (Lerp)
      this.currentTiltX += (this.targetTiltX - this.currentTiltX) * 0.08;
      this.currentTiltY += (this.targetTiltY - this.currentTiltY) * 0.08;
    }

    const breathScaleY = 1.0 + Math.sin(this.breathPhase) * 0.015;
    const breathScaleX = 1.0 - Math.sin(this.breathPhase) * 0.008;
    const headSway = Math.sin(this.swayPhase) * (this.isListening ? 0.04 : 0.015);

    // Nod gesture override
    let nodOffset = 0;
    if (this.currentGesture === 'nod') {
      const elapsed = now - this.gestureStartTime;
      nodOffset = Math.sin(elapsed * 0.012) * 14;
    }

    // Select primary base image
    let baseImg = this.imageCache.get(`/avatars/${this.gender}.png`);
    if (!baseImg) {
      baseImg = this.imageCache.get(`/avatars/default/${this.gender}_base.png`);
    }

    // Check for gesture or outfit override
    if (this.currentGesture === 'wave') {
      const waveImg = this.imageCache.get(`/avatars/faces/${this.gender}_gesture_wave.png`);
      if (waveImg) baseImg = waveImg;
    } else if (this.currentGesture === 'thumbs_up') {
      const thumbsImg = this.imageCache.get(`/avatars/faces/${this.gender}_gesture_thumbs_up.png`);
      if (thumbsImg) baseImg = thumbsImg;
    } else if (this.currentGesture === 'breathe') {
      const breatheImg = this.imageCache.get(`/avatars/faces/${this.gender}_gesture_breathe.png`);
      if (breatheImg) baseImg = breatheImg;
    } else if (this.outfit !== 'yellow_tshirt') {
      const outfitImg = this.imageCache.get(`/avatars/outfits/${this.gender}_outfit_${this.outfit}.png`);
      if (outfitImg) baseImg = outfitImg;
    }

    if (!baseImg || !baseImg.complete) return;

    // Canvas coordinate transforms
    const centerX = width * 0.5;
    const footY = height * 0.92;

    ctx.save();

    // 1. Soft Studio Ground Shadow
    const shadowWidth = width * 0.46;
    const shadowHeight = height * 0.06;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      centerX + this.currentTiltX * 40,
      footY + 8,
      shadowWidth * 0.5 * breathScaleX,
      shadowHeight * 0.5,
      0,
      0,
      Math.PI * 2
    );
    const grad = ctx.createRadialGradient(
      centerX,
      footY + 8,
      5,
      centerX,
      footY + 8,
      shadowWidth * 0.5
    );
    grad.addColorStop(0, 'rgba(60, 48, 38, 0.24)');
    grad.addColorStop(0.6, 'rgba(70, 55, 45, 0.10)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // 2. Anchor transformation at feet for organic breathing & 3D tilt
    ctx.translate(centerX, footY);
    ctx.transform(
      1,
      this.currentTiltY * 0.05,
      this.currentTiltX * 0.05,
      1,
      this.currentTiltX * 25,
      0
    );
    ctx.scale(breathScaleX, breathScaleY);
    ctx.rotate(headSway);

    // 3. Draw Main Character Body
    const imgAspect = baseImg.width / baseImg.height;
    const drawHeight = height * 0.88;
    const drawWidth = drawHeight * imgAspect;
    const drawX = -drawWidth * 0.5;
    const drawY = -drawHeight + nodOffset;

    ctx.drawImage(baseImg, drawX, drawY, drawWidth, drawHeight);

    // 4. Expression / Blinking / Mouth Overlays
    const faceImgKey = this.isBlinking
      ? `/avatars/faces/${this.gender}_face_blink.png`
      : `/avatars/faces/${this.gender}_face_${this.targetEmotion}.png`;

    const mouthImgKey = this.isSpeaking
      ? `/avatars/faces/${this.gender}_mouth_${this.currentMouth}.png`
      : null;

    const overlayImg = mouthImgKey
      ? this.imageCache.get(mouthImgKey)
      : this.imageCache.get(faceImgKey);

    // Emotion Crossfade
    const prevFaceImg = this.imageCache.get(`/avatars/faces/${this.gender}_face_${this.currentEmotion}.png`);
    if (prevFaceImg && prevFaceImg.complete && this.currentEmotion !== this.targetEmotion) {
      const elapsed = now - this.emotionTransitionStart;
      const alpha = Math.min(1.0, elapsed / this.emotionTransitionDuration);
      if (alpha < 1.0) {
        ctx.save();
        ctx.globalAlpha = 1.0 - alpha;
        ctx.drawImage(prevFaceImg, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      }
    }

    if (overlayImg && overlayImg.complete && overlayImg !== baseImg) {
      const elapsed = now - this.emotionTransitionStart;
      const alpha = Math.min(1.0, elapsed / this.emotionTransitionDuration);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(overlayImg, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    }

    ctx.restore();
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.container && this.canvas) {
      this.container.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.imageCache.clear();
  }
}
