import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { VRMLipSync } from '../../lib/avatar/vrmLipSync';
import { speechEngine } from '../../lib/voice/speechEngine';

export type MascotEmotion = 'calm' | 'empathetic' | 'encouraging' | 'concerned' | 'happy' | 'sad' | 'surprised' | 'neutral' | string;
export type MascotGesture = 'idle' | 'wave' | 'nod' | 'breathe' | 'thumbs_up' | 'base';

export interface VRMAvatarProps {
  gender?: 'boy' | 'girl';
  outfit?: string;
  emotion?: MascotEmotion;
  gesture?: MascotGesture | string;
  isSpeaking?: boolean;
  isUserTyping?: boolean;
  isThinking?: boolean;
  audioEnergy?: number;
  mousePos?: { x: number; y: number };
  onLoaded?: () => void;
  onError?: (err: any) => void;
  onWaveEnd?: () => void;
}

// Preset outfit color palettes for clothing material customization
const OUTFIT_COLOR_THEMES: Record<string, { main: number; accent: number; roughness: number }> = {
  yellow_tshirt: { main: 0xf59e0b, accent: 0xd97706, roughness: 0.6 },
  hoodie: { main: 0x8b5cf6, accent: 0x7c3aed, roughness: 0.7 },
  formal: { main: 0x1e293b, accent: 0x334155, roughness: 0.4 },
  kurta_saree: { main: 0x0d9488, accent: 0x0f766e, roughness: 0.5 },
  sports: { main: 0xe11d48, accent: 0xbe123c, roughness: 0.5 },
  pyjamas: { main: 0x64748b, accent: 0x475569, roughness: 0.8 },
  festive: { main: 0xd97706, accent: 0xb45309, roughness: 0.35 },
};

/**
 * Inner 3D VRM Model component rendered inside R3F Canvas
 */
function VRMModelInner({
  gender = 'boy',
  outfit = 'yellow_tshirt',
  emotion = 'calm',
  gesture = 'idle',
  isSpeaking = false,
  isUserTyping = false,
  isThinking = false,
  audioEnergy = 0,
  mousePos = { x: 0, y: 0 },
  onLoaded,
  onError,
  onWaveEnd,
}: VRMAvatarProps) {
  const { scene, camera } = useThree();
  const vrmRef = useRef<VRM | null>(null);
  const lipSyncRef = useRef<VRMLipSync>(new VRMLipSync());

  const headHeightRef = useRef<number>(1.35);

  // Upper-body framing: aimed at head bone at head height, FOV ~30
  useEffect(() => {
    const headY = headHeightRef.current;
    camera.position.set(0, headY - 0.02, 1.48);
    camera.lookAt(0, headY - 0.02, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 30;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  // Original materials cache for outfit swapping and clean resets
  const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map());

  // Expression crossfade state (400ms transition)
  const currentExprWeights = useRef<{
    happy: number;
    sad: number;
    relaxed: number;
    surprised: number;
  }>({ happy: 0, sad: 0, relaxed: 0, surprised: 0 });

  const targetExprWeights = useRef<{
    happy: number;
    sad: number;
    relaxed: number;
    surprised: number;
  }>({ happy: 0, sad: 0, relaxed: 0, surprised: 0 });

  // Blinking state
  const blinkTimerRef = useRef<number>(0);
  const nextBlinkRef = useRef<number>(3.0 + Math.random() * 3.0);
  const blinkAmountRef = useRef<number>(0);

  // Procedural wave state
  const isWavingRef = useRef<boolean>(false);
  const waveTimeRef = useRef<number>(0);
  const waveDuration = 2.4;

  // Trigger wave when gesture changes to 'wave'
  useEffect(() => {
    if (gesture === 'wave') {
      isWavingRef.current = true;
      waveTimeRef.current = 0;
    } else if (gesture === 'base') {
      isWavingRef.current = false;
      waveTimeRef.current = 0;
    }
  }, [gesture]);

  // Compute target expression weights based on LLM emotion
  useEffect(() => {
    const e = emotion.toLowerCase();
    const t = { happy: 0, sad: 0, relaxed: 0, surprised: 0 };

    if (e === 'empathetic') {
      t.relaxed = 0.45;
      t.happy = 0.35;
    } else if (e === 'encouraging') {
      t.happy = 0.75;
      t.surprised = 0.15;
    } else if (e === 'concerned') {
      t.sad = 0.4;
      t.relaxed = 0.2;
    } else if (e === 'happy') {
      t.happy = 0.7;
    } else if (e === 'sad') {
      t.sad = 0.55;
    } else if (e === 'surprised') {
      t.surprised = 0.65;
    } else {
      // 'calm' / neutral default
      t.relaxed = 0.35;
      t.happy = 0.1;
    }

    targetExprWeights.current = t;
  }, [emotion]);

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Primary model loader
  useEffect(() => {
    let isDisposed = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const modelPath = `/avatar/${gender}.vrm`;
    const fallbackPath = '/avatars/mental%20health%20chatbot%203d%20avtar.vrm';

    const loadModel = (url: string, isFallback = false) => {
      console.log('[VRMAvatar] loadModel start:', url);
      loader.load(
        url,
        (gltf) => {
          console.log('[VRMAvatar] gltf received for:', url);
          if (isDisposed) return;
          const vrm = gltf.userData.vrm as VRM;
          console.log('[VRMAvatar] vrm instance exists:', !!vrm, 'metaVersion:', vrm?.meta?.metaVersion);
          if (!vrm) {
            console.warn('[VRMAvatar] Not a valid VRM, trying fallback...');
            if (!isFallback) {
              loadModel(fallbackPath, true);
            } else {
              onErrorRef.current?.(new Error('Loaded asset is not a valid VRM.'));
            }
            return;
          }

          try {
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
          } catch (_) {}

          // 1. Model orientation check:
          // If VRM is v0.x, call VRMUtils.rotateVRM0(vrm).
          // Else rotate the scene by Math.PI if it faces away from the camera (+Z).
          if (vrm.meta?.metaVersion === '0') {
            VRMUtils.rotateVRM0(vrm);
          } else {
            vrm.scene.updateMatrixWorld(true);
            const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
            if (headNode) {
              const headQuat = new THREE.Quaternion();
              headNode.getWorldQuaternion(headQuat);
              const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(headQuat);
              if (forward.z < 0) {
                vrm.scene.rotation.y += Math.PI;
              }
            }
          }

          // Auto-calculate bounds and center the avatar
          const box = new THREE.Box3().setFromObject(vrm.scene);
          const size = box.getSize(new THREE.Vector3());
          // Standard human avatar height (1.55m) for perfect portrait chest-up framing
          const targetHeight = 1.55;
          if (size.y > 0) {
            vrm.scene.scale.setScalar(targetHeight / size.y);
          }

          const scaledBox = new THREE.Box3().setFromObject(vrm.scene);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          vrm.scene.position.x -= scaledCenter.x;
          vrm.scene.position.y -= scaledBox.min.y;
          vrm.scene.position.z -= scaledCenter.z;

          vrm.scene.updateMatrixWorld(true);

          // 2. Camera upper-body framing aimed at head bone
          const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
          if (headBone) {
            const headPos = new THREE.Vector3();
            headBone.getWorldPosition(headPos);
            headHeightRef.current = headPos.y;
            camera.position.set(0, headPos.y - 0.02, 1.48);
            camera.lookAt(0, headPos.y - 0.02, 0);
            if ('fov' in camera) {
              (camera as THREE.PerspectiveCamera).fov = 30;
              camera.updateProjectionMatrix();
            }
          }

          // Enable shadows and cache original materials
          originalMaterialsRef.current.clear();
          vrm.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((mat, idx) => {
                    originalMaterialsRef.current.set(`${mesh.uuid}_${idx}`, mat.clone());
                  });
                } else {
                  originalMaterialsRef.current.set(mesh.uuid, mesh.material.clone());
                }
              }
            }
          });

          // Remove any previous model from scene
          if (vrmRef.current) {
            scene.remove(vrmRef.current.scene);
          }

          vrmRef.current = vrm;
          scene.add(vrm.scene);
          console.log('[VRMAvatar] Model added to scene successfully!');
          onLoadedRef.current?.();
        },
        undefined,
        (err) => {
          console.error('[VRMAvatar] loadModel error:', err, 'url:', url);
          if (!isFallback) {
            loadModel(fallbackPath, true);
          } else {
            console.error('Failed to load VRM model:', err);
            onErrorRef.current?.(err);
          }
        }
      );
    };

    loadModel(modelPath);

    return () => {
      isDisposed = true;
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current = null;
      }
    };
  }, [gender, scene]);

  // Handle outfit material swapper
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    if (gesture === 'base' || outfit === 'base' || outfit === 'yellow_tshirt') {
      // Restore pristine base materials
      vrm.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((_, idx) => {
              const orig = originalMaterialsRef.current.get(`${mesh.uuid}_${idx}`);
              return orig ? orig.clone() : mesh.material[idx];
            });
          } else if (mesh.material) {
            const orig = originalMaterialsRef.current.get(mesh.uuid);
            if (orig) {
              mesh.material = orig.clone();
            }
          }
        }
      });
      return;
    }

    const theme = OUTFIT_COLOR_THEMES[outfit];
    if (!theme) return;

    // Apply themed clothing material tint to clothing meshes & materials while preserving face/skin/eyes/hair
    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const meshName = (mesh.name || '').toLowerCase();

        const updateMaterial = (mat: any, origKey?: string) => {
          if (!mat) return mat;
          const matName = (mat.name || '').toLowerCase();
          const isClothing =
            matName.includes('cloth') ||
            matName.includes('top') ||
            matName.includes('bottom') ||
            matName.includes('hoodie') ||
            matName.includes('shirt') ||
            matName.includes('pant') ||
            matName.includes('dress') ||
            matName.includes('jacket') ||
            matName.includes('outfit') ||
            meshName.includes('cloth');

          const isExcluded =
            matName.includes('skin') ||
            matName.includes('face') ||
            matName.includes('eye') ||
            matName.includes('hair') ||
            meshName.includes('face') ||
            meshName.includes('hair');

          if (isClothing && !isExcluded) {
            const orig = origKey ? originalMaterialsRef.current.get(origKey) : null;
            const newMat = (orig ? orig.clone() : mat.clone());
            if ('color' in newMat && newMat.color?.setHex) {
              newMat.color.setHex(theme.main);
            }
            if ('shadeColorFactor' in newMat && newMat.shadeColorFactor?.setHex) {
              newMat.shadeColorFactor.setHex(theme.accent);
            }
            if ('roughness' in newMat) {
              newMat.roughness = theme.roughness;
            }
            return newMat;
          }
          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat, idx) => updateMaterial(mat, `${mesh.uuid}_${idx}`));
        } else if (mesh.material) {
          mesh.material = updateMaterial(mesh.material, mesh.uuid);
        }
      }
    });
  }, [outfit, gesture]);

  // Main animation frame loop (60fps)
  useFrame((_, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    const time = performance.now() * 0.001;

    // Update VRM springs, physics, and constraints
    vrm.update(delta);

    // 1. Procedural Humanoid Bone Animation (Idle, Breathing, Weight Shift, Arm Rig, Wave, Expressions)
    const humanoid = vrm.humanoid;
    if (humanoid) {
      const head = humanoid.getNormalizedBoneNode('head');
      const neck = humanoid.getNormalizedBoneNode('neck');
      const chest = humanoid.getNormalizedBoneNode('chest');
      const spine = humanoid.getNormalizedBoneNode('spine');
      const hips = humanoid.getNormalizedBoneNode('hips');
      const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
      const leftHand = humanoid.getNormalizedBoneNode('leftHand');
      const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
      const rightHand = humanoid.getNormalizedBoneNode('rightHand');

      // Small breathing motion & weight shift
      const breath = Math.sin(time * 1.5);
      const sway = Math.sin(time * 0.7);
      const swayCos = Math.cos(time * 0.5);

      // Natural breathing on chest
      if (chest) {
        chest.rotation.x = breath * 0.022;
      }

      // Small weight shift and breathing on spine & hips
      if (spine) {
        spine.rotation.z = sway * 0.012;
        spine.rotation.y = swayCos * 0.015;
        spine.rotation.x = breath * 0.008;
      }
      if (hips) {
        hips.rotation.z = sway * 0.006;
        hips.position.x = sway * 0.004;
      }

      // Natural Head Gaze Tracking & Microsaccades
      const gazeX = mousePos.x * 0.18;
      const gazeY = -mousePos.y * 0.12;

      if (head) {
        if (isThinking) {
          // Thinking state: looks away slightly (up and to the side)
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, -0.18, delta * 4);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -0.08, delta * 4);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0.04, delta * 4);
        } else if (isUserTyping) {
          // Listening state: attentive forward tilt and gentle micro-nod
          const listenNod = Math.sin(time * 3.2) * 0.035;
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX, delta * 5);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0.07 + listenNod, delta * 5);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0.04, delta * 5);
        } else if (isSpeaking) {
          // Speaking state: subtle rhythmic head inflections
          const speechBob = Math.sin(time * 4.5) * 0.02 * Math.min(1, audioEnergy * 2);
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX + Math.sin(time * 2.2) * 0.02, delta * 6);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, gazeY + speechBob, delta * 6);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, delta * 4);
        } else {
          // Idle state: gentle gaze tracking and small head movement
          const idleHeadX = Math.sin(time * 0.6) * 0.02;
          const idleHeadY = Math.cos(time * 0.45) * 0.025;
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gazeX + idleHeadY, delta * 4);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, gazeY + idleHeadX, delta * 4);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, delta * 4);
        }
      }

      if (neck) {
        neck.rotation.y = head ? head.rotation.y * 0.35 : 0;
      }

      // Natural Idle Pose:
      // Left Arm: rotate upperArm ~70 deg down (z ~ -1.2 rad), slight elbow bend, relaxed hand
      if (leftUpperArm) {
        leftUpperArm.rotation.z = -1.22 + breath * 0.008;
        leftUpperArm.rotation.x = 0.08 + breath * 0.01;
        leftUpperArm.rotation.y = 0.05;
      }
      if (leftLowerArm) {
        leftLowerArm.rotation.y = -0.32;
        leftLowerArm.rotation.z = -0.06;
      }
      if (leftHand) {
        leftHand.rotation.z = -0.06;
        leftHand.rotation.x = 0.06;
        leftHand.rotation.y = -0.04;
      }

      // Procedural Wave Animation (Right Arm) or Natural Idle Pose
      if (isWavingRef.current) {
        waveTimeRef.current += delta;
        const progress = waveTimeRef.current / waveDuration;

        if (progress < 1.0) {
          const envelope = Math.sin(progress * Math.PI); // Smooth in and out
          if (rightUpperArm) {
            rightUpperArm.rotation.z = THREE.MathUtils.lerp(1.22, -1.45, envelope);
            rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.28, envelope);
            rightUpperArm.rotation.y = THREE.MathUtils.lerp(-0.05, 0, envelope);
          }
          if (rightLowerArm) {
            rightLowerArm.rotation.y = THREE.MathUtils.lerp(0.32, 1.25, envelope);
            rightLowerArm.rotation.z = THREE.MathUtils.lerp(0.06, 0, envelope);
          }
          if (rightHand) {
            // Fast hand oscillation
            rightHand.rotation.z = Math.sin(time * 12) * 0.35 * envelope;
          }
        } else {
          isWavingRef.current = false;
          waveTimeRef.current = 0;
          onWaveEnd?.();
        }
      } else {
        // Right Arm Idle Pose: rotate upperArm ~70 deg down (z ~ +1.2 rad), slight elbow bend, relaxed hand
        if (rightUpperArm) {
          rightUpperArm.rotation.z = 1.22 - breath * 0.008;
          rightUpperArm.rotation.x = 0.08 + breath * 0.01;
          rightUpperArm.rotation.y = -0.05;
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.y = 0.32;
          rightLowerArm.rotation.z = 0.06;
        }
        if (rightHand) {
          rightHand.rotation.z = 0.06;
          rightHand.rotation.x = 0.06;
          rightHand.rotation.y = 0.04;
        }
      }
    }

    // 2. Random Blinking (every 3-6s, 150ms duration)
    blinkTimerRef.current += delta;
    if (blinkTimerRef.current >= nextBlinkRef.current) {
      blinkAmountRef.current = Math.min(1.0, blinkAmountRef.current + delta * 12);
      if (blinkAmountRef.current >= 1.0) {
        blinkAmountRef.current = 0;
        blinkTimerRef.current = 0;
        nextBlinkRef.current = 3.0 + Math.random() * 3.5;
      }
    } else if (blinkAmountRef.current > 0) {
      blinkAmountRef.current = Math.max(0, blinkAmountRef.current - delta * 10);
    }

    if (vrm.expressionManager) {
      try {
        vrm.expressionManager.setValue('blink', blinkAmountRef.current);
      } catch (_) {}
    }

    // 3. 400ms Expression Crossfade
    const exprFactor = 1 - Math.exp(-delta * 7.5); // ~400ms transition
    const cur = currentExprWeights.current;
    const tgt = targetExprWeights.current;

    cur.happy = THREE.MathUtils.lerp(cur.happy, tgt.happy, exprFactor);
    cur.sad = THREE.MathUtils.lerp(cur.sad, tgt.sad, exprFactor);
    cur.relaxed = THREE.MathUtils.lerp(cur.relaxed, tgt.relaxed, exprFactor);
    cur.surprised = THREE.MathUtils.lerp(cur.surprised, tgt.surprised, exprFactor);

    if (vrm.expressionManager) {
      try {
        vrm.expressionManager.setValue('happy', cur.happy);
        vrm.expressionManager.setValue('sad', cur.sad);
        vrm.expressionManager.setValue('relaxed', cur.relaxed);
        vrm.expressionManager.setValue('surprised', cur.surprised);
      } catch (_) {}
    }

    // 4. Web Audio AnalyserNode Damped Lip-Sync
    const analyser = speechEngine.getAnalyserNode();
    lipSyncRef.current.update(vrm, delta, isSpeaking, audioEnergy, analyser, time);
  });

  return null;
}

/**
 * Main VRMAvatarCanvas wrapper
 */
export const VRMAvatarCanvas: React.FC<VRMAvatarProps> = (props) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTabVisible, setIsTabVisible] = useState<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Tab visibility listener: pause render loop when tab is hidden
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

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full min-h-[340px] select-none overflow-hidden"
      aria-label="3D AI Companion Avatar Canvas"
    >
      <Canvas
        camera={{ position: [0, 1.33, 1.48], fov: 30 }}
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
        frameloop={isTabVisible ? 'always' : 'never'}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        shadows
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          pointerEvents: 'auto',
        }}
      >
        {/* Studio Lighting */}
        <hemisphereLight args={['#FFFFFF', '#D8D0C4', 1.8]} />

        {/* Warm Key Light directly illuminating face and shoulders */}
        <directionalLight
          position={[1.2, 2.5, 2.8]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />

        {/* Soft Violet/Lavender Fill Light */}
        <directionalLight position={[-3, 1.5, 2]} intensity={0.9} color="#CFC5FF" />

        {/* Rim / Back Light for silhouette definition */}
        <directionalLight position={[0, 3, -3]} intensity={1.2} color="#FCE7F3" />

        {/* Soft Contact Shadow Plane */}
        <mesh
          position={[0, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[2.5, 2.5]} />
          <shadowMaterial opacity={0.18} />
        </mesh>

        <VRMModelInner {...props} mousePos={mousePos} />
      </Canvas>
    </div>
  );
};

export default VRMAvatarCanvas;
