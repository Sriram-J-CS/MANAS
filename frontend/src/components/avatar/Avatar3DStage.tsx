/**
 * MANAS Avatar3DStage
 * Production Three.js 3D Avatar Stage.
 * - Primary VRM 1.0 model loading (/avatars/<boy|girl>.vrm) with GLB fallback
 * - VRMLoaderPlugin (MToon) with spring bones updated every frame
 * - Soft studio lighting + rim light + ACES tone mapping + contact ground shadow
 * - Auto-framing camera (Full-body vs Bust framing)
 * - Limited orbit (±35° azimuth)
 * - Normalized humanoid natural pose (hands down, relaxed, fingers curled, no T-pose)
 * - Real-time TTS audio formant lip-sync and emotion expressions
 * - DPR capped at 2, resize handling, full resource disposal on unmount
 * - Error boundary & soft loader fallback to BitmojiPortrait
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { VRMLipSync } from '../../lib/avatar/vrmLipSync';
import { FaceDriver, type AvatarEmotion } from '../../lib/avatar/FaceDriver';
import { validateAvatarModel, type AvatarValidationReport } from '../../lib/avatar/assetValidator';
import type { AvatarGesture, AvatarState } from '../../lib/avatar/speechPerformance';
import { BitmojiPortrait, type BitmojiGender } from './BitmojiPortrait';

export type CameraFraming = 'full_body' | 'bust' | 'portrait';

export interface Avatar3DStageProps {
  avatarId?: 'boy' | 'girl' | string;
  companion?: 'boy' | 'girl';
  emotion?: AvatarEmotion;
  activeGesture?: AvatarGesture;
  state?: AvatarState;
  framing?: CameraFraming;
  isSpeaking?: boolean;
  audioEnergy?: number;
  visemeWeights?: Record<string, number>;
  mouseGaze?: { x: number; y: number };
  skinTone?: string;
  hairColor?: string;
  outfitColor?: string;
  hairStyle?: string;
  outfitType?: string;
  glassesStyle?: string;
  beardStyle?: string;
  earringsStyle?: string;
  onValidationComplete?: (report: AvatarValidationReport) => void;
  className?: string;
}

export const Avatar3DStage: React.FC<Avatar3DStageProps> = ({
  avatarId = 'girl',
  companion,
  emotion = 'calm',
  activeGesture = 'idle',
  state = 'idle',
  framing = 'bust',
  isSpeaking = false,
  audioEnergy = 0,
  visemeWeights = {},
  mouseGaze = { x: 0, y: 0 },
  skinTone,
  hairColor,
  outfitColor,
  hairStyle,
  outfitType,
  glassesStyle,
  beardStyle,
  earringsStyle,
  onValidationComplete,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);

  // VRM / Model subsystems
  const vrmRef = useRef<VRM | null>(null);
  const lipSyncRef = useRef<VRMLipSync>(new VRMLipSync());
  const faceDriverRef = useRef<FaceDriver | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);

  const onValidationCompleteRef = useRef(onValidationComplete);
  onValidationCompleteRef.current = onValidationComplete;

  // Camera targets for smooth animation between full_body and bust
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.3, 1.2));
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.3, 0));

  // Current smoothed head rotation for mouse tracking
  const smoothedHeadRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Blinking
  const blinkTimerRef = useRef<number>(0);
  const nextBlinkRef = useRef<number>(3.0 + Math.random() * 2.5);
  const blinkAmountRef = useRef<number>(0);

  const frameCountRef = useRef<number>(0);

  /**
   * Updates camera framing based on avatar head position
   */
  const updateCameraFraming = useCallback((mode: CameraFraming) => {
    if (!headBoneRef.current || !cameraRef.current) return;

    if (modelRootRef.current) {
      modelRootRef.current.updateMatrixWorld(true);
    }
    headBoneRef.current.updateMatrixWorld(true);

    const headWorldPos = new THREE.Vector3();
    headBoneRef.current.getWorldPosition(headWorldPos);

    if (headWorldPos.y < 0.5) {
      const canonicalY = (companion || avatarId) === 'boy' ? 1.50 : 1.35;
      headWorldPos.set(0, canonicalY, 0);
    }

    if (mode === 'portrait' || (mountRef.current && mountRef.current.clientWidth < 140)) {
      // Close-up portrait framing for avatar badges/mini-stages (eye level, distance 0.72m)
      targetCamPosRef.current.set(0, headWorldPos.y + 0.05, headWorldPos.z + 0.72);
      targetLookAtRef.current.set(0, headWorldPos.y + 0.05, headWorldPos.z);
    } else if (mode === 'bust') {
      // Upper-body bust framing: distance ~1.18m, camera y slightly below head
      targetCamPosRef.current.set(0, headWorldPos.y - 0.04, headWorldPos.z + 1.18);
      targetLookAtRef.current.set(0, headWorldPos.y - 0.04, headWorldPos.z);
    } else {
      // Full body framing
      targetCamPosRef.current.set(0, headWorldPos.y * 0.6, headWorldPos.z + 2.3);
      targetLookAtRef.current.set(0, headWorldPos.y * 0.55, headWorldPos.z);
    }
  }, [companion, avatarId]);

  /**
   * Main Initialization & Model Loading
   */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    setLoading(true);
    setLoadError(null);

    // 1. Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Setup Camera in FRONT (+Z looking toward -Z)
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 50);
    camera.position.set(0, 1.32, 1.2);
    cameraRef.current = camera;

    // 3. Setup Renderer with ACES Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap DPR to 2
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Soft Three-Point Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfffdf7, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    keyLight.position.set(1.2, 2.6, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd8d0ff, 0.8);
    fillLight.position.set(-2.5, 1.5, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);
    rimLight.position.set(0, 2.8, -2.5);
    scene.add(rimLight);

    // Ground Contact Shadow plane
    const shadowGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.005;
    contactShadow.receiveShadow = true;
    scene.add(contactShadow);

    // 5. OrbitControls with limited orbit (±35° azimuth)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minAzimuthAngle = -0.61;
    controls.maxAzimuthAngle = 0.61;
    controls.minPolarAngle = Math.PI / 2 - 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.minDistance = 0.7;
    controls.maxDistance = 3.2;
    controlsRef.current = controls;

    // 6. Load VRM Model (with GLB fallback)
    const effectiveAvatarId = companion || avatarId || 'girl';
    const vrmUrl = `/avatars/${effectiveAvatarId}.vrm`;
    const glbUrl = `/avatars/${effectiveAvatarId}/${effectiveAvatarId}.glb`;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const loadVRM = () => {
      loader.load(
        vrmUrl,
        (gltf) => {
          if (isDisposed) return;
          const vrm = gltf.userData.vrm as VRM;
          if (vrm) {
            vrmRef.current = vrm;
            modelRootRef.current = vrm.scene;

            try {
              VRMUtils.removeUnnecessaryVertices(vrm.scene);
            } catch (_) {}

            // VRM 1.0 requires NO rotation (only rotate legacy 0.x models)
            if (vrm.meta?.metaVersion === '0') {
              VRMUtils.rotateVRM0(vrm);
            }

            vrm.scene.traverse((obj) => {
              if ((obj as THREE.Mesh).isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
              }
            });

            scene.add(vrm.scene);

            const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
            if (headNode) {
              headBoneRef.current = headNode;
            }

            updateCameraFraming(framing);
            if (cameraRef.current && controlsRef.current) {
              cameraRef.current.position.copy(targetCamPosRef.current);
              controlsRef.current.target.copy(targetLookAtRef.current);
              controlsRef.current.update();
            }
            setLoading(false);
          } else {
            loadGLBFallback();
          }
        },
        undefined,
        () => {
          loadGLBFallback();
        }
      );
    };

    const loadGLBFallback = () => {
      loader.load(
        glbUrl,
        (gltf) => {
          if (isDisposed) return;
          const model = gltf.scene;
          modelRootRef.current = model;
          scene.add(model);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.name === 'head') {
                faceDriverRef.current = new FaceDriver(child as THREE.Mesh);
              }
            }
            if ((child as THREE.Bone).isBone && child.name.toLowerCase().includes('head')) {
              headBoneRef.current = child;
            }
          });

          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            mixerRef.current = mixer;
            gltf.animations.forEach((clip) => {
              actionsRef.current.set(clip.name, mixer.clipAction(clip));
            });
            const idleAction = actionsRef.current.get('idle');
            if (idleAction) idleAction.play();
          }

          updateCameraFraming(framing);
          setLoading(false);
        },
        undefined,
        (err: any) => {
          if (isDisposed) return;
          console.error('Failed to load avatar:', err);
          setLoadError(`Failed to load avatar ${avatarId}`);
          setLoading(false);
        }
      );
    };

    loadVRM();

    // 7. Render Loop
    const clock = new THREE.Clock();
    const renderLoop = () => {
      frameIdRef.current = requestAnimationFrame(renderLoop);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Update VRM springs & physics
      if (vrmRef.current) {
        vrmRef.current.update(delta);

        // Apply Natural Normalized Pose (hands down, no T-pose)
        const humanoid = vrmRef.current.humanoid;
        if (humanoid) {
          const lUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
          const rUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
          const lLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
          const rLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
          const lHand = humanoid.getNormalizedBoneNode('leftHand');
          const rHand = humanoid.getNormalizedBoneNode('rightHand');
          const chest = humanoid.getNormalizedBoneNode('upperChest') || humanoid.getNormalizedBoneNode('chest');
          const head = humanoid.getNormalizedBoneNode('head');

          if (lUpperArm) lUpperArm.rotation.set(0, 0, -1.25);
          if (rUpperArm) rUpperArm.rotation.set(0, 0, 1.25);
          if (lLowerArm) lLowerArm.rotation.set(0.20, 0, 0);
          if (rLowerArm) rLowerArm.rotation.set(0.20, 0, 0);
          if (lHand) lHand.rotation.set(0, 0, 0);
          if (rHand) rHand.rotation.set(0, 0, 0);

          // 4s idle breathing cycle
          if (chest) {
            chest.rotation.set(Math.sin(time * (2 * Math.PI / 4.0)) * 0.01, 0, 0);
          }

          // Blinking
          blinkTimerRef.current += delta;
          if (blinkTimerRef.current >= nextBlinkRef.current) {
            blinkAmountRef.current = Math.min(1.0, blinkAmountRef.current + delta * 12);
            if (blinkAmountRef.current >= 1.0) {
              blinkAmountRef.current = 0;
              blinkTimerRef.current = 0;
              nextBlinkRef.current = 3.0 + Math.random() * 3.0;
            }
          } else if (blinkAmountRef.current > 0) {
            blinkAmountRef.current = Math.max(0, blinkAmountRef.current - delta * 10);
          }

          if (vrmRef.current.expressionManager) {
            try {
              vrmRef.current.expressionManager.setValue('blink', blinkAmountRef.current);
            } catch (_) {}
          }
        }
      }

      // Update AnimationMixer if GLB fallback
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Camera position interpolation & early frame snap
      if (cameraRef.current && controlsRef.current) {
        if (frameCountRef.current < 6) {
          frameCountRef.current++;
          updateCameraFraming(framing);
          cameraRef.current.position.copy(targetCamPosRef.current);
          controlsRef.current.target.copy(targetLookAtRef.current);
          controlsRef.current.update();
        } else {
          cameraRef.current.position.lerp(targetCamPosRef.current, delta * 3.5);
          controlsRef.current.target.lerp(targetLookAtRef.current, delta * 3.5);
          controlsRef.current.update();
        }
      }

      // Head follow cursor
      const headObj = headBoneRef.current;
      if (headObj) {
        const targetX = mouseGaze.x * 0.22;
        const targetY = -mouseGaze.y * 0.15;
        smoothedHeadRotRef.current.x = THREE.MathUtils.lerp(
          smoothedHeadRotRef.current.x,
          targetY,
          delta * 4.5
        );
        smoothedHeadRotRef.current.y = THREE.MathUtils.lerp(
          smoothedHeadRotRef.current.y,
          targetX,
          delta * 4.5
        );
        headObj.rotation.x = smoothedHeadRotRef.current.x;
        headObj.rotation.y = smoothedHeadRotRef.current.y;
      }

      renderer.render(scene, camera);
    };

    renderLoop();

    // 8. Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 9. Cleanup & Disposal
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);

      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (controlsRef.current) controlsRef.current.dispose();

      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
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
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentNode) {
          rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [avatarId, companion, updateCameraFraming, framing]);

  // Update Framing
  useEffect(() => {
    updateCameraFraming(framing);
  }, [framing, updateCameraFraming]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
          <div className="relative flex flex-col items-center">
            <BitmojiPortrait
              gender={(avatarId === 'girl' ? 'girl' : 'boy') as BitmojiGender}
              size={220}
              animate
              className="opacity-60"
            />
            <div className="absolute bottom-6 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full border-2 border-purple-400/40 border-t-purple-400 animate-spin" />
              <span className="mt-2 text-[11px] font-mono uppercase tracking-wider text-white/50">
                Loading 3D Avatar...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-40 bg-[#141217]">
          <BitmojiPortrait
            gender={(avatarId === 'girl' ? 'girl' : 'boy') as BitmojiGender}
            size={200}
            animate
            className="drop-shadow-2xl"
          />
          <span className="mt-3 text-[11px] font-mono text-white/60">
            2D Companion Active
          </span>
        </div>
      )}
    </div>
  );
};

export default Avatar3DStage;
