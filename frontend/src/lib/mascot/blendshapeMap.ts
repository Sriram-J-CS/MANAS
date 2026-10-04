import * as THREE from 'three';

export interface MascotCompatibility {
  hasModel: boolean;
  hasAnimations: boolean;
  hasFacialRig: boolean;
  hasExpressions: boolean;
  hasTalking: boolean;
  morphTargetNames: string[];
  animationClipNames: string[];
  explanation?: string;
}

// Canonical blendshape mappings across common formats (ARKit, Ready Player Me, VRoid, Blender custom)
const EYE_BLINK_NAMES = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeBlink_L', 'eyeBlink_R', 'blink', 'Blink', 'Eyes_Blink', 'blink_l', 'blink_r', 'Fcl_EYE_Close'];
const MOUTH_SMILE_NAMES = ['mouthSmile', 'mouthSmileLeft', 'mouthSmileRight', 'mouth_smile', 'Smile', 'smile', 'Fcl_MTH_Smile', 'Joy'];
const MOUTH_FROWN_NAMES = ['mouthFrown', 'mouthFrownLeft', 'mouthFrownRight', 'mouth_frown', 'Frown', 'frown', 'Fcl_MTH_Sorrow', 'Sorrow'];
const MOUTH_OPEN_NAMES = ['mouthOpen', 'jawOpen', 'mouth_open', 'MouthOpen', 'A', 'aa', 'Fcl_MTH_A', 'viseme_aa', 'viseme_O'];
const BROW_UP_NAMES = ['browUpLeft', 'browUpRight', 'browOuterUpLeft', 'browOuterUpRight', 'brow_up', 'BrowsUp', 'Fcl_BRW_Surprised'];

export function analyzeModelCompatibility(object3d: THREE.Object3D, animations: THREE.AnimationClip[] = []): MascotCompatibility {
  const morphNamesSet = new Set<string>();

  object3d.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.morphTargetDictionary) {
        Object.keys(mesh.morphTargetDictionary).forEach((name) => morphNamesSet.add(name));
      }
    }
  });

  const morphTargetNames = Array.from(morphNamesSet);
  const animationClipNames = animations.map((c) => c.name);

  const hasBlink = morphTargetNames.some((m) => EYE_BLINK_NAMES.some((k) => m.toLowerCase().includes(k.toLowerCase())));
  const hasBrow = morphTargetNames.some((m) => BROW_UP_NAMES.some((k) => m.toLowerCase().includes(k.toLowerCase())));
  const hasSmileOrFrown = morphTargetNames.some((m) =>
    [...MOUTH_SMILE_NAMES, ...MOUTH_FROWN_NAMES].some((k) => m.toLowerCase().includes(k.toLowerCase()))
  );
  const hasTalking = morphTargetNames.some((m) => MOUTH_OPEN_NAMES.some((k) => m.toLowerCase().includes(k.toLowerCase())));

  const hasFacialRig = morphTargetNames.length > 0;
  const hasExpressions = hasSmileOrFrown || hasBlink || hasBrow || morphTargetNames.length >= 3;
  const hasAnimations = animations.length > 0;

  let explanation: string | undefined;
  if (!hasFacialRig) {
    explanation = "Your model doesn't contain facial animation data. Facial expressions require a rigged model with blendshapes or morph targets. MANAS will use smooth procedural head tilting and floating movement instead.";
  }

  return {
    hasModel: true,
    hasAnimations,
    hasFacialRig,
    hasExpressions,
    hasTalking,
    morphTargetNames,
    animationClipNames,
    explanation,
  };
}

/**
 * Finds the index of a morph target across candidate names
 */
export function findMorphTargetIndex(dict: { [key: string]: number }, candidateNames: string[]): number | null {
  for (const candidate of candidateNames) {
    if (dict[candidate] !== undefined) return dict[candidate];
    const lowerCand = candidate.toLowerCase();
    for (const key of Object.keys(dict)) {
      if (key.toLowerCase() === lowerCand || key.toLowerCase().includes(lowerCand)) {
        return dict[key];
      }
    }
  }
  return null;
}
