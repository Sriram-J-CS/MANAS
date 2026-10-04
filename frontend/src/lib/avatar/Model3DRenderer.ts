/**
 * Model3DRenderer
 * Full Three.js 3D GLB Model Renderer implementing AvatarRenderer.
 * 
 * Features:
 * - Loads rigged GLB avatars from /avatars/${gender}.glb with fallback to /avatars/${gender}/${gender}.glb.
 * - ARKit blendshapes morph target mapping (jawOpen, mouthSmile, eyeBlink, browInnerUp, mouthPucker).
 * - Real-time audio-driven lip-sync with volume & spectral centroid modulation.
 * - Dynamic breathing, micro-sway, automated human-like blinking.
 * - Cursor gaze tracking (smooth head and neck perspective tilt).
 * - Gestures: wave, nod, thumbs-up, guided breathing.
 * - Seamless studio stage backdrop with soft radial ground contact shadow.
 * - Graceful fallback to SpriteRigRenderer if WebGL or GLB loading encounters errors.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  AvatarRenderer,
  AvatarRendererOptions,
  MascotEmotion,
  MascotGesture,
  MouthShape,
  OutfitType,
  MascotGender,
} from './AvatarRenderer';
import { SpriteRigRenderer } from './SpriteRigRenderer';

export class Model3DRenderer implements AvatarRenderer {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;

  // 3D Objects & Bones
  private avatarGroup: THREE.Group | null = null;
  private headBone: THREE.Object3D | null = null;
  private neckBone: THREE.Object3D | null = null;
  private rightArmBone: THREE.Object3D | null = null;
  private rightForearmBone: THREE.Object3D | null = null;
  private morphMeshes: THREE.Mesh[] = [];

  // Options & State
  private gender: MascotGender = 'boy';
  private outfit: OutfitType = 'yellow_tshirt';
  private currentEmotion: MascotEmotion = 'neutral';
  private currentGesture: MascotGesture = 'idle';
  private gestureStartTime = 0;
  private isSpeaking = false;
  private isListening = false;
  private enableTilt = true;
  private reducedMotion = false;

  // Gaze tilt
  private targetTiltX = 0;
  private targetTiltY = 0;
  private currentTiltX = 0;
  private currentTiltY = 0;

  // Audio Lip-sync
  private targetJawOpen = 0;
  private currentJawOpen = 0;
  private targetMouthWidth = 0;
  private currentMouthWidth = 0;

  // Blinking
  private nextBlinkTime = 0;
  private isBlinking = false;
  private blinkProgress = 0;

  // Fallback 2D renderer in case 3D GLB is missing or unsupported
  private fallbackRenderer: SpriteRigRenderer | null = null;
  private isUsingFallback = false;

  async init(container: HTMLElement, options: AvatarRendererOptions = {}): Promise<void> {
    this.container = container;
    this.gender = options.gender || 'boy';
    this.outfit = options.outfit || 'yellow_tshirt';
    this.enableTilt = options.enableTilt ?? true;
    this.reducedMotion = options.reducedMotion ?? false;

    // Check if WebGL is supported
    if (!this.isWebGLAvailable()) {
      console.warn('[Model3DRenderer] WebGL not available, falling back to SpriteRigRenderer');
      return this.initFallback(container, options);
    }

    try {
      this.setupThreeScene(container);
      await this.loadAvatarGLB(options);
      this.scheduleNextBlink();
      this.startRenderLoop();
      options.onReady?.();
    } catch (err) {
      console.warn('[Model3DRenderer] Failed to load 3D GLB, falling back to SpriteRigRenderer:', err);
      this.initFallback(container, options);
    }
  }

  private isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (_) {
      return false;
    }
  }

  private initFallback(container: HTMLElement, options: AvatarRendererOptions): void {
    this.isUsingFallback = true;
    this.fallbackRenderer = new SpriteRigRenderer();
    this.fallbackRenderer.init(container, options);
  }

  private setupThreeScene(container: HTMLElement): void {
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;

    // Scene with transparent background to match warm stage
    this.scene = new THREE.Scene();

    // Camera framed on upper torso & head
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    this.camera.position.set(0, 1.35, 2.4);
    this.camera.lookAt(0, 1.25, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'w-full h-full object-contain pointer-events-none select-none';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    // Warm stage lighting setup (matches warm cream studio theme)
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.4);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 1.6);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.8);
    fillLight.position.set(-2.5, 2.5, 2.0);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.7);
    rimLight.position.set(0, 3.5, -2.5);
    this.scene.add(rimLight);

    // Soft Studio Ground Shadow Disc under mascot feet
    const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const canvasShadow = document.createElement('canvas');
    canvasShadow.width = 128;
    canvasShadow.height = 128;
    const ctx = canvasShadow.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
      gradient.addColorStop(0, 'rgba(10, 10, 10, 0.28)');
      gradient.addColorStop(0.4, 'rgba(10, 10, 10, 0.12)');
      gradient.addColorStop(1, 'rgba(10, 10, 10, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(canvasShadow);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.set(0, 0.01, 0);
    this.scene.add(groundShadow);

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private async loadAvatarGLB(options: AvatarRendererOptions): Promise<void> {
    const loader = new GLTFLoader();
    const candidateUrls = [
      `/avatars/${this.gender}.glb`,
      `/avatars/${this.gender}/${this.gender}.glb`,
      options.baseAssetPath ? `${options.baseAssetPath}/${this.gender}.glb` : '',
    ].filter(Boolean);

    let loadedGltf: any = null;
    let lastError: any = null;

    for (const url of candidateUrls) {
      try {
        loadedGltf = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        if (loadedGltf) break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!loadedGltf) {
      throw lastError || new Error('No 3D GLB model found');
    }

    const model = loadedGltf.scene;
    this.avatarGroup = model;
    model.position.set(0, 0, 0);
    model.scale.set(1.0, 1.0, 1.0);

    // Traverse and catalog blendshapes & bones
    this.morphMeshes = [];
    model.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.morphTargetDictionary && node.morphTargetInfluences) {
          this.morphMeshes.push(node);
        }
      }

      // Identify key skeleton bones for tilt and gestures
      const name = (node.name || '').toLowerCase();
      if (!this.headBone && (name.includes('head') || name.includes('bip_head'))) {
        this.headBone = node;
      } else if (!this.neckBone && (name.includes('neck') || name.includes('bip_neck'))) {
        this.neckBone = node;
      } else if (!this.rightArmBone && (name.includes('rightarm') || name.includes('arm_r') || name.includes('shoulder_r'))) {
        this.rightArmBone = node;
      } else if (!this.rightForearmBone && (name.includes('rightforearm') || name.includes('forearm_r') || name.includes('elbow_r'))) {
        this.rightForearmBone = node;
      }
    });

    this.scene?.add(model);
  }

  private scheduleNextBlink(): void {
    // Human-like natural blinking every 2.4 - 5.2 seconds
    const delay = 2400 + Math.random() * 2800;
    setTimeout(() => {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }, delay);
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.avatarGroup) return;

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Natural Breathing & Micro-sway
    if (!this.reducedMotion) {
      const breathPhase = Math.sin(elapsedTime * 1.8);
      this.avatarGroup.position.y = breathPhase * 0.008;

      const swayPhase = Math.sin(elapsedTime * 0.9);
      this.avatarGroup.rotation.z = swayPhase * 0.006;
    }

    // 2. Cursor Gaze Tilt with smooth damping
    if (this.enableTilt && !this.reducedMotion) {
      this.currentTiltX += (this.targetTiltX - this.currentTiltX) * 0.08;
      this.currentTiltY += (this.targetTiltY - this.currentTiltY) * 0.08;

      if (this.headBone) {
        this.headBone.rotation.y = this.currentTiltX * 0.35;
        this.headBone.rotation.x = -this.currentTiltY * 0.22;
      } else {
        this.avatarGroup.rotation.y = this.currentTiltX * 0.25;
        this.avatarGroup.rotation.x = -this.currentTiltY * 0.15;
      }
    }

    // 3. Automated Natural Blinking (140ms duration)
    let blinkWeight = 0;
    if (this.isBlinking) {
      this.blinkProgress += delta * 7.5; // ~133ms full close-and-open
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.scheduleNextBlink();
      } else {
        blinkWeight = Math.sin(this.blinkProgress * Math.PI);
      }
    }

    // 4. Audio Lip-sync Smooth Interpolation
    this.currentJawOpen += (this.targetJawOpen - this.currentJawOpen) * 0.28;
    this.currentMouthWidth += (this.targetMouthWidth - this.currentMouthWidth) * 0.25;

    // Apply Blendshapes to all registered morph meshes
    this.applyBlendshapes(blinkWeight);

    // 5. Procedural Gestures (Wave, Nod, Thumbs Up, Guided Breathing)
    this.applyGestureAnimation(elapsedTime);

    this.renderer.render(this.scene, this.camera);
  }

  private applyBlendshapes(blinkWeight: number): void {
    for (const mesh of this.morphMeshes) {
      const dict = (mesh as any).morphTargetDictionary;
      const influences = (mesh as any).morphTargetInfluences;
      if (!dict || !influences) continue;

      const setMorph = (targetNames: string[], weight: number) => {
        for (const name of targetNames) {
          const idx = dict[name];
          if (idx !== undefined) {
            influences[idx] = THREE.MathUtils.clamp(weight, 0, 1);
          }
        }
      };

      // Blinking
      setMorph(['eyeBlinkLeft', 'eyeBlink_L', 'blink_left', 'eye_blink_left'], blinkWeight);
      setMorph(['eyeBlinkRight', 'eyeBlink_R', 'blink_right', 'eye_blink_right'], blinkWeight);

      // Lip-sync: Jaw Opening & Mouth Shapes
      setMorph(['jawOpen', 'mouthOpen', 'viseme_aa', 'jaw_open'], this.currentJawOpen);
      setMorph(['mouthSmileLeft', 'mouthSmile_L', 'smile_left'], this.currentEmotion === 'happy' ? 0.75 : this.currentMouthWidth);
      setMorph(['mouthSmileRight', 'mouthSmile_R', 'smile_right'], this.currentEmotion === 'happy' ? 0.75 : this.currentMouthWidth);

      // Emotion Blendshapes
      if (this.currentEmotion === 'concerned' || this.currentEmotion === 'sad') {
        setMorph(['browInnerUp', 'brow_inner_up'], 0.65);
        setMorph(['mouthFrownLeft', 'mouthFrown_L'], 0.45);
        setMorph(['mouthFrownRight', 'mouthFrown_R'], 0.45);
      } else if (this.currentEmotion === 'surprised') {
        setMorph(['browInnerUp', 'brow_inner_up'], 0.85);
        setMorph(['jawOpen', 'jaw_open'], Math.max(0.4, this.currentJawOpen));
      }
    }
  }

  private applyGestureAnimation(elapsedTime: number): void {
    if (this.currentGesture === 'idle') return;

    const timeSinceStart = elapsedTime - this.gestureStartTime;

    if (this.currentGesture === 'wave' && this.rightArmBone) {
      // Friendly waving arm animation
      const waveAngle = Math.sin(timeSinceStart * 6.5) * 0.35;
      this.rightArmBone.rotation.z = -1.2 + waveAngle;
      if (this.rightForearmBone) {
        this.rightForearmBone.rotation.y = 0.5 + waveAngle * 0.4;
      }
      if (timeSinceStart > 2.5) this.currentGesture = 'idle';
    } else if (this.currentGesture === 'nod' && this.headBone) {
      // Understanding nod oscillation
      const nodPitch = Math.sin(timeSinceStart * 5.0) * 0.18;
      this.headBone.rotation.x = nodPitch;
      if (timeSinceStart > 1.8) {
        this.headBone.rotation.x = 0;
        this.currentGesture = 'idle';
      }
    } else if (this.currentGesture === 'thumbs_up' && this.rightArmBone) {
      // Reassuring thumbs up posture
      this.rightArmBone.rotation.z = -0.9;
      this.rightArmBone.rotation.x = 0.4;
      if (timeSinceStart > 2.2) {
        this.rightArmBone.rotation.z = 0;
        this.rightArmBone.rotation.x = 0;
        this.currentGesture = 'idle';
      }
    } else if (this.currentGesture === 'breathe' && this.avatarGroup) {
      // Deep 4-second paced breathing expansion
      const deepBreath = Math.sin(timeSinceStart * 1.57) * 0.035;
      this.avatarGroup.scale.set(1 + deepBreath, 1 + deepBreath, 1 + deepBreath);
    }
  }

  public setEmotion(emotion: MascotEmotion, crossfadeMs = 150): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setEmotion(emotion, crossfadeMs);
    }
    this.currentEmotion = emotion;
  }

  public setViseme(mouthShape: MouthShape, energy = 0.5): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setViseme(mouthShape, energy);
    }

    switch (mouthShape) {
      case 'wide_open':
        this.targetJawOpen = 0.85 * energy;
        this.targetMouthWidth = 0.2;
        break;
      case 'round_o':
        this.targetJawOpen = 0.6 * energy;
        this.targetMouthWidth = -0.3;
        break;
      case 'wide_smile':
        this.targetJawOpen = 0.4 * energy;
        this.targetMouthWidth = 0.7;
        break;
      case 'closed_smile':
        this.targetJawOpen = 0.05;
        this.targetMouthWidth = 0.4;
        break;
      case 'small_closed':
      default:
        this.targetJawOpen = 0.0;
        this.targetMouthWidth = 0.0;
        break;
    }
  }

  public setGesture(gesture: MascotGesture): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setGesture(gesture);
    }
    this.currentGesture = gesture;
    this.gestureStartTime = this.clock.getElapsedTime();
  }

  public setOutfit(outfit: OutfitType): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setOutfit(outfit);
    }
    this.outfit = outfit;
  }

  public onAudioFrame(volume: number, spectralCentroid: number): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.onAudioFrame(volume, spectralCentroid);
    }

    // Audio-driven lip-sync: maps volume to jaw opening and spectral centroid to mouth spread
    this.targetJawOpen = Math.min(1.0, Math.max(0.0, volume * 1.3));
    this.targetMouthWidth = Math.min(0.8, Math.max(-0.4, (spectralCentroid - 0.4) * 1.5));
  }

  public onUserGaze(normalizedX: number, normalizedY: number): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.onUserGaze(normalizedX, normalizedY);
    }
    this.targetTiltX = normalizedX;
    this.targetTiltY = normalizedY;
  }

  public setIsListening(listening: boolean): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setIsListening(listening);
    }
    this.isListening = listening;
    if (listening) {
      this.currentEmotion = 'calm';
    }
  }

  public setIsSpeaking(speaking: boolean): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      return this.fallbackRenderer.setIsSpeaking(speaking);
    }
    this.isSpeaking = speaking;
    if (!speaking) {
      this.targetJawOpen = 0;
      this.targetMouthWidth = 0;
    }
  }

  public destroy(): void {
    if (this.isUsingFallback && this.fallbackRenderer) {
      this.fallbackRenderer.destroy();
      this.fallbackRenderer = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.handleResize);

    if (this.renderer && this.canvas && this.container) {
      try {
        this.container.removeChild(this.canvas);
      } catch (_) {}
      this.renderer.dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.container = null;
  }
}
