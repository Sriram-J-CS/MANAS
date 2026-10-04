/**
 * MANAS Avatar3DStage
 * Production Three.js 3D Avatar Stage.
 * - Real GLB loading via manifest (/public/avatars/<id>/avatar.json)
 * - Soft three-point lighting + rim light + ACES tone mapping + contact ground shadow
 * - Auto-framing camera (Full-body default vs Bust toggle)
 * - Limited orbit (±35° azimuth)
 * - Head and eyes follow cursor with natural damping
 * - AnimationMixer with crossfades (idle hands clasped, gestures, breathing guide)
 * - FaceDriver with ARKit 52 emotion presets & Oculus visemes
 * - Cap DPR, window resize handler, full resource disposal on unmount
 * - Error boundary: clear developer error banner + 2D placeholder fallback (never generated primitives)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FaceDriver, type AvatarEmotion } from '../../lib/avatar/FaceDriver';
import { validateAvatarModel, type AvatarValidationReport } from '../../lib/avatar/assetValidator';
import type { AvatarGesture, AvatarState } from '../../lib/avatar/speechPerformance';
import { BitmojiPortrait, type BitmojiGender } from './BitmojiPortrait';

export type CameraFraming = 'full_body' | 'bust';

export interface Avatar3DStageProps {
  avatarId?: 'boy' | 'girl' | string;
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
  avatarId = 'boy',
  emotion = 'calm',
  activeGesture = 'idle',
  state = 'idle',
  framing = 'full_body',
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

  // Avatar subsystems
  const onValidationCompleteRef = useRef(onValidationComplete);
  onValidationCompleteRef.current = onValidationComplete;
  const faceDriverRef = useRef<FaceDriver | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);

  // Dynamic mesh & material references for tinting and modular parts
  const meshMapRef = useRef<Map<string, THREE.Mesh | THREE.SkinnedMesh>>(new Map());
  const skinMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const hairMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const clothesMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Camera targets for smooth animation between full_body and bust
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.1, 2.4));
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.0, 0));

  // Current smoothed head rotation for mouse tracking
  const smoothedHeadRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * Updates camera framing based on avatar bounding box and head position
   */
  const updateCameraFraming = useCallback((mode: CameraFraming) => {
    if (!headBoneRef.current || !cameraRef.current) return;

    const headWorldPos = new THREE.Vector3();
    headBoneRef.current.getWorldPosition(headWorldPos);

    if (mode === 'bust') {
      // Zoom into head and chest
      targetCamPosRef.current.set(0, headWorldPos.y - 0.05, 0.85);
      targetLookAtRef.current.set(0, headWorldPos.y - 0.04, 0);
    } else {
      // Full body framing: see from top of head down to shoes
      targetCamPosRef.current.set(0, headWorldPos.y * 0.62, 2.35);
      targetLookAtRef.current.set(0, headWorldPos.y * 0.58, 0);
    }
  }, []);

  /**
   * Animation crossfade helper
   */
  const playAnimation = useCallback((clipName: string, duration = 0.35) => {
    const nextAction = actionsRef.current.get(clipName) || actionsRef.current.get('idle');
    if (!nextAction || nextAction === currentActionRef.current) return;

    const prevAction = currentActionRef.current;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (prevAction) {
      prevAction.crossFadeTo(nextAction, duration, true);
    }

    currentActionRef.current = nextAction;
  }, []);

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

    // 2. Setup Camera
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.1, 2.4);
    cameraRef.current = camera;

    // 3. Setup Renderer with ACES Filmic Tone Mapping
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
    // Ambient Warm Light
    const ambientLight = new THREE.AmbientLight(0xfffdf7, 0.85);
    scene.add(ambientLight);

    // Key Light (Warm, casts soft shadow)
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
    keyLight.position.set(1.8, 3.2, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    // Fill Light (Cool, diffuse)
    const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.50);
    fillLight.position.set(-2.2, 1.8, 1.8);
    scene.add(fillLight);

    // Rim Light (Creates gentle silhouette highlight on hair and shoulders)
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.20);
    rimLight.position.set(0, 2.5, -2.2);
    scene.add(rimLight);

    // Ground Contact Shadow plane under feet
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, 'rgba(10, 10, 10, 0.38)');
      grad.addColorStop(0.5, 'rgba(10, 10, 10, 0.12)');
      grad.addColorStop(1, 'rgba(10, 10, 10, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.002;
    scene.add(contactShadow);

    // 5. OrbitControls with limited orbit (about ±35° azimuth)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minAzimuthAngle = -0.61; // approx -35°
    controls.maxAzimuthAngle = 0.61;  // approx +35°
    controls.minPolarAngle = Math.PI / 2 - 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.minDistance = 0.6;
    controls.maxDistance = 3.5;
    controlsRef.current = controls;

    // 6. Load Manifest & GLB Model
    const manifestUrl = `/avatars/${avatarId}/avatar.json`;
    const modelUrl = `/avatars/${avatarId}/${avatarId}.glb`;

    fetch(manifestUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Avatar manifest not found at ${manifestUrl} (HTTP ${res.status}). Ensure assets are exported to /public/avatars/${avatarId}/`
          );
        }
        return res.json();
      })
      .then((_manifest) => {
        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            if (isDisposed) return;

            // Run Asset Validator
            const report = validateAvatarModel(avatarId, gltf);
            onValidationCompleteRef.current?.(report);

            const model = gltf.scene;
            modelRootRef.current = model;
            scene.add(model);

            // Index meshes and materials
            meshMapRef.current.clear();
            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                meshMapRef.current.set(m.name, m);
                m.castShadow = true;
                m.receiveShadow = true;

                if (m.name === 'head') {
                  faceDriverRef.current = new FaceDriver(m);
                }

                // Cache materials
                const mat = m.material as THREE.MeshStandardMaterial;
                if (mat) {
                  if (mat.name === 'mat_skin') skinMaterialRef.current = mat;
                  if (mat.name === 'mat_hair') hairMaterialRef.current = mat;
                  if (mat.name === 'mat_clothes') clothesMaterialRef.current = mat;
                }
              }

              if ((child as THREE.Bone).isBone) {
                if (child.name === 'Head') headBoneRef.current = child as THREE.Bone;
                if (child.name === 'Neck') neckBoneRef.current = child as THREE.Bone;
              }
            });

            // Setup AnimationMixer
            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(model);
              mixerRef.current = mixer;
              actionsRef.current.clear();

              gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                actionsRef.current.set(clip.name, action);
              });

              // Start default idle animation (hands clasped in front, breathing loop)
              const idleAction = actionsRef.current.get('idle');
              if (idleAction) {
                idleAction.play();
                currentActionRef.current = idleAction;
              }
            }

            // Auto-frame camera based on loaded model
            updateCameraFraming(framing);
            setLoading(false);
          },
          undefined,
          (err: any) => {
            if (isDisposed) return;
            console.error('Failed to load avatar GLB:', err);
            setLoadError(`Failed to load avatar GLB from ${modelUrl}: ${err?.message || err}`);
            setLoading(false);
          }
        );
      })
      .catch((err: any) => {
        if (isDisposed) return;
        console.error('Failed to load avatar manifest:', err);
        setLoadError(err?.message || 'Manifest load failure');
        setLoading(false);
      });

    // 7. Render Loop
    const clock = new THREE.Clock();
    const renderLoop = () => {
      frameIdRef.current = requestAnimationFrame(renderLoop);

      const delta = clock.getDelta();

      // Update AnimationMixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Update FaceDriver (emotions, blinks, micro-saccades, visemes)
      if (faceDriverRef.current) {
        faceDriverRef.current.update(delta);
      }

      // Smooth camera position interpolation
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerp(targetCamPosRef.current, delta * 3.5);
        controlsRef.current.target.lerp(targetLookAtRef.current, delta * 3.5);
        controlsRef.current.update();
      }

      // Head and Eyes follow cursor
      if (headBoneRef.current) {
        const targetX = mouseGaze.x * 0.28;
        const targetY = -mouseGaze.y * 0.20;

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

        headBoneRef.current.rotation.x = smoothedHeadRotRef.current.x;
        headBoneRef.current.rotation.y = smoothedHeadRotRef.current.y;
      }

      renderer.render(scene, camera);
    };

    // Stable ref for validation callback to avoid infinite re-render loops
    onValidationCompleteRef.current = onValidationComplete;

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

      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (faceDriverRef.current) {
        faceDriverRef.current.dispose();
      }

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
  }, [avatarId]);

  // Update Framing
  useEffect(() => {
    updateCameraFraming(framing);
  }, [framing, updateCameraFraming]);

  // Update FaceDriver Emotion
  useEffect(() => {
    if (faceDriverRef.current) {
      faceDriverRef.current.setEmotion(emotion, 1.0, 350);
    }
  }, [emotion]);

  // Update Visemes during speech
  useEffect(() => {
    if (faceDriverRef.current) {
      faceDriverRef.current.setViseme(visemeWeights);
    }
  }, [visemeWeights]);

  // Update Gaze
  useEffect(() => {
    if (faceDriverRef.current) {
      faceDriverRef.current.setGaze(mouseGaze.x, mouseGaze.y);
    }
  }, [mouseGaze]);

  // Update Body Animation Gesture
  useEffect(() => {
    if (activeGesture) {
      playAnimation(activeGesture);
    }
  }, [activeGesture, playAnimation]);

  // Update Material Tints (Skin tone, Hair color, Outfit color)
  useEffect(() => {
    if (skinTone && skinMaterialRef.current) {
      skinMaterialRef.current.color.set(skinTone);
    }
    if (hairColor && hairMaterialRef.current) {
      hairMaterialRef.current.color.set(hairColor);
    }
    if (outfitColor && clothesMaterialRef.current) {
      clothesMaterialRef.current.color.set(outfitColor);
    }
  }, [skinTone, hairColor, outfitColor]);

  // Toggle Modular Parts (Hair style, Outfit, Glasses, Beard, Earrings)
  useEffect(() => {
    const meshes = meshMapRef.current;
    if (meshes.size === 0) return;

    // Hair styles
    if (hairStyle) {
      meshes.forEach((mesh, name) => {
        if (name.startsWith('hair_')) {
          mesh.visible = (name === `hair_${hairStyle}`);
        }
      });
    }

    // Outfits
    if (outfitType) {
      meshes.forEach((mesh, name) => {
        if (name.startsWith('outfit_')) {
          mesh.visible = (name === `outfit_${outfitType}`);
        }
      });
    }

    // Glasses
    if (glassesStyle !== undefined) {
      meshes.forEach((mesh, name) => {
        if (name.startsWith('glasses_')) {
          mesh.visible = (glassesStyle !== 'none' && name === `glasses_${glassesStyle}`);
        }
      });
    }

    // Beards
    if (beardStyle !== undefined) {
      meshes.forEach((mesh, name) => {
        if (name.startsWith('beard_')) {
          mesh.visible = (beardStyle !== 'none' && name === `beard_${beardStyle}`);
        }
      });
    }

    // Earrings
    if (earringsStyle !== undefined) {
      meshes.forEach((mesh, name) => {
        if (name.startsWith('earrings_')) {
          mesh.visible = (earringsStyle !== 'none' && name === `earrings_${earringsStyle}`);
        }
      });
    }
  }, [hairStyle, outfitType, glassesStyle, beardStyle, earringsStyle]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{ backgroundColor: '#141217' }}
    >
      {/* Loading State — Animated Bitmoji portrait behind spinner */}
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

      {/* Developer Error & Bitmoji 2D Fallback (Hard Rule: Never show primitive geometry) */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-40 bg-[#141217]">
          <div className="max-w-sm p-3 rounded-2xl bg-rose-950/60 border border-rose-700/40 text-rose-200 shadow-sm text-left mb-3">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-400 mb-1">
              <span>⚠️ 3D Asset Loading Error</span>
            </div>
            <p className="text-[11px] font-mono break-all opacity-80">{loadError}</p>
            <div className="mt-2 text-[10px] text-rose-500">
              Check <code>/public/avatars/{avatarId}/</code> for <code>avatar.json</code> and <code>{avatarId}.glb</code>.
            </div>
          </div>

          {/* 2D Animated Bitmoji Fallback */}
          <div className="flex flex-col items-center">
            <BitmojiPortrait
              gender={(avatarId === 'girl' ? 'girl' : 'boy') as BitmojiGender}
              size={200}
              animate
              className="drop-shadow-2xl"
            />
            <span className="mt-2 text-[10px] font-mono text-white/40">
              2D Bitmoji Companion Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
