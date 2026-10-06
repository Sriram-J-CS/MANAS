/**
 * VRMAvatarCanvas.tsx
 *
 * Primary 3D Companion Avatar Canvas for MANAS.
 * - Renders sample VRM 1.0 models (/avatars/girl.vrm and /avatars/boy.vrm).
 * - Uses @pixiv/three-vrm v3 + @react-three/fiber + Three.js.
 * - VRM 1.0: No rotation (faces +Z). Spring bones updated every frame via vrm.update(delta).
 * - Front camera (+Z looking toward -Z), auto-framed at head with fov ~28, bust framing.
 * - Natural hands-down normalized humanoid pose (no T-pose ever).
 * - Real-time TTS audio formant lip-sync (aa/ih/ou/ee/oh) with 40ms attack, 90ms release smoothing.
 * - Natural idle: 4s breathing cycle, blinks every 3-6s (incl. double blinks), micro-saccades lookAt.
 * - Conversational states: idle, listening, thinking (gaze up-left), speaking (nods & gestures).
 * - Tab visibility detection, WebGL error boundary, 15s load timeout fallback to 2D avatar.
 * - Proper disposal of geometry, textures, and materials.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { VRMLipSync } from '../../lib/avatar/vrmLipSync';
import { speechEngine } from '../../lib/voice/speechEngine';
import { AvatarFallback2D } from './AvatarFallback2D';

export type MascotEmotion =
  | 'calm'
  | 'empathetic'
  | 'encouraging'
  | 'concerned'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'relaxed'
  | 'neutral'
  | string;

export type MascotGesture = 'idle' | 'wave' | 'nod' | 'breathe' | 'thumbs_up' | 'base';

import type { AvatarAppearanceAttributes } from '../../lib/avatar/providers';
export type { AvatarAppearanceAttributes };

export const PHOTO_AVATAR_ENABLED = true;

/**
 * Procedural 3D glasses generator attached to VRM head bone.
 */
function createProceduralGlasses(shape: string = 'round', frameColorHex: string = '#1E1E24'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'procedural-glasses';

  const frameColor = new THREE.Color(frameColorHex);
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.25,
    metalness: 0.7,
  });

  const lensMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  const eyeOffsetX = 0.033; // Inter-pupillary half-distance
  const rimRadius = 0.019;
  const tubeRadius = 0.0022;

  let leftRimGeom: THREE.BufferGeometry;
  let rightRimGeom: THREE.BufferGeometry;
  let lensGeom: THREE.BufferGeometry;

  if (shape === 'rectangle' || shape === 'square') {
    const w = 0.034;
    const h = shape === 'square' ? 0.032 : 0.024;
    const shapePath = new THREE.Shape();
    const r = 0.004;
    shapePath.moveTo(-w / 2 + r, -h / 2);
    shapePath.lineTo(w / 2 - r, -h / 2);
    shapePath.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shapePath.lineTo(w / 2, h / 2 - r);
    shapePath.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shapePath.lineTo(-w / 2 + r, h / 2);
    shapePath.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shapePath.lineTo(-w / 2, -h / 2 + r);
    shapePath.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const holePath = new THREE.Path();
    const hr = 0.003;
    const hw = w - 0.004;
    const hh = h - 0.004;
    holePath.moveTo(-hw / 2 + hr, -hh / 2);
    holePath.lineTo(hw / 2 - hr, -hh / 2);
    holePath.quadraticCurveTo(hw / 2, -hh / 2, hw / 2, -hh / 2 + hr);
    holePath.lineTo(hw / 2, hh / 2 - hr);
    holePath.quadraticCurveTo(hw / 2, hh / 2, hw / 2 - hr, hh / 2);
    holePath.lineTo(-hw / 2 + hr, hh / 2);
    holePath.quadraticCurveTo(-hw / 2, hh / 2, -hw / 2, hh / 2 - hr);
    holePath.lineTo(-hw / 2, -hh / 2 + hr);
    holePath.quadraticCurveTo(-hw / 2, -hh / 2, -hw / 2 + hr, -hh / 2);
    shapePath.holes.push(holePath);

    leftRimGeom = new THREE.ExtrudeGeometry(shapePath, { depth: 0.003, bevelEnabled: false });
    rightRimGeom = leftRimGeom.clone();
    lensGeom = new THREE.PlaneGeometry(hw, hh);
  } else {
    leftRimGeom = new THREE.TorusGeometry(rimRadius, tubeRadius, 16, 32);
    rightRimGeom = new THREE.TorusGeometry(rimRadius, tubeRadius, 16, 32);
    lensGeom = new THREE.CircleGeometry(rimRadius - 0.001, 24);
  }

  const leftRim = new THREE.Mesh(leftRimGeom, frameMat);
  leftRim.position.set(-eyeOffsetX, 0, 0);

  const rightRim = new THREE.Mesh(rightRimGeom, frameMat);
  rightRim.position.set(eyeOffsetX, 0, 0);

  if (shape === 'oval') {
    leftRim.scale.set(1.15, 0.88, 1);
    rightRim.scale.set(1.15, 0.88, 1);
  }

  const leftLens = new THREE.Mesh(lensGeom, lensMat);
  leftLens.position.set(-eyeOffsetX, 0, 0.001);

  const rightLens = new THREE.Mesh(lensGeom, lensMat);
  rightLens.position.set(eyeOffsetX, 0, 0.001);

  // Center bridge
  const bridgeGeom = new THREE.CylinderGeometry(tubeRadius, tubeRadius, eyeOffsetX, 8);
  const bridge = new THREE.Mesh(bridgeGeom, frameMat);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, shape === 'rectangle' ? 0.002 : 0, 0);

  // Temples extending backward along -Z toward ears
  const templeLength = 0.095;
  const templeGeom = new THREE.CylinderGeometry(tubeRadius * 0.8, tubeRadius * 0.8, templeLength, 8);

  const leftTemple = new THREE.Mesh(templeGeom, frameMat);
  leftTemple.rotation.x = Math.PI / 2;
  leftTemple.position.set(-eyeOffsetX - rimRadius + 0.002, 0, -templeLength / 2);

  const rightTemple = new THREE.Mesh(templeGeom, frameMat);
  rightTemple.rotation.x = Math.PI / 2;
  rightTemple.position.set(eyeOffsetX + rimRadius - 0.002, 0, -templeLength / 2);

  group.add(leftRim, rightRim, leftLens, rightLens, bridge, leftTemple, rightTemple);

  // Position precisely on the nose bridge right in front of avatar eyes
  group.position.set(0, 0.082, 0.096);

  return group;
}

/**
 * Tints an MToon/Standard material by ratio target/original average color,
 * preserving underlying texture luminance while shifting tone, and adjusting shadeColor.
 */
function tintMaterial(mat: any, targetHex?: string): void {
  if (!targetHex || !mat || !mat.color) return;
  const target = new THREE.Color(targetHex);
  const orig = mat.userData.originalColor || mat.color;
  const origAvg = Math.max(0.01, (orig.r + orig.g + orig.b) / 3);

  // Ratio target/original average
  const ratioR = target.r / origAvg;
  const ratioG = target.g / origAvg;
  const ratioB = target.b / origAvg;

  mat.color.setRGB(
    Math.min(1, Math.max(0, orig.r * ratioR)),
    Math.min(1, Math.max(0, orig.g * ratioG)),
    Math.min(1, Math.max(0, orig.b * ratioB))
  );

  // Adjust shadeColor for MToon cell-shading depth
  if (mat.shadeColor) {
    const origShade = mat.userData.originalShadeColor || mat.shadeColor;
    const shadeAvg = Math.max(0.01, (origShade.r + origShade.g + origShade.b) / 3);
    const shadeTarget = target.clone().multiplyScalar(0.72);
    mat.shadeColor.setRGB(
      Math.min(1, Math.max(0, origShade.r * (shadeTarget.r / shadeAvg))),
      Math.min(1, Math.max(0, origShade.g * (shadeTarget.g / shadeAvg))),
      Math.min(1, Math.max(0, origShade.b * (shadeTarget.b / shadeAvg)))
    );
  }
  mat.needsUpdate = true;
}

/**
 * Applies procedural appearance attributes to any VRM instance via MToon materials
 * and optional procedural 3D glasses attached to the head bone.
 */
export function applyAppearance(vrm: VRM | null, attrs?: AvatarAppearanceAttributes | null): void {
  if (!vrm) return;

  const headBone = vrm.humanoid?.getNormalizedBoneNode('head') || vrm.humanoid?.getBoneNode('head');

  // 1. Procedural 3D glasses attached to head bone
  if (headBone) {
    const existingGlasses = headBone.getObjectByName('procedural-glasses');
    if (attrs?.glasses) {
      const shape = attrs.glasses_shape || 'round';
      const color = attrs.glasses_color_hex || '#1E1E24';
      if (!existingGlasses || existingGlasses.userData?.shape !== shape || existingGlasses.userData?.color !== color) {
        if (existingGlasses) {
          headBone.remove(existingGlasses);
          existingGlasses.traverse((o: any) => {
            o.geometry?.dispose();
            o.material?.dispose();
          });
        }
        const newGlasses = createProceduralGlasses(shape, color);
        newGlasses.userData = { shape, color };
        headBone.add(newGlasses);
      }
    } else if (existingGlasses) {
      headBone.remove(existingGlasses);
      existingGlasses.traverse((o: any) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
  }

  // 2. MToon Material Tinting (face skin, body skin, hair, hair back, iris)
  vrm.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach((mat: any) => {
        if (!mat) return;

        // Cache original colors on first load
        if (!mat.userData.originalColor && mat.color) {
          mat.userData.originalColor = mat.color.clone();
        }
        if (!mat.userData.originalShadeColor && mat.shadeColor) {
          mat.userData.originalShadeColor = mat.shadeColor.clone();
        }

        if (!attrs) {
          // Reset to default
          if (mat.userData.originalColor && mat.color) {
            mat.color.copy(mat.userData.originalColor);
          }
          if (mat.userData.originalShadeColor && mat.shadeColor) {
            mat.shadeColor.copy(mat.userData.originalShadeColor);
          }
          mat.needsUpdate = true;
          return;
        }

        const name = (mat.name || '').toLowerCase();

        // 1. Skin tone (face and body skin)
        if (
          attrs.skin_tone_hex &&
          (name.includes('skin') || name.includes('face') || name.includes('body')) &&
          !name.includes('eye') &&
          !name.includes('mouth') &&
          !name.includes('brow') &&
          !name.includes('hair')
        ) {
          tintMaterial(mat, attrs.skin_tone_hex);
        }

        // 2. Hair color (hair, hair back, bangs)
        if (
          attrs.hair_color_hex &&
          (name.includes('hair') || name.includes('hairback') || name.includes('hair_back') || name.includes('bangs'))
        ) {
          tintMaterial(mat, attrs.hair_color_hex);
        }

        // 3. Eye Iris color
        if (
          attrs.eye_color_hex &&
          (name.includes('iris') || name.includes('eyeiris') || name.includes('eye_iris'))
        ) {
          tintMaterial(mat, attrs.eye_color_hex);
        }

        // 4. Lip color
        if (
          attrs.lip_color_hex &&
          (name.includes('mouth') || name.includes('lip'))
        ) {
          tintMaterial(mat, attrs.lip_color_hex);
        }
      });
    }
  });
}

export interface VRMAvatarProps {
  gender?: 'boy' | 'girl';
  companion?: 'boy' | 'girl';
  outfit?: string;
  emotion?: MascotEmotion;
  gesture?: MascotGesture | string;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  isThinking?: boolean;
  audioEnergy?: number;
  mousePos?: { x: number; y: number };
  appearanceAttributes?: AvatarAppearanceAttributes | null;
  framing?: 'bust' | 'portrait';
  onLoaded?: () => void;
  onError?: (err: any) => void;
  onWaveEnd?: () => void;
  className?: string;
}

/**
 * Inner 3D VRM Model component rendered inside R3F Canvas.
 */
function VRMModelInner({
  gender = 'girl',
  companion,
  emotion = 'calm',
  gesture = 'idle',
  isSpeaking = false,
  isUserTyping = false,
  isThinking = false,
  audioEnergy = 0,
  mousePos = { x: 0, y: 0 },
  appearanceAttributes,
  framing = 'bust',
  onLoaded,
  onError,
  onWaveEnd,
}: VRMAvatarProps) {
  const { scene, camera } = useThree();
  const vrmRef = useRef<VRM | null>(null);
  const lipSyncRef = useRef<VRMLipSync>(new VRMLipSync());
  const headPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.35, 0));

  const activeGender = companion || gender || 'girl';

  // Blinking state (random blinks every 3-6s, with 20% double blinks)
  const blinkTimerRef = useRef<number>(0);
  const nextBlinkRef = useRef<number>(3.0 + Math.random() * 3.0);
  const isDoubleBlinkRef = useRef<boolean>(false);
  const blinkProgressRef = useRef<number>(0);
  const blinkPhaseRef = useRef<'idle' | 'first' | 'pause' | 'second'>('idle');

  // Waving gesture timer
  const waveTimerRef = useRef<number>(0);
  const isWavingRef = useRef<boolean>(false);
  const onWaveEndRef = useRef(onWaveEnd);
  onWaveEndRef.current = onWaveEnd;

  // Expression crossfade state (400ms transition, max intensity <= 0.5)
  const currentExprWeights = useRef<{
    relaxed: number;
    sad: number;
    happy: number;
    surprised: number;
  }>({ relaxed: 0.5, sad: 0, happy: 0, surprised: 0 });

  const targetExprWeights = useRef<{
    relaxed: number;
    sad: number;
    happy: number;
    surprised: number;
  }>({ relaxed: 0.5, sad: 0, happy: 0, surprised: 0 });

  // Map chat emotion to VRM expressions (intensity <= 0.5, never angry)
  useEffect(() => {
    const e = (emotion || '').toLowerCase();
    const t = { relaxed: 0, sad: 0, happy: 0, surprised: 0 };

    if (e === 'empathetic') {
      // empathetic -> sad 0.25 + relaxed 0.3
      t.sad = 0.25;
      t.relaxed = 0.3;
    } else if (e === 'encouraging') {
      // encouraging -> happy 0.45
      t.happy = 0.45;
    } else if (e === 'concerned') {
      // concerned -> sad 0.3 + surprised 0.1
      t.sad = 0.3;
      t.surprised = 0.1;
    } else if (e === 'happy') {
      t.happy = 0.45;
    } else if (e === 'sad') {
      t.sad = 0.4;
    } else if (e === 'surprised') {
      t.surprised = 0.35;
      t.relaxed = 0.15;
    } else {
      // calm / neutral -> relaxed 0.5
      t.relaxed = 0.5;
    }

    targetExprWeights.current = t;
  }, [emotion]);

  // Handle gesture trigger
  useEffect(() => {
    if (gesture === 'wave') {
      isWavingRef.current = true;
      waveTimerRef.current = 0;
    } else if (gesture === 'idle' || gesture === 'base') {
      isWavingRef.current = false;
    }
  }, [gesture]);

  // Immediate speech stop handler
  useEffect(() => {
    if (!isSpeaking && vrmRef.current) {
      lipSyncRef.current.reset(vrmRef.current);
    }
  }, [isSpeaking]);

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Primary VRM Loader: loads /avatars/girl.vrm or /avatars/boy.vrm
  useEffect(() => {
    let isDisposed = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const modelUrl = `/avatars/${activeGender}.vrm`;

    loader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return;
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          onErrorRef.current?.(new Error(`Failed to parse VRM metadata from ${modelUrl}`));
          return;
        }

        vrmRef.current = vrm;

        // Strip unnecessary vertices if needed
        try {
          VRMUtils.removeUnnecessaryVertices(vrm.scene);
        } catch (_) {}

        // VRM 1.0 requires NO rotation (it already faces +Z).
        // Only rotate legacy VRM 0.x models.
        if (vrm.meta?.metaVersion === '0') {
          VRMUtils.rotateVRM0(vrm);
        }

        // Enable shadows and optimize materials
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        // Auto-frame camera based on head bone position
        const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
        if (headNode) {
          vrm.scene.updateMatrixWorld(true);
          const worldPos = new THREE.Vector3();
          headNode.getWorldPosition(worldPos);
          headPosRef.current.copy(worldPos);

          // Camera in FRONT (+Z) looking toward -Z at the head.
          // For portrait / square containers: focus directly on face.
          // For bust framing: distance ~1.18m, FOV ~28.
          const isSquare = (camera as THREE.PerspectiveCamera).aspect >= 0.95 || framing === 'portrait';
          const targetY = isSquare ? worldPos.y - 0.01 : worldPos.y - 0.04;
          const targetDist = isSquare ? 0.72 : 1.18;
          camera.position.set(0, targetY, worldPos.z + targetDist);
          camera.lookAt(0, targetY, worldPos.z);
          if ('fov' in camera) {
            (camera as THREE.PerspectiveCamera).fov = isSquare ? 25 : 28;
            camera.updateProjectionMatrix();
          }
        } else {
          camera.position.set(0, 1.30, 1.25);
          camera.lookAt(0, 1.30, 0);
        }

        // Apply appearance attributes if custom attributes provided
        if (appearanceAttributes) {
          applyAppearance(vrm, appearanceAttributes);
        }

        scene.add(vrm.scene);
        onLoadedRef.current?.();
      },
      undefined,
      (err: any) => {
        if (isDisposed) return;
        console.error('[VRMAvatarCanvas] Failed to load VRM model:', err);
        onErrorRef.current?.(err);
      }
    );

    return () => {
      isDisposed = true;
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        // Clean disposal of geometries, materials, and textures
        vrmRef.current.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else if (m.material) {
              m.material.dispose();
            }
          }
        });
        vrmRef.current = null;
      }
    };
  }, [activeGender, scene, camera]);

  // Re-apply appearance attributes instantly on dynamic slider/preset change
  useEffect(() => {
    if (vrmRef.current) {
      applyAppearance(vrmRef.current, appearanceAttributes);
    }
  }, [appearanceAttributes]);

  // Main 60fps Animation, Posing, and Lip-Sync Loop
  useFrame((_, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    const time = performance.now() * 0.001;

    // 1. VRM Physics & Spring Bone Update (hair, clothes, ties)
    vrm.update(delta);

    const humanoid = vrm.humanoid;
    if (!humanoid) return;

    // 2. POSE (Hands down, natural). No T-pose, ever!
    // Set every frame AFTER vrm.update() on NORMALIZED humanoid bones:
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftHand = humanoid.getNormalizedBoneNode('leftHand');
    const rightHand = humanoid.getNormalizedBoneNode('rightHand');
    const leftShoulder = humanoid.getNormalizedBoneNode('leftShoulder');
    const rightShoulder = humanoid.getNormalizedBoneNode('rightShoulder');
    const chest = humanoid.getNormalizedBoneNode('upperChest') || humanoid.getNormalizedBoneNode('chest');
    const spine = humanoid.getNormalizedBoneNode('spine');
    const head = humanoid.getNormalizedBoneNode('head');
    const neck = humanoid.getNormalizedBoneNode('neck');

    // Auto-frame camera centered dynamically on companion head height (Boy: 1.50m, Girl: 1.35m)
    if (head) {
      const isPortrait = framing === 'portrait';
      const targetY = isPortrait ? headPosRef.current.y + 0.05 : headPosRef.current.y - 0.04;
      const targetDist = isPortrait ? 0.78 : 1.22;
      camera.position.set(0, targetY, headPosRef.current.z + targetDist);
      camera.lookAt(0, targetY, headPosRef.current.z);
    }

    // Shoulders slightly down
    if (leftShoulder) leftShoulder.rotation.set(0, 0, 0.05);
    if (rightShoulder) rightShoulder.rotation.set(0, 0, -0.05);

    // Default Hands Down Natural Resting Pose
    // Left upper arm: rotation.z ~ -1.25 (down by side)
    // Right upper arm: rotation.z ~ +1.25 (down by side)
    if (leftUpperArm) {
      leftUpperArm.rotation.set(0, 0, -1.25);
    }
    if (rightUpperArm && !isWavingRef.current) {
      rightUpperArm.rotation.set(0, 0, 1.25);
    }

    // Lower arms bent forward 0.15 - 0.25 rad
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0.20, 0, 0);
    }
    if (rightLowerArm && !isWavingRef.current) {
      rightLowerArm.rotation.set(0.20, 0, 0);
    }

    // Hands relaxed
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand && !isWavingRef.current) rightHand.rotation.set(0, 0, 0);

    // Fingers slightly curled (0.25 - 0.38 rad on proximal/intermediate bones)
    const curledFingers = [
      'leftIndexProximal', 'leftIndexIntermediate',
      'leftMiddleProximal', 'leftMiddleIntermediate',
      'leftRingProximal', 'leftRingIntermediate',
      'leftLittleProximal', 'leftLittleIntermediate',
      'rightIndexProximal', 'rightIndexIntermediate',
      'rightMiddleProximal', 'rightMiddleIntermediate',
      'rightRingProximal', 'rightRingIntermediate',
      'rightLittleProximal', 'rightLittleIntermediate',
    ];
    for (const fName of curledFingers) {
      const b = humanoid.getNormalizedBoneNode(fName as any);
      if (b) b.rotation.set(0.32, 0, 0);
    }
    const leftThumb = humanoid.getNormalizedBoneNode('leftThumbProximal');
    const rightThumb = humanoid.getNormalizedBoneNode('rightThumbProximal');
    if (leftThumb) leftThumb.rotation.set(0.15, 0.22, 0);
    if (rightThumb) rightThumb.rotation.set(0.15, -0.22, 0);

    // 3. Waving Action (Right Arm Welcoming Wave)
    if (isWavingRef.current) {
      waveTimerRef.current += delta;
      const wT = waveTimerRef.current;

      if (rightUpperArm && rightLowerArm && rightHand) {
        // Raise arm to greeting position
        rightUpperArm.rotation.set(-0.4, 0.2, 0.45);
        rightLowerArm.rotation.set(0.1, 1.1, 0.2);
        // Gentle side-to-side hand wave
        rightHand.rotation.set(0, 0, Math.sin(wT * 9.0) * 0.38);
      }

      // Wave lasts 1.8 seconds
      if (wT >= 1.8) {
        isWavingRef.current = false;
        waveTimerRef.current = 0;
        onWaveEndRef.current?.();
      }
    }

    // Subtle conversational forearm motion near waist during speech (never rises above chest)
    if (isSpeaking && !isWavingRef.current) {
      const speechSway = Math.sin(time * 3.2) * 0.05;
      if (leftLowerArm) leftLowerArm.rotation.x = 0.20 + speechSway;
      if (rightLowerArm) rightLowerArm.rotation.x = 0.20 - speechSway;
    }

    // 4. Idle Organic Motion:
    // Breathing: 4s cycle on chest/upperChest (0.01 rad)
    if (chest) {
      const breath = Math.sin(time * (2 * Math.PI / 4.0)) * 0.01;
      chest.rotation.set(breath, 0, 0);
    }

    // Slow weight shift on spine
    if (spine) {
      const sway = Math.sin(time * 0.45) * 0.008;
      spine.rotation.set(0, 0, sway);
    }

    // 5. Gaze, Head Drift & Conversational States
    const gazeX = THREE.MathUtils.clamp(mousePos.x * 0.16, -0.25, 0.25);
    const gazeY = THREE.MathUtils.clamp(-mousePos.y * 0.12, -0.2, 0.2);

    if (head) {
      if (isThinking) {
        // Thinking: eyes up-left, tiny head tilt
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, -0.14, delta * 3.5);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -0.09, delta * 3.5);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0.05, delta * 3.5);
      } else if (isUserTyping) {
        // Listening: slight nod, attentive posture
        const listenNod = Math.sin(time * 2.8) * 0.02;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX, delta * 4);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0.06 + listenNod, delta * 4);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, delta * 4);
      } else if (isSpeaking) {
        // Speaking: head nods synced to rhythm
        const speechBob = Math.sin(time * 4.5) * 0.018 * Math.min(1, (audioEnergy || 0.3) * 2.2);
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX + Math.sin(time * 1.8) * 0.015, delta * 5);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, gazeY + speechBob, delta * 5);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, delta * 5);
      } else {
        // Idle: tiny organic head drift
        const idleX = Math.sin(time * 0.55) * 0.012;
        const idleY = Math.cos(time * 0.42) * 0.015;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX + idleY, delta * 3);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, gazeY + idleX, delta * 3);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, delta * 3);
      }
    }

    if (neck && head) {
      neck.rotation.y = head.rotation.y * 0.35;
      neck.rotation.x = head.rotation.x * 0.35;
    }

    // VRM lookAt toward camera with micro-saccades
    if (vrm.lookAt) {
      const saccade = Math.sin(time * 0.25) > 0.85 ? Math.sin(time * 12) * 0.04 : 0;
      vrm.lookAt.lookAt(new THREE.Vector3(gazeX * 2 + saccade, headPosRef.current.y - 0.04, headPosRef.current.z + 2.0));
    }

    // 6. Natural Blinking (every 3-6s, 20% double blinks)
    blinkTimerRef.current += delta;
    if (blinkPhaseRef.current === 'idle') {
      if (blinkTimerRef.current >= nextBlinkRef.current) {
        blinkPhaseRef.current = 'first';
        blinkProgressRef.current = 0;
        isDoubleBlinkRef.current = Math.random() < 0.22;
      }
    } else if (blinkPhaseRef.current === 'first') {
      blinkProgressRef.current += delta * 12;
      if (blinkProgressRef.current >= 1.0) {
        blinkProgressRef.current = 1.0;
        if (isDoubleBlinkRef.current) {
          blinkPhaseRef.current = 'pause';
          blinkTimerRef.current = 0;
        } else {
          blinkPhaseRef.current = 'idle';
          blinkTimerRef.current = 0;
          nextBlinkRef.current = 3.0 + Math.random() * 3.0;
        }
      }
    } else if (blinkPhaseRef.current === 'pause') {
      blinkProgressRef.current = Math.max(0, blinkProgressRef.current - delta * 14);
      if (blinkTimerRef.current > 0.08) {
        blinkPhaseRef.current = 'second';
        blinkProgressRef.current = 0;
      }
    } else if (blinkPhaseRef.current === 'second') {
      blinkProgressRef.current += delta * 14;
      if (blinkProgressRef.current >= 1.0) {
        blinkPhaseRef.current = 'idle';
        blinkTimerRef.current = 0;
        nextBlinkRef.current = 3.0 + Math.random() * 3.0;
      }
    }

    const blinkVal = blinkProgressRef.current > 0.5
      ? (1.0 - blinkProgressRef.current) * 2
      : blinkProgressRef.current * 2;

    // 7. Expressions Crossfade (400ms transition)
    const exprFactor = 1 - Math.exp(-delta * 7.5);
    const cur = currentExprWeights.current;
    const tgt = targetExprWeights.current;

    cur.relaxed = THREE.MathUtils.lerp(cur.relaxed, tgt.relaxed, exprFactor);
    cur.sad = THREE.MathUtils.lerp(cur.sad, tgt.sad, exprFactor);
    cur.happy = THREE.MathUtils.lerp(cur.happy, tgt.happy, exprFactor);
    cur.surprised = THREE.MathUtils.lerp(cur.surprised, tgt.surprised, exprFactor);

    if (vrm.expressionManager) {
      try {
        vrm.expressionManager.setValue('blink', THREE.MathUtils.clamp(blinkVal, 0, 1));
        vrm.expressionManager.setValue('relaxed', cur.relaxed);
        vrm.expressionManager.setValue('sad', cur.sad);
        vrm.expressionManager.setValue('happy', cur.happy);
        vrm.expressionManager.setValue('surprised', cur.surprised);
      } catch (_) {}
    }

    // 8. Real TTS Audio Analyser Lip-Sync (A/I/U/E/O mapped to aa/ih/ou/ee/oh)
    const analyser = speechEngine.getAnalyserNode();
    lipSyncRef.current.update(vrm, delta, isSpeaking, audioEnergy, analyser, time);
  });

  return null;
}

/**
 * Main VRMAvatarCanvas wrapper with responsive studio lighting, fallback handling,
 * and tab visibility optimizations.
 */
export const VRMAvatarCanvas: React.FC<VRMAvatarProps> = (props) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTabVisible, setIsTabVisible] = useState<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCompanion = props.companion || props.gender || 'girl';

  // 15-second load timeout fallback to 2D avatar
  useEffect(() => {
    if (hasLoaded || loadError) return;
    const timer = setTimeout(() => {
      if (!hasLoaded) {
        console.warn('[VRMAvatarCanvas] 15s load timeout reached, falling back to 2D.');
        setLoadError(true);
        props.onError?.(new Error('Model loading timed out after 15s'));
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [hasLoaded, loadError, props]);

  // Tab visibility: pause render loop when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Parallax mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x: nx, y: ny });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: 0, y: 0 });
  }, []);

  const handleLoaded = useCallback(() => {
    setHasLoaded(true);
    setLoadError(false);
    props.onLoaded?.();
  }, [props]);

  const handleError = useCallback(
    (err: any) => {
      setLoadError(true);
      props.onError?.(err);
    },
    [props]
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full ${
        props.framing === 'portrait' ? '' : 'min-h-[340px]'
      } select-none overflow-hidden ${props.className || ''}`}
      aria-label="3D AI Companion VRM Avatar Canvas"
    >
      {/* 2D Fallback + Soft Loader until 3D VRM is fully loaded */}
      {(!hasLoaded || loadError) && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <AvatarFallback2D
            companion={activeCompanion}
            gender={activeCompanion}
            emotion={props.emotion}
            isSpeaking={props.isSpeaking}
            isLoading={!hasLoaded && !loadError}
            statusText="Preparing 3D Companion..."
          />
        </div>
      )}

      {/* R3F 3D Canvas */}
      {!loadError && (
        <Canvas
          camera={{ position: [0, 1.32, 1.2], fov: 28 }}
          dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
          frameloop={isTabVisible ? 'always' : 'never'}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          shadows
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            pointerEvents: 'auto',
            opacity: hasLoaded ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
          }}
        >
          {/* Soft Studio Lighting */}
          <hemisphereLight args={['#FFFFFF', '#E2DCD5', 1.7]} />

          {/* Warm Key Light */}
          <directionalLight
            position={[1.2, 2.6, 2.5]}
            intensity={2.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
          />

          {/* Soft Lavender Fill Light */}
          <directionalLight position={[-2.5, 1.5, 2]} intensity={0.85} color="#D8D0FF" />

          {/* Subtle Silhouette Rim Light */}
          <directionalLight position={[0, 2.8, -2.5]} intensity={1.15} color="#FFE8F0" />

          {/* Contact Shadow Ground Plane */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[2.5, 2.5]} />
            <shadowMaterial opacity={0.15} />
          </mesh>

          <VRMModelInner
            {...props}
            companion={activeCompanion}
            mousePos={mousePos}
            onLoaded={handleLoaded}
            onError={handleError}
          />
        </Canvas>
      )}
    </div>
  );
};

export default VRMAvatarCanvas;
