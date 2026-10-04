import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MascotEmotion } from '../../lib/emotion/emotionEngine';
import { EMOTION_POSES } from '../../lib/emotion/emotionEngine';
import { findMorphTargetIndex } from '../../lib/mascot/blendshapeMap';

interface UploadedGLBMascotProps {
  url: string;
  emotion?: MascotEmotion;
  isSpeaking?: boolean;
  isListening?: boolean;
  isThinking?: boolean;
  audioEnergy?: number;
  mouseGaze?: { x: number; y: number };
  intensity?: number;
  onLoaded?: (object: THREE.Object3D, animations: THREE.AnimationClip[]) => void;
  onError?: (err: any) => void;
}

export const UploadedGLBMascot: React.FC<UploadedGLBMascotProps> = ({
  url,
  emotion = 'neutral',
  isSpeaking = false,
  isListening = false,
  isThinking = false,
  audioEnergy = 0,
  mouseGaze = { x: 0, y: 0 },
  intensity = 1.0,
  onLoaded,
  onError,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelSceneRef = useRef<THREE.Group | null>(null);

  // Mesh with morph targets
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);

  // Blinking timer
  const blinkTimerRef = useRef<number>(3.0);
  const isBlinkingRef = useRef<boolean>(false);
  const blinkProgressRef = useRef<number>(0);

  useEffect(() => {
    if (!url) return;

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const scene = gltf.scene;

        // Auto-center and normalize scale
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.6 / (maxDim || 1);
        scene.scale.setScalar(scale);

        // Center vertically so feet/base rests nicely above ground shadow
        const center = new THREE.Vector3();
        box.getCenter(center);
        scene.position.set(-center.x * scale, -center.y * scale + 0.1, -center.z * scale);

        // Enable shadows
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Collect meshes with morph targets
        const morphMeshes: THREE.Mesh[] = [];
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
            morphMeshes.push(child as THREE.Mesh);
          }
        });
        morphMeshesRef.current = morphMeshes;

        // Setup AnimationMixer if clips exist
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(scene);
          mixerRef.current = mixer;
          // Play first clip (usually idle)
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        modelSceneRef.current = scene;
        if (groupRef.current) {
          // Clear previous children safely
          while (groupRef.current.children.length > 0) {
            const child = groupRef.current.children[0];
            groupRef.current.remove(child);
          }
          groupRef.current.add(scene);
        }

        onLoaded?.(scene, gltf.animations || []);
      },
      undefined,
      (err) => {
        console.error('Failed to load uploaded 3D mascot:', err);
        onError?.(err);
      }
    );

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      if (modelSceneRef.current) {
        modelSceneRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).geometry.dispose();
            const mat = (child as THREE.Mesh).material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else if (mat) mat.dispose();
          }
        });
        modelSceneRef.current = null;
      }
    };
  }, [url]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);

    // Update animations if present
    if (mixerRef.current) {
      mixerRef.current.update(dt);
    }

    const pose = EMOTION_POSES[emotion] || EMOTION_POSES.neutral;

    // Procedural gentle floating and breathing
    if (groupRef.current) {
      const breath = Math.sin(state.clock.elapsedTime * 2.0 * (pose.movementSpeed || 1)) * 0.035;
      groupRef.current.position.y = -0.2 + breath;

      // Subtle rotation towards mouse cursor
      const targetRotY = (mouseGaze.x * 0.28 + (isThinking ? 0.15 : 0)) * intensity;
      const targetRotX = (-mouseGaze.y * 0.15 + pose.headTiltX + (isThinking ? -0.1 : isListening ? 0.06 : 0)) * intensity;
      const targetRotZ = (pose.headTiltZ + (isThinking ? 0.1 : 0)) * intensity;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, dt * 4);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, dt * 4);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, dt * 4);
    }

    // Handle Blendshapes / Morph Targets if model has them
    if (morphMeshesRef.current.length > 0) {
      // Blinking
      blinkTimerRef.current -= dt;
      if (blinkTimerRef.current <= 0 && !isBlinkingRef.current) {
        isBlinkingRef.current = true;
        blinkProgressRef.current = 0;
        blinkTimerRef.current = 2.8 + Math.random() * 3.0;
      }

      let blinkWeight = 0;
      if (isBlinkingRef.current) {
        blinkProgressRef.current += dt * 14.0;
        blinkWeight = Math.sin(Math.min(Math.PI, blinkProgressRef.current));
        if (blinkProgressRef.current >= Math.PI) {
          isBlinkingRef.current = false;
          blinkWeight = 0;
        }
      }

      // Talking lip sync
      let talkWeight = 0;
      if (isSpeaking) {
        const talkWave = Math.sin(state.clock.elapsedTime * 18) * 0.5 + 0.5;
        talkWeight = Math.max(audioEnergy, talkWave * 0.65);
      }

      morphMeshesRef.current.forEach((mesh) => {
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        const dict = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;

        // Blinking
        const blinkIdxL = findMorphTargetIndex(dict, ['eyeBlinkLeft', 'eyeBlink_L', 'blink_l', 'blink']);
        const blinkIdxR = findMorphTargetIndex(dict, ['eyeBlinkRight', 'eyeBlink_R', 'blink_r', 'blink']);
        if (blinkIdxL !== null) inf[blinkIdxL] = blinkWeight;
        if (blinkIdxR !== null) inf[blinkIdxR] = blinkWeight;

        // Smiling
        const smileIdx = findMorphTargetIndex(dict, ['mouthSmile', 'mouth_smile', 'Smile', 'smile']);
        if (smileIdx !== null) inf[smileIdx] = THREE.MathUtils.lerp(inf[smileIdx], pose.smile, dt * 6);

        // Frowning
        const frownIdx = findMorphTargetIndex(dict, ['mouthFrown', 'mouth_frown', 'Frown', 'frown']);
        if (frownIdx !== null) inf[frownIdx] = THREE.MathUtils.lerp(inf[frownIdx], pose.frown, dt * 6);

        // Mouth Open for talking
        const mouthOpenIdx = findMorphTargetIndex(dict, ['mouthOpen', 'jawOpen', 'mouth_open', 'MouthOpen', 'A', 'aa']);
        if (mouthOpenIdx !== null) inf[mouthOpenIdx] = THREE.MathUtils.lerp(inf[mouthOpenIdx], talkWeight, dt * 12);
      });
    }
  });

  return (
    <group>
      <group ref={groupRef} position={[0, -0.2, 0]} />
      {/* Ground Shadow */}
      <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.75, 48]} />
        <meshBasicMaterial color="#0A0A0A" transparent opacity={0.12} />
      </mesh>
    </group>
  );
};
