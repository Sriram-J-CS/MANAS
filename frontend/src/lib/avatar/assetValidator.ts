/**
 * MANAS 3D Avatar Asset Validator
 * Validates GLTF / GLB models against exact requirements:
 * 1. 52 ARKit blendshapes (exact names)
 * 2. 15 Oculus visemes (viseme_sil, PP, FF, etc.)
 * 3. 8 Face-shape morph targets (faceWidth, jawWidth, etc.)
 * 4. Humanoid Mixamo-compatible skeleton (22 bones)
 * 5. Required separate meshes (head, body, hair, eyes, teeth_tongue, clothes)
 * 6. Triangle budget (< 40,000)
 */

import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const REQUIRED_ARKIT_BLENDSHAPES: string[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];

export const REQUIRED_OCULUS_VISEMES: string[] = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
];

export const REQUIRED_FACE_SHAPES: string[] = [
  'faceWidth', 'jawWidth', 'chinLength', 'cheekFullness',
  'noseSize', 'eyeSize', 'eyeSpacing', 'browThickness'
];

export const REQUIRED_MIXAMO_BONES: string[] = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'
];

export const REQUIRED_MESH_PARTS: string[] = [
  'head', 'body', 'hair', 'eyes', 'teeth_tongue', 'clothes'
];

export interface ValidationSectionReport {
  title: string;
  totalRequired: number;
  totalFound: number;
  passed: boolean;
  present: string[];
  missing: string[];
}

export interface AvatarValidationReport {
  avatarId: string;
  passed: boolean;
  triangleCount: number;
  triangleBudgetPassed: boolean;
  maxTriangleBudget: number;
  arkitReport: ValidationSectionReport;
  oculusReport: ValidationSectionReport;
  faceShapesReport: ValidationSectionReport;
  skeletonReport: ValidationSectionReport;
  meshesReport: ValidationSectionReport;
  animationsFound: string[];
  allFoundMorphs: string[];
  timestamp: string;
}

/**
 * Validates a loaded Three.js GLTF scene against all requirements
 */
export function validateAvatarModel(avatarId: string, gltf: GLTF): AvatarValidationReport {
  const scene = gltf.scene;
  let totalTriangles = 0;

  const foundMeshNames = new Set<string>();
  const foundMorphNames = new Set<string>();
  const foundBoneNames = new Set<string>();

  scene.traverse((obj) => {
    if ((obj as THREE.Bone).isBone || obj.type === 'Bone') {
      foundBoneNames.add(obj.name);
    }

    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      foundMeshNames.add(mesh.name.toLowerCase());

      // Count triangles
      if (mesh.geometry) {
        if (mesh.geometry.index) {
          totalTriangles += mesh.geometry.index.count / 3;
        } else if (mesh.geometry.attributes.position) {
          totalTriangles += mesh.geometry.attributes.position.count / 3;
        }
      }

      // Check morph target dictionary
      if (mesh.morphTargetDictionary) {
        Object.keys(mesh.morphTargetDictionary).forEach((name) => {
          foundMorphNames.add(name);
        });
      }
    }
  });

  // Helper section validator
  function evaluateList(required: string[], foundSet: Set<string>, caseInsensitive = false): ValidationSectionReport {
    const present: string[] = [];
    const missing: string[] = [];

    const normalizedFound = new Set(
      Array.from(foundSet).map(s => (caseInsensitive ? s.toLowerCase() : s))
    );

    required.forEach((item) => {
      const checkItem = caseInsensitive ? item.toLowerCase() : item;
      // Also support viseme aliases (e.g. "viseme_aa" vs "aa")
      let match = normalizedFound.has(checkItem);
      if (!match && item.startsWith('viseme_')) {
        match = normalizedFound.has(item.replace('viseme_', '').toLowerCase());
      }
      if (match) {
        present.push(item);
      } else {
        missing.push(item);
      }
    });

    return {
      title: '',
      totalRequired: required.length,
      totalFound: present.length,
      passed: missing.length === 0,
      present,
      missing,
    };
  }

  const arkitReport = evaluateList(REQUIRED_ARKIT_BLENDSHAPES, foundMorphNames);
  arkitReport.title = '52 ARKit Blendshapes';

  const oculusReport = evaluateList(REQUIRED_OCULUS_VISEMES, foundMorphNames);
  oculusReport.title = '15 Oculus Visemes';

  const faceShapesReport = evaluateList(REQUIRED_FACE_SHAPES, foundMorphNames);
  faceShapesReport.title = '8 Face-Shape Morphs';

  const skeletonReport = evaluateList(REQUIRED_MIXAMO_BONES, foundBoneNames);
  skeletonReport.title = 'Mixamo-Compatible Skeleton';

  // Mesh check: also accept teeth/tongue or teeth_tongue
  const presentMeshes: string[] = [];
  const missingMeshes: string[] = [];
  REQUIRED_MESH_PARTS.forEach(m => {
    let match = foundMeshNames.has(m);
    if (!match && m === 'teeth_tongue') {
      match = foundMeshNames.has('teeth') || foundMeshNames.has('teeth/tongue') || foundMeshNames.has('tongue');
    }
    if (match) {
      presentMeshes.push(m);
    } else {
      missingMeshes.push(m);
    }
  });

  const meshesReport: ValidationSectionReport = {
    title: 'Required Separate Meshes',
    totalRequired: REQUIRED_MESH_PARTS.length,
    totalFound: presentMeshes.length,
    passed: missingMeshes.length === 0,
    present: presentMeshes,
    missing: missingMeshes,
  };

  const maxBudget = 40000;
  const triangleBudgetPassed = totalTriangles <= maxBudget;

  const animationsFound = (gltf.animations || []).map(a => a.name);

  const passed =
    arkitReport.passed &&
    oculusReport.passed &&
    skeletonReport.passed &&
    meshesReport.passed &&
    triangleBudgetPassed;

  return {
    avatarId,
    passed,
    triangleCount: Math.round(totalTriangles),
    triangleBudgetPassed,
    maxTriangleBudget: maxBudget,
    arkitReport,
    oculusReport,
    faceShapesReport,
    skeletonReport,
    meshesReport,
    animationsFound,
    allFoundMorphs: Array.from(foundMorphNames),
    timestamp: new Date().toISOString(),
  };
}
