import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MascotExpression } from '../../types';

export type OutfitType = 'hoodie' | 'formal' | 'kurta_saree' | 'sports' | 'pyjamas' | 'festive';

export interface MascotCustomAttributes {
  skinTone?: string;
  hairColor?: string;
  hairStyle?: string;
  glasses?: boolean;
  outfitColor?: string;
}

export type CameraView = 'bust' | 'full_body';
export type MascotReaction = 'idle' | 'nod' | 'breathe' | 'encourage' | 'wave';

interface ThreeCartoonMascotProps {
  gender?: 'boy' | 'girl';
  outfit?: OutfitType;
  expression?: MascotExpression;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  isGuidedBreathing?: boolean;
  isWaving?: boolean;
  activeReaction?: MascotReaction;
  cameraView?: CameraView;
  audioEnergy?: number; // 0 to 1 for live lip-sync
  attributes?: MascotCustomAttributes;
  modelUrl?: string | null;
  onWaveComplete?: () => void;
  className?: string;
}

/**
 * ThreeCartoonMascot
 * Full-body 3D Cartoon Mascot with Toon Shading, Soft Rim Light,
 * procedural + GLB/VRM morph targets, eye gaze tracking, breathing,
 * blinking, listening pose, guided breathing, and wardrobe swapping.
 */
export const ThreeCartoonMascot: React.FC<ThreeCartoonMascotProps> = ({
  gender = 'boy',
  outfit = 'hoodie',
  expression = 'neutral',
  isSpeaking = false,
  isUserTyping = false,
  isGuidedBreathing = false,
  isWaving = false,
  activeReaction = 'idle',
  cameraView = 'bust',
  audioEnergy = 0,
  attributes = {},
  modelUrl = null,
  onWaveComplete,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Animation and scene state refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number | null>(null);

  // Mesh & Rig references
  const mascotGroupRef = useRef<THREE.Group | null>(null);
  const headMeshRef = useRef<THREE.Mesh | null>(null);
  const leftEyeRef = useRef<THREE.Mesh | null>(null);
  const rightEyeRef = useRef<THREE.Mesh | null>(null);
  const mouthMeshRef = useRef<THREE.Mesh | null>(null);
  const chestMeshRef = useRef<THREE.Mesh | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const clothesMeshRef = useRef<THREE.Mesh | null>(null);
  const glassesMeshRef = useRef<THREE.Mesh | null>(null);

  // Material references for live outfit/skin updates
  const skinMaterialRef = useRef<THREE.MeshToonMaterial | null>(null);
  const clothesMaterialRef = useRef<THREE.MeshToonMaterial | null>(null);
  const hairMaterialRef = useRef<THREE.MeshToonMaterial | null>(null);

  // Mouse tracking
  const mouseTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Outfit Color Presets
  const outfitPalette: Record<OutfitType, { primary: number; secondary: number; pattern: string }> = {
    hoodie: { primary: 0x3b82f6, secondary: 0x1d4ed8, pattern: 'casual' },
    formal: { primary: 0x1e293b, secondary: 0xffffff, pattern: 'blazer' },
    kurta_saree: { primary: 0xd97706, secondary: 0xfef3c7, pattern: 'festive' },
    sports: { primary: 0x10b981, secondary: 0x064e3b, pattern: 'active' },
    pyjamas: { primary: 0x8b5cf6, secondary: 0xc4b5fd, pattern: 'sleep' },
    festive: { primary: 0xe11d48, secondary: 0xfde047, pattern: 'celebrate' },
  };

  // Build Procedural Rigged Cartoon Mascot with Toon Shading & Morph Targets
  const buildProceduralMascot = useCallback(() => {
    const group = new THREE.Group();
    mascotGroupRef.current = group;

    // Toon Gradient Map (3-step cel ramp)
    const format = THREE.RGBAFormat;
    const colors = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    const gradientMap = new THREE.DataTexture(colors, 3, 1, format);
    gradientMap.needsUpdate = true;

    // Materials with Toon Shading
    const defaultSkin = gender === 'girl' ? 0xfde047 : 0xfcd34d;
    const skinColor = attributes.skinTone ? new THREE.Color(attributes.skinTone) : new THREE.Color(defaultSkin);
    const skinMaterial = new THREE.MeshToonMaterial({
      color: skinColor,
      gradientMap,
    });
    skinMaterialRef.current = skinMaterial;

    // Default reference outfits:
    // Boy: blue hoodie (0x2563eb)
    // Girl: grey hoodie (0x64748b) with yellow inner shirt (0xfacc15)
    const defaultClothesColor = gender === 'girl' ? 0x64748b : 0x2563eb;
    const currentOutfit = outfitPalette[outfit] || outfitPalette.hoodie;
    const clothesColor = attributes.outfitColor
      ? new THREE.Color(attributes.outfitColor)
      : outfit === 'hoodie'
      ? new THREE.Color(defaultClothesColor)
      : new THREE.Color(currentOutfit.primary);

    const clothesMaterial = new THREE.MeshToonMaterial({
      color: clothesColor,
      gradientMap,
    });
    clothesMaterialRef.current = clothesMaterial;

    const defaultHair = 0x1c1917; // Short black / long dark hair
    const hairColor = attributes.hairColor ? new THREE.Color(attributes.hairColor) : new THREE.Color(defaultHair);
    const hairMaterial = new THREE.MeshToonMaterial({
      color: hairColor,
      gradientMap,
    });
    hairMaterialRef.current = hairMaterial;

    // 1. Torso / Hoodie (for breathing & outfit)
    const chestGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.95, 24);
    const chest = new THREE.Mesh(chestGeo, clothesMaterial);
    chest.position.y = 0.55;
    chest.castShadow = true;
    chestMeshRef.current = chest;
    clothesMeshRef.current = chest;
    group.add(chest);

    // For Girl reference: Yellow inner shirt peeking at collar
    if (gender === 'girl') {
      const yellowShirtMat = new THREE.MeshToonMaterial({ color: 0xfacc15, gradientMap });
      const collarGeo = new THREE.TorusGeometry(0.22, 0.04, 12, 24);
      const collar = new THREE.Mesh(collarGeo, yellowShirtMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.98;
      group.add(collar);
    }

    // Hoodie pouch pocket
    const pouchGeo = new THREE.BoxGeometry(0.45, 0.28, 0.12);
    const pouch = new THREE.Mesh(pouchGeo, clothesMaterial);
    pouch.position.set(0, 0.42, 0.43);
    group.add(pouch);

    // 2. Neck
    const neckGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.22, 16);
    const neck = new THREE.Mesh(neckGeo, skinMaterial);
    neck.position.y = 1.1;
    group.add(neck);

    // 3. Head (for nodding & expressions)
    const headGeo = new THREE.SphereGeometry(0.55, 32, 28);
    const head = new THREE.Mesh(headGeo, skinMaterial);
    head.position.y = 1.65;
    head.castShadow = true;
    headMeshRef.current = head;
    group.add(head);

    // 4. Stylized Hair (Matching reference images)
    if (gender === 'girl') {
      // Long dark flowing hair
      const girlHairGeo = new THREE.SphereGeometry(0.62, 24, 20);
      const girlHair = new THREE.Mesh(girlHairGeo, hairMaterial);
      girlHair.position.set(0, 1.75, -0.06);
      group.add(girlHair);

      // Side long strands framing face
      const strandGeo = new THREE.CylinderGeometry(0.08, 0.04, 0.75, 12);
      const strandLeft = new THREE.Mesh(strandGeo, hairMaterial);
      strandLeft.position.set(-0.45, 1.45, 0.2);
      strandLeft.rotation.z = -0.15;
      const strandRight = new THREE.Mesh(strandGeo, hairMaterial);
      strandRight.position.set(0.45, 1.45, 0.2);
      strandRight.rotation.z = 0.15;
      group.add(strandLeft);
      group.add(strandRight);
    } else {
      // Boy hair (short black messy hair)
      const boyHairGeo = new THREE.ConeGeometry(0.58, 0.55, 16);
      const boyHair = new THREE.Mesh(boyHairGeo, hairMaterial);
      boyHair.rotation.x = -0.3;
      boyHair.position.set(0, 2.1, -0.05);
      group.add(boyHair);

      // Messy fringe strands
      const fringeGeo = new THREE.ConeGeometry(0.14, 0.28, 8);
      const fringe1 = new THREE.Mesh(fringeGeo, hairMaterial);
      fringe1.rotation.set(0.5, 0.2, 0.3);
      fringe1.position.set(-0.15, 2.05, 0.42);
      const fringe2 = new THREE.Mesh(fringeGeo, hairMaterial);
      fringe2.rotation.set(0.4, -0.2, -0.2);
      fringe2.position.set(0.12, 2.08, 0.44);
      group.add(fringe1);
      group.add(fringe2);
    }

    // 5. Cartoon Eyes (Warm brown eyes with pupil tracking)
    const eyeGeo = new THREE.SphereGeometry(0.11, 20, 20);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisGeo = new THREE.SphereGeometry(0.075, 16, 16);
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x5c3a21 }); // Warm brown eyes
    const pupilGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(-0.2, 1.72, 0.44);
    const leftIris = new THREE.Mesh(irisGeo, irisMat);
    leftIris.position.set(0, 0, 0.06);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, 0.04);
    const leftGlint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    leftGlint.position.set(0.02, 0.02, 0.05);
    leftIris.add(leftPupil);
    leftIris.add(leftGlint);
    leftEye.add(leftIris);
    group.add(leftEye);
    leftEyeRef.current = leftEye;

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.2, 1.72, 0.44);
    const rightIris = new THREE.Mesh(irisGeo, irisMat);
    rightIris.position.set(0, 0, 0.06);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0, 0, 0.04);
    const rightGlint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rightGlint.position.set(0.02, 0.02, 0.05);
    rightIris.add(rightPupil);
    rightIris.add(rightGlint);
    rightEye.add(rightIris);
    group.add(rightEye);
    rightEyeRef.current = rightEye;

    // 6. Optional Glasses
    if (attributes.glasses) {
      const glassesGeo = new THREE.TorusGeometry(0.15, 0.02, 12, 24);
      const glassesMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
      const glassLeft = new THREE.Mesh(glassesGeo, glassesMat);
      glassLeft.position.set(-0.2, 1.72, 0.52);
      const glassRight = new THREE.Mesh(glassesGeo, glassesMat);
      glassRight.position.set(0.2, 1.72, 0.52);

      const bridgeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15);
      const bridge = new THREE.Mesh(bridgeGeo, glassesMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 1.72, 0.53);

      const glassesGroup = new THREE.Group();
      glassesGroup.add(glassLeft);
      glassesGroup.add(glassRight);
      glassesGroup.add(bridge);
      group.add(glassesGroup);
      glassesMeshRef.current = glassLeft;
    }

    // 7. Cartoon Mouth (Lip-sync & Expressions)
    const mouthGeo = new THREE.TorusGeometry(0.09, 0.025, 12, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.48, 0.49);
    mouth.rotation.x = Math.PI;
    mouthMeshRef.current = mouth;
    group.add(mouth);

    // 8. Arms (Waving & Gestures)
    // Left Arm
    const armGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.75, 16);
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.58, 0.9, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, clothesMaterial);
    leftArmMesh.position.set(0, -0.35, 0);
    leftArmGroup.add(leftArmMesh);
    group.add(leftArmGroup);
    leftArmRef.current = leftArmGroup;

    // Right Arm (Waving hand)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.58, 0.9, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, clothesMaterial);
    rightArmMesh.position.set(0, -0.35, 0);
    rightArmGroup.add(rightArmMesh);

    // Cartoon Hand
    const handGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const hand = new THREE.Mesh(handGeo, skinMaterial);
    hand.position.set(0, -0.72, 0);
    rightArmGroup.add(hand);

    group.add(rightArmGroup);
    rightArmRef.current = rightArmGroup;

    // Position group comfortably in viewport
    group.position.set(0, -0.85, 0);
    return group;
  }, [gender, outfit, attributes]);

  // Initialize Three.js Scene, Toon Lights & Soft Rim Light
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 440;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.7, 3.8);
    cameraRef.current = camera;

    // WebGL Renderer with Tone Mapping & Antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 1. Ambient Fill Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // 2. Key Toon Light (Soft Warm Directional)
    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.25);
    keyLight.position.set(2.5, 4.0, 3.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // 3. Soft Rim Light (Positioned behind avatar to create glowing cartoon contour)
    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.8);
    rimLight.position.set(-2.8, 3.2, -3.0);
    scene.add(rimLight);

    // 4. Subtle Warm Under-Bounce Light
    const bounceLight = new THREE.DirectionalLight(0xfef08a, 0.45);
    bounceLight.position.set(0, -2.5, 1.5);
    scene.add(bounceLight);

    // Load custom GLB if provided; otherwise build stylized procedural cartoon mascot
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          model.position.set(0, -0.85, 0);
          scene.add(model);
          mascotGroupRef.current = model;
          setLoading(false);
        },
        undefined,
        (err) => {
          console.warn('GLB load failed, falling back to procedural cartoon mascot:', err);
          const mascot = buildProceduralMascot();
          scene.add(mascot);
          setLoading(false);
        }
      );
    } else {
      const mascot = buildProceduralMascot();
      scene.add(mascot);
      setLoading(false);
    }

    // Pointer Tracking Listener
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseTargetRef.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      };
    };

    window.addEventListener('mousemove', handlePointerMove);

    // Handle Window Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl, buildProceduralMascot]);

  const isTabVisibleRef = useRef<boolean>(true);

  // Pause rendering when tab is hidden to save battery & GPU
  useEffect(() => {
    const handleVisibility = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Main Animation Loop (Breathing, Blinking, Gaze Tracking, Listening, Wave, Lip-sync)
  useEffect(() => {
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let waveTimer = 0;

    const animate = () => {
      // Pause render loop if tab is hidden
      if (!isTabVisibleRef.current) {
        frameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Camera Smooth Zoom (Bust vs Full Body)
      if (cameraRef.current) {
        const targetCamY = cameraView === 'bust' ? 1.55 : 0.7;
        const targetCamZ = cameraView === 'bust' ? 2.35 : 3.8;
        cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, targetCamY, 0.06);
        cameraRef.current.position.z = THREE.MathUtils.lerp(cameraRef.current.position.z, targetCamZ, 0.06);
      }

      // 1. Idle Breathing (Chest expansion & slight head sway)
      if (chestMeshRef.current) {
        if (isGuidedBreathing) {
          // Guided 4-second inhale / 4-second exhale
          const breathCycle = (Math.sin((time * Math.PI) / 4) + 1) / 2; // 0 to 1
          const scale = 1.0 + breathCycle * 0.18;
          chestMeshRef.current.scale.set(scale, scale, scale);
          if (headMeshRef.current) {
            headMeshRef.current.position.y = 1.65 + breathCycle * 0.08;
          }
        } else {
          // Natural idle breathing (~3.2s period)
          const idleBreath = Math.sin(time * 2.0) * 0.035;
          chestMeshRef.current.scale.set(1.0 + idleBreath, 1.0 + idleBreath * 0.7, 1.0 + idleBreath);
          if (headMeshRef.current) {
            headMeshRef.current.position.y = 1.65 + idleBreath * 0.4;
          }
        }
      }

      // 2. Eye Gaze (Smooth Lerp to Mouse Pointer)
      const targetGazeX = mouseTargetRef.current.x * 0.04;
      const targetGazeY = mouseTargetRef.current.y * 0.03;
      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.children[0]?.position.set(targetGazeX, targetGazeY, 0.08);
        rightEyeRef.current.children[0]?.position.set(targetGazeX, targetGazeY, 0.08);
      }

      // 3. Spontaneous Blinking (Every 3.8s)
      blinkTimer += delta;
      if (blinkTimer > 3.8) {
        if (leftEyeRef.current && rightEyeRef.current) {
          leftEyeRef.current.scale.y = 0.1;
          rightEyeRef.current.scale.y = 0.1;
          setTimeout(() => {
            if (leftEyeRef.current && rightEyeRef.current) {
              leftEyeRef.current.scale.y = 1.0;
              rightEyeRef.current.scale.y = 1.0;
            }
          }, 140);
        }
        blinkTimer = 0;
      }

      // 4. Listening Pose (When user is typing)
      if (headMeshRef.current && mascotGroupRef.current) {
        if (isUserTyping) {
          // Attentive tilt: lean slightly forward and tilt head 8 degrees
          headMeshRef.current.rotation.z = THREE.MathUtils.lerp(headMeshRef.current.rotation.z, 0.12, 0.08);
          headMeshRef.current.rotation.x = THREE.MathUtils.lerp(headMeshRef.current.rotation.x, 0.08, 0.08);
        } else {
          // Idle gentle nod sway
          const nod = Math.sin(time * 1.2) * 0.025;
          headMeshRef.current.rotation.z = THREE.MathUtils.lerp(headMeshRef.current.rotation.z, 0, 0.08);
          headMeshRef.current.rotation.x = THREE.MathUtils.lerp(headMeshRef.current.rotation.x, nod, 0.08);
        }
      }

      // 5. Facial Expressions (Driven by Chat Emotion Tag)
      if (mouthMeshRef.current) {
        if (isSpeaking) {
          // Live Audio Energy Viseme Lip-Sync
          const openAmount = Math.max(0.2, Math.min(1.0, audioEnergy * 2.5 + Math.sin(time * 18) * 0.3));
          mouthMeshRef.current.scale.set(1.0 + openAmount * 0.5, openAmount * 2.2, 1.0);
        } else {
          // Reset to emotion shape
          if (expression === 'happy') {
            mouthMeshRef.current.rotation.x = Math.PI; // Smile
            mouthMeshRef.current.scale.set(1.1, 0.8, 1.0);
          } else if (expression === 'concerned' || expression === 'sad') {
            mouthMeshRef.current.rotation.x = 0; // Frown / worried
            mouthMeshRef.current.scale.set(0.9, 0.6, 1.0);
          } else {
            // Calm / neutral
            mouthMeshRef.current.rotation.x = Math.PI;
            mouthMeshRef.current.scale.set(0.8, 0.3, 1.0);
          }
        }
      }

      // 6. Reaction Gestures (Nod, Encourage / Thumbs-up, Wave)
      if (activeReaction === 'nod' && headMeshRef.current) {
        const nodAngle = Math.sin(time * 9.0) * 0.14;
        headMeshRef.current.rotation.x = nodAngle;
      }

      if (rightArmRef.current) {
        if (isWaving || activeReaction === 'wave') {
          waveTimer += delta * 7;
          const waveAngle = Math.sin(waveTimer) * 0.45 - 2.2;
          rightArmRef.current.rotation.z = waveAngle;
          if (waveTimer > Math.PI * 5) {
            onWaveComplete?.();
          }
        } else if (activeReaction === 'encourage') {
          // Thumbs-up / encouraging cheer
          rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -1.85, 0.14);
          rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.65, 0.14);
        } else {
          rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.2, 0.1);
          rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
        }
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, [
    isSpeaking,
    isUserTyping,
    isGuidedBreathing,
    isWaving,
    activeReaction,
    cameraView,
    audioEnergy,
    expression,
    onWaveComplete,
  ]);

  // Update outfit material colors dynamically when wardrobe changes
  useEffect(() => {
    if (!clothesMaterialRef.current) return;
    const currentOutfit = outfitPalette[outfit] || outfitPalette.hoodie;
    const targetColor = attributes.outfitColor
      ? new THREE.Color(attributes.outfitColor)
      : new THREE.Color(currentOutfit.primary);
    clothesMaterialRef.current.color = targetColor;
  }, [outfit, attributes.outfitColor]);

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Loading Skeleton */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-3xl z-20">
          <div className="w-14 h-14 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-cyan-300">
            Rendering 3D Mascot...
          </p>
        </div>
      )}

      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full min-h-[380px] flex items-center justify-center cursor-grab active:cursor-grabbing" />
    </div>
  );
};
