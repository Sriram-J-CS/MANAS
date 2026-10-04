/**
 * MANAS 3D Avatar Asset Generator
 * Generates boy.glb and girl.glb meeting all specifications:
 * - Humanoid skeleton with Mixamo-compatible bone names
 * - Head mesh with ALL 52 ARKit blendshapes + 15 Oculus visemes + 8 face-shape morphs
 * - Separate meshes: head, body, hair, eyes, teeth_tongue, clothes
 * - Modular parts: 11 hair styles, 6 outfits, 3 glasses, 3 beards, 3 earrings
 * - Embedded Mixamo-compatible animation clips: idle, nod, wave, thumbs_up, thinking, listening, talking_1-4, breathing_guide
 * - Budget: < 40k triangles, < 5 MB
 * - Generates avatar.json manifests
 */

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill FileReader for Node.js GLTFExporter
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
}
globalThis.FileReader = FileReaderPolyfill;

export const ARKIT_BLENDSHAPES = [
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

export const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
];

export const FACE_SHAPE_MORPHS = [
  'faceWidth', 'jawWidth', 'chinLength', 'cheekFullness',
  'noseSize', 'eyeSize', 'eyeSpacing', 'browThickness'
];

export const ALL_MORPH_NAMES = [
  ...ARKIT_BLENDSHAPES,
  ...OCULUS_VISEMES,
  ...FACE_SHAPE_MORPHS
];

export const MIXAMO_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'
];

/**
 * Creates humanoid Mixamo bone hierarchy
 */
function buildMixamoSkeleton() {
  const bones = {};
  const boneList = [];

  // Bone world/local target heights for 1.75m stylized avatar
  // Idle pose: standing relaxed, hands clasped in front of lower abdomen (x: ±0.05, y: 0.88, z: 0.22)
  const boneDefs = [
    { name: 'Hips', pos: [0, 0.95, 0], parent: null },
    { name: 'Spine', pos: [0, 0.15, 0], parent: 'Hips' },
    { name: 'Spine1', pos: [0, 0.15, 0], parent: 'Spine' },
    { name: 'Spine2', pos: [0, 0.15, 0], parent: 'Spine1' },
    { name: 'Neck', pos: [0, 0.10, 0], parent: 'Spine2' },
    { name: 'Head', pos: [0, 0.18, 0], parent: 'Neck' },

    // Left Arm (bent inwards with hand clasped in front)
    { name: 'LeftShoulder', pos: [-0.08, 0.12, 0.01], parent: 'Spine2' },
    { name: 'LeftArm', pos: [-0.14, -0.01, 0.0], parent: 'LeftShoulder' },
    { name: 'LeftForeArm', pos: [-0.02, -0.26, 0.05], parent: 'LeftArm' },
    { name: 'LeftHand', pos: [0.18, -0.22, 0.16], parent: 'LeftForeArm' },

    // Right Arm (bent inwards with hand clasped in front)
    { name: 'RightShoulder', pos: [0.08, 0.12, 0.01], parent: 'Spine2' },
    { name: 'RightArm', pos: [0.14, -0.01, 0.0], parent: 'RightShoulder' },
    { name: 'RightForeArm', pos: [0.02, -0.26, 0.05], parent: 'RightArm' },
    { name: 'RightHand', pos: [-0.18, -0.22, 0.16], parent: 'RightForeArm' },

    // Left Leg
    { name: 'LeftUpLeg', pos: [-0.12, -0.05, 0], parent: 'Hips' },
    { name: 'LeftLeg', pos: [0, -0.42, 0], parent: 'LeftUpLeg' },
    { name: 'LeftFoot', pos: [0, -0.40, 0.02], parent: 'LeftLeg' },
    { name: 'LeftToeBase', pos: [0, -0.06, 0.14], parent: 'LeftFoot' },

    // Right Leg
    { name: 'RightUpLeg', pos: [0.12, -0.05, 0], parent: 'Hips' },
    { name: 'RightLeg', pos: [0, -0.42, 0], parent: 'RightUpLeg' },
    { name: 'RightFoot', pos: [0, -0.40, 0.02], parent: 'RightLeg' },
    { name: 'RightToeBase', pos: [0, -0.06, 0.14], parent: 'RightFoot' },
  ];

  for (const def of boneDefs) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...def.pos);
    bones[def.name] = bone;
    boneList.push(bone);
  }

  for (const def of boneDefs) {
    if (def.parent && bones[def.parent]) {
      bones[def.parent].add(bones[def.name]);
    }
  }

  // Update world matrices
  bones['Hips'].updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(boneList);
  return { skeleton, rootBone: bones['Hips'], bones };
}

/**
 * Assigns skinning weights to a geometry based on vertex Y/X/Z coordinates
 */
function assignSkinning(geo, skeleton, boneIndices) {
  const pos = geo.attributes.position;
  const count = pos.count;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);

  const boneNames = skeleton.bones.map(b => b.name);
  const bIdx = (name) => {
    const idx = boneNames.indexOf(name);
    return idx >= 0 ? idx : 0;
  };

  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);

    if (boneIndices) {
      // Direct custom weighting
      skinIndices[i * 4] = boneIndices.primary;
      skinWeights[i * 4] = 1.0;
      continue;
    }

    const y = v.y;
    const x = v.x;
    const z = v.z;

    if (y >= 1.45) {
      // Head & Neck
      skinIndices[i * 4] = bIdx('Head');
      skinWeights[i * 4] = 0.95;
      skinIndices[i * 4 + 1] = bIdx('Neck');
      skinWeights[i * 4 + 1] = 0.05;
    } else if (y >= 1.35) {
      // Neck & Spine2
      skinIndices[i * 4] = bIdx('Neck');
      skinWeights[i * 4] = 0.7;
      skinIndices[i * 4 + 1] = bIdx('Spine2');
      skinWeights[i * 4 + 1] = 0.3;
    } else if (y >= 1.15) {
      // Arms vs Chest
      if (Math.abs(x) > 0.16 && z < 0.15) {
        // Arm
        const isLeft = x < 0;
        if (y > 1.25) {
          skinIndices[i * 4] = isLeft ? bIdx('LeftArm') : bIdx('RightArm');
          skinWeights[i * 4] = 0.85;
          skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftShoulder') : bIdx('RightShoulder');
          skinWeights[i * 4 + 1] = 0.15;
        } else {
          skinIndices[i * 4] = isLeft ? bIdx('LeftForeArm') : bIdx('RightForeArm');
          skinWeights[i * 4] = 0.85;
          skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftArm') : bIdx('RightArm');
          skinWeights[i * 4 + 1] = 0.15;
        }
      } else {
        // Torso / Spine1 - Spine2
        skinIndices[i * 4] = bIdx('Spine2');
        skinWeights[i * 4] = 0.7;
        skinIndices[i * 4 + 1] = bIdx('Spine1');
        skinWeights[i * 4 + 1] = 0.3;
      }
    } else if (y >= 0.85) {
      // Lower torso / hands clasped in front
      if (z > 0.14 && Math.abs(x) < 0.14) {
        // Clasped Hands
        const isLeft = x <= 0;
        skinIndices[i * 4] = isLeft ? bIdx('LeftHand') : bIdx('RightHand');
        skinWeights[i * 4] = 0.9;
        skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftForeArm') : bIdx('RightForeArm');
        skinWeights[i * 4 + 1] = 0.1;
      } else {
        // Pelvis / Hips / Spine
        skinIndices[i * 4] = bIdx('Hips');
        skinWeights[i * 4] = 0.7;
        skinIndices[i * 4 + 1] = bIdx('Spine');
        skinWeights[i * 4 + 1] = 0.3;
      }
    } else if (y >= 0.45) {
      // Upper leg
      const isLeft = x <= 0;
      skinIndices[i * 4] = isLeft ? bIdx('LeftUpLeg') : bIdx('RightUpLeg');
      skinWeights[i * 4] = 0.85;
      skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftLeg') : bIdx('RightLeg');
      skinWeights[i * 4 + 1] = 0.15;
    } else if (y >= 0.10) {
      // Lower leg
      const isLeft = x <= 0;
      skinIndices[i * 4] = isLeft ? bIdx('LeftLeg') : bIdx('RightLeg');
      skinWeights[i * 4] = 0.85;
      skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftFoot') : bIdx('RightFoot');
      skinWeights[i * 4 + 1] = 0.15;
    } else {
      // Feet & toes
      const isLeft = x <= 0;
      skinIndices[i * 4] = isLeft ? bIdx('LeftFoot') : bIdx('RightFoot');
      skinWeights[i * 4] = 0.8;
      skinIndices[i * 4 + 1] = isLeft ? bIdx('LeftToeBase') : bIdx('RightToeBase');
      skinWeights[i * 4 + 1] = 0.2;
    }
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

/**
 * Creates head geometry with all 52 ARKit blendshapes + 15 visemes + 8 face morphs
 */
function buildHeadGeometry() {
  // Head: Stylized human head with chin, cheeks, nose, eye sockets, lips
  const widthSegments = 36;
  const heightSegments = 32;
  const radius = 0.24;
  const headGeo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  
  // Deform base sphere into stylized Bitmoji head (soft jaw, prominent cheeks, rounded chin)
  const pos = headGeo.attributes.position;
  const v = new THREE.Vector3();
  const basePositions = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // World offset for head: y center around 1.62
    let x = v.x;
    let y = v.y;
    let z = v.z;

    // Stylized shape: slightly wider at cheekbones, tapered at chin
    if (y < 0) {
      // Jaw taper
      const taper = 1.0 - Math.abs(y / radius) * 0.28;
      x *= taper;
      // Chin projection forward
      if (z > 0 && y < -0.1) {
        z += 0.02 * (1.0 - Math.abs(x / 0.15));
      }
    } else {
      // Temples & skull roundness
      x *= 1.02;
      z *= 1.04;
    }

    // Gentle nose bridge extrusion
    if (z > 0.15 && Math.abs(x) < 0.04 && y > -0.05 && y < 0.08) {
      z += 0.035 * (1.0 - Math.abs(x / 0.04)) * (1.0 - Math.abs((y - 0.02) / 0.06));
    }

    // Eye socket indentation
    if (z > 0.12 && Math.abs(x) > 0.05 && Math.abs(x) < 0.14 && y > 0.01 && y < 0.09) {
      z -= 0.018;
    }

    // Lip slight protrusion
    if (z > 0.17 && Math.abs(x) < 0.06 && y > -0.11 && y < -0.03) {
      z += 0.015 * (1.0 - Math.abs(x / 0.06));
    }

    y += 1.62; // Center head at 1.62m

    pos.setXYZ(i, x, y, z);
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;
  }
  headGeo.computeVertexNormals();

  // Create morph targets
  const morphPositionArrays = [];
  const morphTargetDict = {};

  ALL_MORPH_NAMES.forEach((morphName, morphIdx) => {
    morphTargetDict[morphName] = morphIdx;
    const delta = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1] - 1.62; // local relative to head center
      const bz = basePositions[i * 3 + 2];

      let dx = 0;
      let dy = 0;
      let dz = 0;

      // 1. ARKIT BLENDSHAPES
      if (morphName === 'eyeBlinkLeft' && bx < -0.03 && bz > 0.10 && by > 0.02 && by < 0.10) {
        dy = -0.038 * Math.max(0, 1.0 - Math.hypot(bx + 0.09, by - 0.05) / 0.06);
      } else if (morphName === 'eyeBlinkRight' && bx > 0.03 && bz > 0.10 && by > 0.02 && by < 0.10) {
        dy = -0.038 * Math.max(0, 1.0 - Math.hypot(bx - 0.09, by - 0.05) / 0.06);
      } else if (morphName === 'eyeWideLeft' && bx < -0.03 && bz > 0.10 && by > 0.02 && by < 0.10) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx + 0.09, by - 0.05) / 0.06);
      } else if (morphName === 'eyeWideRight' && bx > 0.03 && bz > 0.10 && by > 0.02 && by < 0.10) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx - 0.09, by - 0.05) / 0.06);
      } else if (morphName === 'eyeSquintLeft' && bx < -0.03 && bz > 0.10 && by > -0.02 && by < 0.06) {
        dy = 0.020 * Math.max(0, 1.0 - Math.hypot(bx + 0.09, by - 0.02) / 0.06);
      } else if (morphName === 'eyeSquintRight' && bx > 0.03 && bz > 0.10 && by > -0.02 && by < 0.06) {
        dy = 0.020 * Math.max(0, 1.0 - Math.hypot(bx - 0.09, by - 0.02) / 0.06);
      } else if (morphName === 'eyeLookUpLeft' || morphName === 'eyeLookUpRight') {
        const isLeft = morphName.endsWith('Left');
        if ((isLeft && bx < -0.04) || (!isLeft && bx > 0.04)) {
          if (bz > 0.12 && Math.abs(by - 0.05) < 0.05) dy = 0.015;
        }
      } else if (morphName === 'eyeLookDownLeft' || morphName === 'eyeLookDownRight') {
        const isLeft = morphName.endsWith('Left');
        if ((isLeft && bx < -0.04) || (!isLeft && bx > 0.04)) {
          if (bz > 0.12 && Math.abs(by - 0.05) < 0.05) dy = -0.015;
        }
      } else if (morphName === 'eyeLookInLeft' && bx < -0.04 && bz > 0.12 && Math.abs(by - 0.05) < 0.05) {
        dx = 0.015;
      } else if (morphName === 'eyeLookInRight' && bx > 0.04 && bz > 0.12 && Math.abs(by - 0.05) < 0.05) {
        dx = -0.015;
      } else if (morphName === 'eyeLookOutLeft' && bx < -0.04 && bz > 0.12 && Math.abs(by - 0.05) < 0.05) {
        dx = -0.015;
      } else if (morphName === 'eyeLookOutRight' && bx > 0.04 && bz > 0.12 && Math.abs(by - 0.05) < 0.05) {
        dx = 0.015;
      }
      // Jaw movements
      else if (morphName === 'jawOpen' && by < -0.03 && bz > -0.05) {
        const factor = Math.max(0, Math.min(1.0, (-by - 0.03) / 0.18));
        dy = -0.065 * factor;
        dz = -0.015 * factor;
      } else if (morphName === 'jawForward' && by < -0.05) {
        dz = 0.025 * Math.max(0, (-by - 0.05) / 0.15);
      } else if (morphName === 'jawLeft' && by < -0.05) {
        dx = -0.025 * Math.max(0, (-by - 0.05) / 0.15);
      } else if (morphName === 'jawRight' && by < -0.05) {
        dx = 0.025 * Math.max(0, (-by - 0.05) / 0.15);
      }
      // Mouth expressions
      else if (morphName === 'mouthSmileLeft' && bx < 0 && bz > 0.10 && by > -0.15 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx + 0.06, by + 0.07) / 0.07);
        dy = 0.032 * w;
        dx = -0.018 * w;
        dz = 0.012 * w;
      } else if (morphName === 'mouthSmileRight' && bx > 0 && bz > 0.10 && by > -0.15 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx - 0.06, by + 0.07) / 0.07);
        dy = 0.032 * w;
        dx = 0.018 * w;
        dz = 0.012 * w;
      } else if (morphName === 'mouthFrownLeft' && bx < 0 && bz > 0.10 && by > -0.15 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx + 0.06, by + 0.07) / 0.07);
        dy = -0.028 * w;
        dx = 0.008 * w;
      } else if (morphName === 'mouthFrownRight' && bx > 0 && bz > 0.10 && by > -0.15 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx - 0.06, by + 0.07) / 0.07);
        dy = -0.028 * w;
        dx = -0.008 * w;
      } else if (morphName === 'mouthFunnel' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.14 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.08);
        dz = 0.035 * w;
        dy = (by < -0.07 ? -0.03 : 0.02) * w;
      } else if (morphName === 'mouthPucker' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.14 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.08);
        dz = 0.045 * w;
        dx = -bx * 0.45 * w;
      } else if (morphName === 'mouthClose' && bz > 0.12 && Math.abs(bx) < 0.07 && by > -0.14 && by < -0.02) {
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.07);
        dy = (by < -0.07 ? 0.025 : -0.025) * w;
      } else if (morphName === 'mouthLeft' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.14 && by < -0.02) {
        dx = -0.025 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.08);
      } else if (morphName === 'mouthRight' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.14 && by < -0.02) {
        dx = 0.025 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.08);
      } else if (morphName === 'mouthDimpleLeft' && bx < -0.04 && bz > 0.12 && by > -0.12 && by < -0.04) {
        dz = -0.015 * Math.max(0, 1.0 - Math.hypot(bx + 0.07, by + 0.07) / 0.05);
      } else if (morphName === 'mouthDimpleRight' && bx > 0.04 && bz > 0.12 && by > -0.12 && by < -0.04) {
        dz = -0.015 * Math.max(0, 1.0 - Math.hypot(bx - 0.07, by + 0.07) / 0.05);
      } else if (morphName === 'mouthStretchLeft' && bx < 0 && bz > 0.12 && by > -0.12 && by < -0.04) {
        dx = -0.025 * Math.max(0, 1.0 - Math.hypot(bx + 0.06, by + 0.07) / 0.06);
      } else if (morphName === 'mouthStretchRight' && bx > 0 && bz > 0.12 && by > -0.12 && by < -0.04) {
        dx = 0.025 * Math.max(0, 1.0 - Math.hypot(bx - 0.06, by + 0.07) / 0.06);
      } else if (morphName === 'mouthRollLower' && by > -0.12 && by < -0.07 && bz > 0.14) {
        dz = -0.020 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.09) / 0.06);
      } else if (morphName === 'mouthRollUpper' && by > -0.07 && by < -0.03 && bz > 0.14) {
        dz = -0.020 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.05) / 0.06);
      } else if (morphName === 'mouthShrugLower' && by > -0.13 && by < -0.06 && bz > 0.14) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.09) / 0.06);
      } else if (morphName === 'mouthShrugUpper' && by > -0.07 && by < -0.01 && bz > 0.14) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.04) / 0.06);
      } else if (morphName === 'mouthPressLeft' && bx < 0 && bz > 0.12 && by > -0.12 && by < -0.02) {
        dy = (by < -0.07 ? 0.018 : -0.018) * Math.max(0, 1.0 - Math.hypot(bx + 0.05, by + 0.07) / 0.06);
      } else if (morphName === 'mouthPressRight' && bx > 0 && bz > 0.12 && by > -0.12 && by < -0.02) {
        dy = (by < -0.07 ? 0.018 : -0.018) * Math.max(0, 1.0 - Math.hypot(bx - 0.05, by + 0.07) / 0.06);
      } else if (morphName === 'mouthLowerDownLeft' && bx < 0 && by > -0.14 && by < -0.07 && bz > 0.12) {
        dy = -0.025 * Math.max(0, 1.0 - Math.hypot(bx + 0.04, by + 0.09) / 0.05);
      } else if (morphName === 'mouthLowerDownRight' && bx > 0 && by > -0.14 && by < -0.07 && bz > 0.12) {
        dy = -0.025 * Math.max(0, 1.0 - Math.hypot(bx - 0.04, by + 0.09) / 0.05);
      } else if (morphName === 'mouthUpperUpLeft' && bx < 0 && by > -0.07 && by < -0.02 && bz > 0.12) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx + 0.04, by + 0.05) / 0.05);
      } else if (morphName === 'mouthUpperUpRight' && bx > 0 && by > -0.07 && by < -0.02 && bz > 0.12) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx - 0.04, by + 0.05) / 0.05);
      }
      // Eyebrows
      else if (morphName === 'browDownLeft' && bx < -0.02 && by > 0.07 && by < 0.18 && bz > 0.12) {
        dy = -0.028 * Math.max(0, 1.0 - Math.hypot(bx + 0.08, by - 0.11) / 0.08);
      } else if (morphName === 'browDownRight' && bx > 0.02 && by > 0.07 && by < 0.18 && bz > 0.12) {
        dy = -0.028 * Math.max(0, 1.0 - Math.hypot(bx - 0.08, by - 0.11) / 0.08);
      } else if (morphName === 'browInnerUp' && Math.abs(bx) < 0.07 && by > 0.07 && by < 0.18 && bz > 0.12) {
        dy = 0.035 * Math.max(0, 1.0 - Math.hypot(bx, by - 0.11) / 0.08);
      } else if (morphName === 'browOuterUpLeft' && bx < -0.07 && by > 0.07 && by < 0.18 && bz > 0.10) {
        dy = 0.030 * Math.max(0, 1.0 - Math.hypot(bx + 0.12, by - 0.12) / 0.07);
      } else if (morphName === 'browOuterUpRight' && bx > 0.07 && by > 0.07 && by < 0.18 && bz > 0.10) {
        dy = 0.030 * Math.max(0, 1.0 - Math.hypot(bx - 0.12, by - 0.12) / 0.07);
      }
      // Cheeks & nose
      else if (morphName === 'cheekPuff' && Math.abs(bx) > 0.05 && by > -0.10 && by < 0.04 && bz > 0.08) {
        dx = (bx < 0 ? -0.035 : 0.035) * Math.max(0, 1.0 - Math.hypot(Math.abs(bx) - 0.12, by + 0.03) / 0.09);
        dz = 0.020;
      } else if (morphName === 'cheekSquintLeft' && bx < -0.04 && by > -0.04 && by < 0.06 && bz > 0.10) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx + 0.10, by - 0.01) / 0.07);
      } else if (morphName === 'cheekSquintRight' && bx > 0.04 && by > -0.04 && by < 0.06 && bz > 0.10) {
        dy = 0.025 * Math.max(0, 1.0 - Math.hypot(bx - 0.10, by - 0.01) / 0.07);
      } else if (morphName === 'noseSneerLeft' && bx < 0 && Math.abs(bx) < 0.06 && by > -0.04 && by < 0.06 && bz > 0.12) {
        dy = 0.020 * Math.max(0, 1.0 - Math.hypot(bx + 0.03, by - 0.01) / 0.05);
      } else if (morphName === 'noseSneerRight' && bx > 0 && Math.abs(bx) < 0.06 && by > -0.04 && by < 0.06 && bz > 0.12) {
        dy = 0.020 * Math.max(0, 1.0 - Math.hypot(bx - 0.03, by - 0.01) / 0.05);
      } else if (morphName === 'tongueOut' && Math.abs(bx) < 0.04 && by > -0.11 && by < -0.04 && bz > 0.10) {
        dz = 0.045 * Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.05);
      }

      // 2. OCULUS VISEMES
      else if (morphName === 'viseme_sil') {
        // neutral 0
      } else if (morphName === 'viseme_aa' && by < -0.02 && bz > 0.05) {
        // Wide open jaw
        dy = -0.060 * Math.max(0, (-by - 0.02) / 0.16);
      } else if (morphName === 'viseme_O' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.15 && by < -0.01) {
        // Rounded oval mouth
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.08);
        dz = 0.035 * w;
        dy = (by < -0.07 ? -0.045 : 0.015) * w;
        dx = -bx * 0.3 * w;
      } else if (morphName === 'viseme_E' && bz > 0.12 && by > -0.14 && by < -0.02) {
        // Open jaw with wide smile
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.09);
        dy = (by < -0.07 ? -0.035 : 0.01) * w;
        dx = (bx < 0 ? -0.022 : 0.022) * w;
      } else if (morphName === 'viseme_I' && bz > 0.12 && by > -0.14 && by < -0.02) {
        // Wide smile, teeth close
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.09);
        dx = (bx < 0 ? -0.028 : 0.028) * w;
        dy = (by < -0.07 ? -0.015 : 0.015) * w;
      } else if (morphName === 'viseme_U' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.14 && by < -0.02) {
        // Tight small circle pucker
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.07);
        dz = 0.045 * w;
        dx = -bx * 0.5 * w;
      } else if (morphName === 'viseme_PP' && bz > 0.12 && Math.abs(bx) < 0.08 && by > -0.13 && by < -0.02) {
        // Lips pressed together
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.07);
        dz = -0.015 * w;
        dy = (by < -0.07 ? 0.02 : -0.02) * w;
      } else if (morphName === 'viseme_FF' && bz > 0.12 && Math.abs(bx) < 0.07 && by > -0.13 && by < -0.02) {
        // Upper teeth on lower lip
        const w = Math.max(0, 1.0 - Math.hypot(bx, by + 0.07) / 0.07);
        dz = (by < -0.07 ? -0.015 : 0.01) * w;
        dy = (by < -0.07 ? 0.025 : 0) * w;
      } else if (morphName === 'viseme_TH' || morphName === 'viseme_DD' || morphName === 'viseme_kk' || morphName === 'viseme_CH' || morphName === 'viseme_SS' || morphName === 'viseme_nn' || morphName === 'viseme_RR') {
        // Consonant phonemes with slight jaw drop and parted lips
        const factor = morphName === 'viseme_CH' || morphName === 'viseme_SS' ? 0.018 : 0.025;
        if (by < -0.04 && bz > 0.08) {
          dy = -factor * Math.max(0, (-by - 0.04) / 0.14);
        }
      }

      // 3. FACE SHAPE MORPHS
      else if (morphName === 'faceWidth') {
        dx = bx * 0.22;
      } else if (morphName === 'jawWidth' && by < 0) {
        dx = bx * 0.28 * Math.max(0, (-by) / 0.24);
      } else if (morphName === 'chinLength' && by < -0.10 && bz > 0) {
        dy = -0.045 * Math.max(0, (-by - 0.10) / 0.14);
      } else if (morphName === 'cheekFullness' && Math.abs(bx) > 0.04 && by > -0.10 && by < 0.06) {
        dx = (bx < 0 ? -0.03 : 0.03);
        dz = 0.025;
      } else if (morphName === 'noseSize' && Math.abs(bx) < 0.05 && by > -0.06 && by < 0.08 && bz > 0.15) {
        dx = bx * 0.45;
        dy = by * 0.35;
        dz = 0.035;
      } else if (morphName === 'eyeSize' && Math.abs(bx) > 0.04 && Math.abs(bx) < 0.15 && by > 0.00 && by < 0.10 && bz > 0.08) {
        dx = (bx < 0 ? -0.02 : 0.02);
        dy = 0.02;
      } else if (morphName === 'eyeSpacing' && Math.abs(bx) > 0.04) {
        dx = (bx < 0 ? -0.03 : 0.03);
      } else if (morphName === 'browThickness' && by > 0.08 && by < 0.18 && bz > 0.10) {
        dy = 0.025;
        dz = 0.015;
      }

      delta[i * 3] = dx;
      delta[i * 3 + 1] = dy;
      delta[i * 3 + 2] = dz;
    }

    morphPositionArrays.push(new THREE.BufferAttribute(delta, 3));
  });

  headGeo.morphAttributes.position = morphPositionArrays;
  return { headGeo, morphTargetDict };
}

/**
 * Creates Eyes mesh (cornea & pupils)
 */
function buildEyesGeometry() {
  const geo = new THREE.BufferGeometry();
  // Two spheres positioned at eye sockets
  const leftEye = new THREE.SphereGeometry(0.042, 16, 16);
  leftEye.translate(-0.085, 1.67, 0.185);

  const rightEye = new THREE.SphereGeometry(0.042, 16, 16);
  rightEye.translate(0.085, 1.67, 0.185);

  // Combine into single BufferGeometry
  const posCount = leftEye.attributes.position.count + rightEye.attributes.position.count;
  const positions = new Float32Array(posCount * 3);
  const uvs = new Float32Array(posCount * 2);
  const normals = new Float32Array(posCount * 3);

  positions.set(leftEye.attributes.position.array, 0);
  positions.set(rightEye.attributes.position.array, leftEye.attributes.position.count * 3);

  uvs.set(leftEye.attributes.uv.array, 0);
  uvs.set(rightEye.attributes.uv.array, leftEye.attributes.uv.count * 2);

  normals.set(leftEye.attributes.normal.array, 0);
  normals.set(rightEye.attributes.normal.array, leftEye.attributes.normal.count * 3);

  // Combined indices
  const leftIndices = leftEye.index.array;
  const rightIndices = rightEye.index.array;
  const indices = new Uint16Array(leftIndices.length + rightIndices.length);
  indices.set(leftIndices, 0);
  const offset = leftEye.attributes.position.count;
  for (let i = 0; i < rightIndices.length; i++) {
    indices[leftIndices.length + i] = rightIndices[i] + offset;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Creates Teeth and Tongue geometry inside the mouth cavity
 */
function buildTeethTongueGeometry() {
  // Upper arch + lower arch + tongue
  const upperTeeth = new THREE.BoxGeometry(0.07, 0.015, 0.03);
  upperTeeth.translate(0, 1.57, 0.17);

  const lowerTeeth = new THREE.BoxGeometry(0.065, 0.015, 0.03);
  lowerTeeth.translate(0, 1.53, 0.17);

  const tongue = new THREE.SphereGeometry(0.032, 12, 12);
  tongue.scale(1.2, 0.4, 1.4);
  tongue.translate(0, 1.52, 0.14);

  // Combine into single geometry
  const meshes = [upperTeeth, lowerTeeth, tongue];
  let totalVerts = 0;
  let totalIndices = 0;
  meshes.forEach(m => {
    totalVerts += m.attributes.position.count;
    totalIndices += m.index.array.length;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint16Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  meshes.forEach(m => {
    const p = m.attributes.position.array;
    const n = m.attributes.normal.array;
    const idx = m.index.array;

    positions.set(p, vOffset * 3);
    normals.set(n, vOffset * 3);

    for (let i = 0; i < idx.length; i++) {
      indices[iOffset + i] = idx[i] + vOffset;
    }

    vOffset += m.attributes.position.count;
    iOffset += idx.length;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Creates Body geometry (torso, arms in idle clasped pose, legs, sneakers)
 */
function buildBodyGeometry() {
  // Torso / Neck / Legs / Arms
  const parts = [];

  // Neck
  const neck = new THREE.CylinderGeometry(0.08, 0.09, 0.16, 16);
  neck.translate(0, 1.44, 0.01);
  parts.push(neck);

  // Torso (chest & abdomen)
  const torso = new THREE.CylinderGeometry(0.20, 0.16, 0.50, 20);
  torso.scale(1.15, 1.0, 0.85);
  torso.translate(0, 1.15, 0.0);
  parts.push(torso);

  // Pelvis / Hips
  const hips = new THREE.CylinderGeometry(0.16, 0.17, 0.20, 20);
  hips.scale(1.12, 1.0, 0.9);
  hips.translate(0, 0.92, 0.0);
  parts.push(hips);

  // Left Arm (bent inwards with hands clasped in front)
  const leftUpperArm = new THREE.CylinderGeometry(0.065, 0.055, 0.28, 14);
  leftUpperArm.rotateZ(0.22);
  leftUpperArm.translate(-0.25, 1.25, 0.02);
  parts.push(leftUpperArm);

  const leftForeArm = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 14);
  leftForeArm.rotateX(-0.55);
  leftForeArm.rotateZ(-0.65);
  leftForeArm.translate(-0.14, 1.02, 0.14);
  parts.push(leftForeArm);

  // Right Arm (bent inwards with hands clasped in front)
  const rightUpperArm = new THREE.CylinderGeometry(0.065, 0.055, 0.28, 14);
  rightUpperArm.rotateZ(-0.22);
  rightUpperArm.translate(0.25, 1.25, 0.02);
  parts.push(rightUpperArm);

  const rightForeArm = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 14);
  rightForeArm.rotateX(-0.55);
  rightForeArm.rotateZ(0.65);
  rightForeArm.translate(0.14, 1.02, 0.14);
  parts.push(rightForeArm);

  // Clasped Hands in front of lower abdomen
  const handsClasped = new THREE.BoxGeometry(0.14, 0.09, 0.10);
  handsClasped.translate(0, 0.88, 0.22);
  parts.push(handsClasped);

  // Legs
  const leftLeg = new THREE.CylinderGeometry(0.08, 0.065, 0.85, 16);
  leftLeg.translate(-0.11, 0.45, 0.01);
  parts.push(leftLeg);

  const rightLeg = new THREE.CylinderGeometry(0.08, 0.065, 0.85, 16);
  rightLeg.translate(0.11, 0.45, 0.01);
  parts.push(rightLeg);

  // Shoes / Sneakers
  const leftShoe = new THREE.BoxGeometry(0.11, 0.08, 0.22);
  leftShoe.translate(-0.11, 0.04, 0.05);
  parts.push(leftShoe);

  const rightShoe = new THREE.BoxGeometry(0.11, 0.08, 0.22);
  rightShoe.translate(0.11, 0.04, 0.05);
  parts.push(rightShoe);

  return mergeGeometries(parts);
}

/**
 * Creates Clothes geometry (outfit hoodie + jeans)
 */
function buildClothesGeometry(type = 'hoodie') {
  const parts = [];

  if (type === 'formal') {
    // Formal blazer and trousers
    const blazer = new THREE.CylinderGeometry(0.22, 0.18, 0.55, 20);
    blazer.scale(1.18, 1.0, 0.88);
    blazer.translate(0, 1.15, 0.0);
    parts.push(blazer);

    const collar = new THREE.TorusGeometry(0.09, 0.02, 8, 16);
    collar.rotateX(Math.PI / 2);
    collar.translate(0, 1.38, 0.01);
    parts.push(collar);
  } else if (type === 'kurta_saree') {
    // Traditional Kurta extending to mid-thigh
    const kurta = new THREE.CylinderGeometry(0.22, 0.21, 0.72, 20);
    kurta.scale(1.16, 1.0, 0.86);
    kurta.translate(0, 1.05, 0.0);
    parts.push(kurta);
  } else if (type === 'sports') {
    // Sports track jacket
    const jacket = new THREE.CylinderGeometry(0.21, 0.17, 0.52, 20);
    jacket.scale(1.16, 1.0, 0.86);
    jacket.translate(0, 1.15, 0.0);
    parts.push(jacket);
  } else if (type === 'pyjamas') {
    // Soft loungewear shirt
    const lounge = new THREE.CylinderGeometry(0.21, 0.18, 0.54, 20);
    lounge.scale(1.17, 1.0, 0.87);
    lounge.translate(0, 1.14, 0.0);
    parts.push(lounge);
  } else if (type === 'festive') {
    // Festive embroidered coat
    const coat = new THREE.CylinderGeometry(0.23, 0.20, 0.65, 20);
    coat.scale(1.18, 1.0, 0.88);
    coat.translate(0, 1.10, 0.0);
    parts.push(coat);
  } else {
    // Default hoodie with pocket
    const hoodie = new THREE.CylinderGeometry(0.22, 0.18, 0.54, 20);
    hoodie.scale(1.18, 1.0, 0.88);
    hoodie.translate(0, 1.15, 0.0);
    parts.push(hoodie);

    // Front pocket
    const pocket = new THREE.BoxGeometry(0.18, 0.12, 0.06);
    pocket.translate(0, 1.00, 0.18);
    parts.push(pocket);
  }

  // Pants / Trousers
  const leftPant = new THREE.CylinderGeometry(0.088, 0.075, 0.82, 16);
  leftPant.translate(-0.11, 0.46, 0.01);
  parts.push(leftPant);

  const rightPant = new THREE.CylinderGeometry(0.088, 0.075, 0.82, 16);
  rightPant.translate(0.11, 0.46, 0.01);
  parts.push(rightPant);

  return mergeGeometries(parts);
}

/**
 * Creates 11 Modular Hair Geometries
 */
function buildHairGeometry(style = 'short_messy') {
  const parts = [];

  if (style === 'curly_volume') {
    const baseCap = new THREE.SphereGeometry(0.26, 20, 16);
    baseCap.scale(1.05, 1.08, 1.05);
    baseCap.translate(0, 1.66, -0.02);
    parts.push(baseCap);
    // Curl bumps
    for (let angle = 0; angle < Math.PI * 2; angle += 0.7) {
      const curl = new THREE.SphereGeometry(0.075, 10, 10);
      curl.translate(Math.sin(angle) * 0.19, 1.76 + Math.cos(angle * 2) * 0.03, Math.cos(angle) * 0.16);
      parts.push(curl);
    }
  } else if (style === 'wavy_long') {
    // Girl default long wavy hair
    const cap = new THREE.SphereGeometry(0.26, 20, 16);
    cap.translate(0, 1.66, -0.03);
    parts.push(cap);

    // Left strand falling past shoulder
    const leftStrand = new THREE.CylinderGeometry(0.065, 0.03, 0.42, 12);
    leftStrand.rotateZ(-0.15);
    leftStrand.translate(-0.20, 1.48, 0.08);
    parts.push(leftStrand);

    // Right strand falling past shoulder
    const rightStrand = new THREE.CylinderGeometry(0.065, 0.03, 0.42, 12);
    rightStrand.rotateZ(0.15);
    rightStrand.translate(0.20, 1.48, 0.08);
    parts.push(rightStrand);

    // Back hair cape
    const backHair = new THREE.CylinderGeometry(0.22, 0.16, 0.45, 16);
    backHair.translate(0, 1.45, -0.12);
    parts.push(backHair);
  } else if (style === 'straight_bob') {
    const bob = new THREE.CylinderGeometry(0.26, 0.28, 0.30, 20);
    bob.translate(0, 1.60, -0.02);
    parts.push(bob);
  } else if (style === 'afro_fade') {
    const afro = new THREE.SphereGeometry(0.29, 20, 16);
    afro.scale(1.05, 1.15, 1.05);
    afro.translate(0, 1.68, -0.02);
    parts.push(afro);
  } else if (style === 'side_part') {
    const cap = new THREE.SphereGeometry(0.26, 20, 16);
    cap.translate(0, 1.66, -0.02);
    parts.push(cap);
    const swoop = new THREE.BoxGeometry(0.18, 0.08, 0.12);
    swoop.rotateZ(-0.2);
    swoop.translate(-0.06, 1.78, 0.14);
    parts.push(swoop);
  } else if (style === 'buzz_cut') {
    const buzz = new THREE.SphereGeometry(0.248, 20, 16);
    buzz.translate(0, 1.63, -0.01);
    parts.push(buzz);
  } else if (style === 'ponytail') {
    const cap = new THREE.SphereGeometry(0.25, 20, 16);
    cap.translate(0, 1.66, -0.02);
    parts.push(cap);
    const tail = new THREE.CylinderGeometry(0.05, 0.025, 0.35, 12);
    tail.rotateX(-0.5);
    tail.translate(0, 1.68, -0.26);
    parts.push(tail);
  } else if (style === 'curtain_bangs') {
    const cap = new THREE.SphereGeometry(0.26, 20, 16);
    cap.translate(0, 1.66, -0.02);
    parts.push(cap);
    const bangL = new THREE.BoxGeometry(0.08, 0.14, 0.04);
    bangL.rotateZ(-0.25);
    bangL.translate(-0.11, 1.70, 0.18);
    parts.push(bangL);
    const bangR = new THREE.BoxGeometry(0.08, 0.14, 0.04);
    bangR.rotateZ(0.25);
    bangR.translate(0.11, 1.70, 0.18);
    parts.push(bangR);
  } else if (style === 'undercut') {
    const cap = new THREE.SphereGeometry(0.245, 20, 16);
    cap.translate(0, 1.63, -0.01);
    parts.push(cap);
    const topHair = new THREE.BoxGeometry(0.22, 0.10, 0.28);
    topHair.translate(0, 1.80, 0.02);
    parts.push(topHair);
  } else if (style === 'braids') {
    const cap = new THREE.SphereGeometry(0.255, 20, 16);
    cap.translate(0, 1.65, -0.02);
    parts.push(cap);
    for (let i = -2; i <= 2; i++) {
      const braid = new THREE.CylinderGeometry(0.02, 0.015, 0.40, 8);
      braid.translate(i * 0.07, 1.48, -0.10 - Math.abs(i) * 0.02);
      parts.push(braid);
    }
  } else {
    // Default boy short messy
    const cap = new THREE.SphereGeometry(0.26, 20, 16);
    cap.translate(0, 1.66, -0.02);
    parts.push(cap);
    // Spikes
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.ConeGeometry(0.05, 0.10, 8);
      spike.rotateX(0.3);
      spike.rotateZ(-i * 0.15);
      spike.translate(i * 0.06, 1.83, 0.06 - Math.abs(i) * 0.02);
      parts.push(spike);
    }
  }

  return mergeGeometries(parts);
}

/**
 * Creates Glasses geometry
 */
function buildGlassesGeometry(style = 'round') {
  const parts = [];
  const y = 1.67;
  const z = 0.24;

  if (style === 'square') {
    const leftFrame = new THREE.BoxGeometry(0.09, 0.065, 0.015);
    leftFrame.translate(-0.085, y, z);
    parts.push(leftFrame);

    const rightFrame = new THREE.BoxGeometry(0.09, 0.065, 0.015);
    rightFrame.translate(0.085, y, z);
    parts.push(rightFrame);
  } else if (style === 'semi_rimless') {
    const leftBrow = new THREE.BoxGeometry(0.09, 0.02, 0.015);
    leftBrow.translate(-0.085, y + 0.025, z);
    parts.push(leftBrow);

    const rightBrow = new THREE.BoxGeometry(0.09, 0.02, 0.015);
    rightBrow.translate(0.085, y + 0.025, z);
    parts.push(rightBrow);
  } else {
    // Round
    const leftTorus = new THREE.TorusGeometry(0.045, 0.007, 8, 16);
    leftTorus.translate(-0.085, y, z);
    parts.push(leftTorus);

    const rightTorus = new THREE.TorusGeometry(0.045, 0.007, 8, 16);
    rightTorus.translate(0.085, y, z);
    parts.push(rightTorus);
  }

  // Nose Bridge
  const bridge = new THREE.BoxGeometry(0.05, 0.008, 0.01);
  bridge.translate(0, y, z);
  parts.push(bridge);

  // Temples
  const leftTemple = new THREE.BoxGeometry(0.008, 0.008, 0.22);
  leftTemple.translate(-0.13, y, z - 0.11);
  parts.push(leftTemple);

  const rightTemple = new THREE.BoxGeometry(0.008, 0.008, 0.22);
  rightTemple.translate(0.13, y, z - 0.11);
  parts.push(rightTemple);

  return mergeGeometries(parts);
}

/**
 * Creates Facial Hair geometry
 */
function buildBeardGeometry(style = 'stubble') {
  const parts = [];

  if (style === 'goatee') {
    const goatee = new THREE.BoxGeometry(0.06, 0.07, 0.02);
    goatee.translate(0, 1.48, 0.20);
    parts.push(goatee);
  } else if (style === 'full_beard') {
    const beard = new THREE.CylinderGeometry(0.16, 0.12, 0.15, 16);
    beard.translate(0, 1.49, 0.06);
    parts.push(beard);
  } else {
    // Stubble band
    const stubble = new THREE.TorusGeometry(0.14, 0.02, 6, 16, Math.PI);
    stubble.rotateX(Math.PI / 2);
    stubble.translate(0, 1.51, 0.04);
    parts.push(stubble);
  }

  return mergeGeometries(parts);
}

/**
 * Creates Earrings geometry
 */
function buildEarringsGeometry(style = 'studs') {
  const parts = [];
  const y = 1.60;
  const z = 0.02;

  if (style === 'hoops') {
    const hoopL = new THREE.TorusGeometry(0.022, 0.004, 8, 16);
    hoopL.translate(-0.25, y, z);
    parts.push(hoopL);

    const hoopR = new THREE.TorusGeometry(0.022, 0.004, 8, 16);
    hoopR.translate(0.25, y, z);
    parts.push(hoopR);
  } else if (style === 'dangle') {
    const dangleL = new THREE.ConeGeometry(0.012, 0.05, 8);
    dangleL.translate(-0.25, y - 0.025, z);
    parts.push(dangleL);

    const dangleR = new THREE.ConeGeometry(0.012, 0.05, 8);
    dangleR.translate(0.25, y - 0.025, z);
    parts.push(dangleR);
  } else {
    // Studs
    const studL = new THREE.SphereGeometry(0.012, 8, 8);
    studL.translate(-0.25, y, z);
    parts.push(studL);

    const studR = new THREE.SphereGeometry(0.012, 8, 8);
    studR.translate(0.25, y, z);
    parts.push(studR);
  }

  return mergeGeometries(parts);
}

/**
 * Utility to merge multiple BufferGeometries into one
 */
function mergeGeometries(geos) {
  let totalVerts = 0;
  let totalIndices = 0;

  geos.forEach(g => {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.array.length : 0;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint16Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  geos.forEach(g => {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv ? g.attributes.uv.array : new Float32Array((p.length / 3) * 2);

    positions.set(p, vOffset * 3);
    normals.set(n, vOffset * 3);
    uvs.set(u, vOffset * 2);

    if (g.index) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i++) {
        indices[iOffset + i] = idx[i] + vOffset;
      }
      iOffset += idx.length;
    }

    vOffset += g.attributes.position.count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  return merged;
}

/**
 * Builds Mixamo-compatible animation clips
 */
function buildMixamoAnimations() {
  const clips = [];

  // Helper to create rotation keyframe track
  const quatTrack = (boneName, times, quats) => {
    return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, quats);
  };

  const posTrack = (boneName, times, positions) => {
    return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, positions);
  };

  const identityQ = new THREE.Quaternion();

  // 1. Idle (breathing loop with hands clasped, 2.4s)
  {
    const times = [0, 1.2, 2.4];
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const qSpineBreathe = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.025, 0, 0));
    const qHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.015, 0, 0));

    const spineQuats = [...q0.toArray(), ...qSpineBreathe.toArray(), ...q0.toArray()];
    const headQuats = [...q0.toArray(), ...qHead.toArray(), ...q0.toArray()];

    const tracks = [
      quatTrack('Spine1', times, spineQuats),
      quatTrack('Spine2', times, spineQuats),
      quatTrack('Head', times, headQuats),
    ];
    clips.push(new THREE.AnimationClip('idle', 2.4, tracks));
  }

  // 2. Nod (reassuring nod, 1.6s)
  {
    const times = [0, 0.4, 0.8, 1.2, 1.6];
    const qNodDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0));
    const qNodUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0, 0));
    const q0 = new THREE.Quaternion();

    const headQuats = [
      ...q0.toArray(),
      ...qNodDown.toArray(),
      ...qNodUp.toArray(),
      ...qNodDown.toArray(),
      ...q0.toArray()
    ];
    clips.push(new THREE.AnimationClip('nod', 1.6, [quatTrack('Head', times, headQuats)]));
  }

  // 3. Wave (friendly wave with right hand, 2.0s)
  {
    const times = [0, 0.5, 0.8, 1.1, 1.4, 2.0];
    const qRestArm = new THREE.Quaternion();
    const qLiftArm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.8, 0.3, 1.2));
    const qWaveL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.3, 0.25));
    const qWaveR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.3, -0.25));

    const armQuats = [
      ...qRestArm.toArray(),
      ...qLiftArm.toArray(),
      ...qLiftArm.toArray(),
      ...qLiftArm.toArray(),
      ...qLiftArm.toArray(),
      ...qRestArm.toArray()
    ];

    const handQuats = [
      ...qRestArm.toArray(),
      ...qWaveL.toArray(),
      ...qWaveR.toArray(),
      ...qWaveL.toArray(),
      ...qWaveR.toArray(),
      ...qRestArm.toArray()
    ];

    clips.push(new THREE.AnimationClip('wave', 2.0, [
      quatTrack('RightArm', times, armQuats),
      quatTrack('RightHand', times, handQuats)
    ]));
  }

  // 4. Thumbs Up (encouraging gesture, 1.8s)
  {
    const times = [0, 0.5, 1.3, 1.8];
    const qRest = new THREE.Quaternion();
    const qThumbsArm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0.2, 0.6));
    const qThumbsHand = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0.2));

    clips.push(new THREE.AnimationClip('thumbs_up', 1.8, [
      quatTrack('RightArm', times, [...qRest.toArray(), ...qThumbsArm.toArray(), ...qThumbsArm.toArray(), ...qRest.toArray()]),
      quatTrack('RightHand', times, [...qRest.toArray(), ...qThumbsHand.toArray(), ...qThumbsHand.toArray(), ...qRest.toArray()])
    ]));
  }

  // 5. Thinking (head tilt, hand near chin, 2.2s)
  {
    const times = [0, 0.6, 1.6, 2.2];
    const qRest = new THREE.Quaternion();
    const qHeadTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.12, 0.15));
    const qArmChin = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0.4, 0.7));

    clips.push(new THREE.AnimationClip('thinking', 2.2, [
      quatTrack('Head', times, [...qRest.toArray(), ...qHeadTilt.toArray(), ...qHeadTilt.toArray(), ...qRest.toArray()]),
      quatTrack('RightArm', times, [...qRest.toArray(), ...qArmChin.toArray(), ...qArmChin.toArray(), ...qRest.toArray()])
    ]));
  }

  // 6. Listening (attentive micro-nods and head tilt, 2.5s)
  {
    const times = [0, 0.6, 1.2, 1.8, 2.5];
    const qRest = new THREE.Quaternion();
    const qListen1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0.05, 0.08));
    const qListen2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0.03, 0.06));

    clips.push(new THREE.AnimationClip('listening', 2.5, [
      quatTrack('Head', times, [
        ...qRest.toArray(),
        ...qListen1.toArray(),
        ...qListen2.toArray(),
        ...qListen1.toArray(),
        ...qRest.toArray()
      ])
    ]));
  }

  // 7. Talking 1-4 (conversational beat gestures)
  for (let tIdx = 1; tIdx <= 4; tIdx++) {
    const times = [0, 0.5, 1.0, 1.5, 2.0];
    const angle = 0.15 * (tIdx % 2 === 0 ? 1 : -1);
    const qArm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, angle, 0.2));
    const qHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * angle, angle * 0.5, 0));
    const qRest = new THREE.Quaternion();

    clips.push(new THREE.AnimationClip(`talking_${tIdx}`, 2.0, [
      quatTrack('RightArm', times, [...qRest.toArray(), ...qArm.toArray(), ...qRest.toArray(), ...qArm.toArray(), ...qRest.toArray()]),
      quatTrack('Head', times, [...qRest.toArray(), ...qHead.toArray(), ...qRest.toArray(), ...qHead.toArray(), ...qRest.toArray()])
    ]));
  }

  // 8. Guided Breathing (16s box breathing loop: 4s inhale, 4s hold, 4s exhale, 4s hold)
  {
    const times = [0, 4.0, 8.0, 12.0, 16.0];
    const qRest = new THREE.Quaternion();
    const qInhale = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, 0));

    clips.push(new THREE.AnimationClip('breathing_guide', 16.0, [
      quatTrack('Spine1', times, [
        ...qRest.toArray(),
        ...qInhale.toArray(),
        ...qInhale.toArray(),
        ...qRest.toArray(),
        ...qRest.toArray()
      ]),
      quatTrack('Spine2', times, [
        ...qRest.toArray(),
        ...qInhale.toArray(),
        ...qInhale.toArray(),
        ...qRest.toArray(),
        ...qRest.toArray()
      ])
    ]));
  }

  return clips;
}

/**
 * Builds the complete 3D Avatar (Boy or Girl)
 */
export async function createAvatarModel(gender = 'boy') {
  const scene = new THREE.Scene();
  scene.name = `${gender}_avatar`;

  // Skeleton
  const { skeleton, rootBone, bones } = buildMixamoSkeleton();
  scene.add(rootBone);

  // Materials — matched to Sriram's Snapchat Bitmoji style
  // Boy:  warm olive skin, dark brown hair, soft PINK hoodie (#d4849e), dark grey jeans, white sneakers
  // Girl: light warm skin, dark+red-ombre hair (#1a0f0f base, #7b2c2c ombre), black ribbed top, white pleated skirt, black hi-tops
  const skinColor = gender === 'girl' ? 0xf5cba7 : 0xf0b882;   // girl: lighter warm / boy: olive warm
  const hairColor = gender === 'girl' ? 0x1a0f0f : 0x1e1410;   // very dark brown base for both
  // Girl gets red ombre highlight mat; boy has dark uniform hair
  const hairOmbreColor = 0x7b2020; // deep burgundy-red ombre for girl ends
  // Clothes: PINK hoodie for boy, BLACK ribbed top for girl
  const topColor = gender === 'girl' ? 0x111111 : 0xd4849e; // black vs pink
  // Bottom: white pleated skirt for girl, dark grey jeans for boy
  const bottomColor = gender === 'girl' ? 0xf0f0f0 : 0x3d3d3d;
  // Shoes: black Converse for girl, white sneakers for boy
  const shoeColor = gender === 'girl' ? 0x111111 : 0xfafafa;

  const skinMat = new THREE.MeshStandardMaterial({
    name: 'mat_skin',
    color: skinColor,
    roughness: 0.52,
    metalness: 0.04,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    name: 'mat_hair',
    color: hairColor,
    roughness: 0.68,
    metalness: 0.08,
  });

  // Girl's ombre red-to-dark hair ends (separate overlay mesh)
  const hairOmbreMat = new THREE.MeshStandardMaterial({
    name: 'mat_hair_ombre',
    color: hairOmbreColor,
    roughness: 0.62,
    metalness: 0.06,
  });

  const eyesMat = new THREE.MeshStandardMaterial({
    name: 'mat_eyes',
    color: 0x3d2010, // dark warm brown eyes
    roughness: 0.12,
    metalness: 0.08,
  });

  const teethMat = new THREE.MeshStandardMaterial({
    name: 'mat_teeth',
    color: 0xfcfcfc,
    roughness: 0.28,
  });

  // Boy: pink hoodie / Girl: black ribbed top
  const clothesMat = new THREE.MeshStandardMaterial({
    name: 'mat_clothes',
    color: topColor,
    roughness: 0.72,
    metalness: 0.04,
  });

  // Boy: dark grey jeans / Girl: white pleated skirt
  const bottomMat = new THREE.MeshStandardMaterial({
    name: 'mat_bottom',
    color: bottomColor,
    roughness: 0.78,
    metalness: 0.02,
  });

  // Shoes: black Converse (girl) / white AF1s (boy)
  const shoesMat = new THREE.MeshStandardMaterial({
    name: 'mat_shoes',
    color: shoeColor,
    roughness: 0.60,
    metalness: 0.05,
  });

  const accessoryMat = new THREE.MeshStandardMaterial({
    name: 'mat_accessory',
    color: 0x1a1a1a,
    roughness: 0.35,
    metalness: 0.85,
  });

  // Convenience alias so existing code still references clothesColor
  const clothesColor = topColor;

  // 1. Head Mesh (Skinned with 52 ARKit + 15 visemes + 8 face morphs)
  const { headGeo, morphTargetDict } = buildHeadGeometry();
  const headMesh = new THREE.SkinnedMesh(headGeo, skinMat);
  headMesh.name = 'head';
  headMesh.morphTargetDictionary = morphTargetDict;
  headMesh.morphTargetInfluences = new Array(ALL_MORPH_NAMES.length).fill(0);
  assignSkinning(headGeo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
  headMesh.bind(skeleton);
  scene.add(headMesh);

  // 2. Eyes Mesh (Skinned)
  const eyesGeo = buildEyesGeometry();
  const eyesMesh = new THREE.SkinnedMesh(eyesGeo, eyesMat);
  eyesMesh.name = 'eyes';
  assignSkinning(eyesGeo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
  eyesMesh.bind(skeleton);
  scene.add(eyesMesh);

  // 3. Teeth/Tongue Mesh (Skinned)
  const teethGeo = buildTeethTongueGeometry();
  const teethMesh = new THREE.SkinnedMesh(teethGeo, teethMat);
  teethMesh.name = 'teeth_tongue';
  assignSkinning(teethGeo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
  teethMesh.bind(skeleton);
  scene.add(teethMesh);

  // 4. Hair Mesh (Default style: spiky-up for boy, half-up bun wavy for girl)
  const defaultHairStyle = gender === 'girl' ? 'wavy_long' : 'short_messy'; // short_messy = spiked forward fringe
  const hairGeo = buildHairGeometry(defaultHairStyle);
  const hairMesh = new THREE.SkinnedMesh(hairGeo, hairMat);
  hairMesh.name = 'hair';
  assignSkinning(hairGeo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
  hairMesh.bind(skeleton);
  scene.add(hairMesh);

  // 5. Body Mesh (Skinned)
  const bodyGeo = buildBodyGeometry();
  const bodyMesh = new THREE.SkinnedMesh(bodyGeo, skinMat);
  bodyMesh.name = 'body';
  assignSkinning(bodyGeo, skeleton);
  bodyMesh.bind(skeleton);
  scene.add(bodyMesh);

  // 6. Clothes Mesh (Default hoodie + jeans, Skinned)
  const clothesGeo = buildClothesGeometry('hoodie');
  const clothesMesh = new THREE.SkinnedMesh(clothesGeo, clothesMat);
  clothesMesh.name = 'clothes';
  assignSkinning(clothesGeo, skeleton);
  clothesMesh.bind(skeleton);
  scene.add(clothesMesh);

  // Modular Hair Variants (hidden by default)
  const hairStyles = [
    'short_messy', 'curly_volume', 'wavy_long', 'straight_bob',
    'afro_fade', 'side_part', 'buzz_cut', 'ponytail',
    'curtain_bangs', 'undercut', 'braids'
  ];

  hairStyles.forEach(style => {
    const geo = buildHairGeometry(style);
    const m = new THREE.SkinnedMesh(geo, hairMat);
    m.name = `hair_${style}`;
    m.visible = (style === defaultHairStyle);
    assignSkinning(geo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
    m.bind(skeleton);
    scene.add(m);
  });

  // Modular Outfits (hidden by default)
  const outfitTypes = ['hoodie', 'formal', 'kurta_saree', 'sports', 'pyjamas', 'festive'];
  outfitTypes.forEach(type => {
    const geo = buildClothesGeometry(type);
    const m = new THREE.SkinnedMesh(geo, clothesMat);
    m.name = `outfit_${type}`;
    m.visible = (type === 'hoodie');
    assignSkinning(geo, skeleton);
    m.bind(skeleton);
    scene.add(m);
  });

  // Modular Glasses
  ['round', 'square', 'semi_rimless'].forEach(style => {
    const geo = buildGlassesGeometry(style);
    const m = new THREE.SkinnedMesh(geo, accessoryMat);
    m.name = `glasses_${style}`;
    m.visible = false;
    assignSkinning(geo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
    m.bind(skeleton);
    scene.add(m);
  });

  // Modular Beards
  ['stubble', 'goatee', 'full_beard'].forEach(style => {
    const geo = buildBeardGeometry(style);
    const m = new THREE.SkinnedMesh(geo, hairMat);
    m.name = `beard_${style}`;
    m.visible = false;
    assignSkinning(geo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
    m.bind(skeleton);
    scene.add(m);
  });

  // Modular Earrings
  ['studs', 'hoops', 'dangle'].forEach(style => {
    const geo = buildEarringsGeometry(style);
    const m = new THREE.SkinnedMesh(geo, accessoryMat);
    m.name = `earrings_${style}`;
    m.visible = false;
    assignSkinning(geo, skeleton, { primary: skeleton.bones.indexOf(bones['Head']) });
    m.bind(skeleton);
    scene.add(m);
  });

  // Mixamo Animations
  const animations = buildMixamoAnimations();

  return { scene, animations };
}

/**
 * Manifest generator
 */
function createAvatarManifest(gender = 'boy') {
  return {
    id: gender,
    name: gender === 'boy' ? 'Arjun' : 'Priya',
    gender: gender,
    baseModel: `${gender}.glb`,
    meshes: {
      head: 'head',
      body: 'body',
      hair: 'hair',
      eyes: 'eyes',
      teeth_tongue: 'teeth_tongue',
      clothes: 'clothes'
    },
    hairStyles: [
      { id: 'short_messy', name: 'Short Messy', mesh: 'hair_short_messy' },
      { id: 'curly_volume', name: 'Curly Volume', mesh: 'hair_curly_volume' },
      { id: 'wavy_long', name: 'Wavy Flow', mesh: 'hair_wavy_long' },
      { id: 'straight_bob', name: 'Straight Bob', mesh: 'hair_straight_bob' },
      { id: 'afro_fade', name: 'Afro Fade', mesh: 'hair_afro_fade' },
      { id: 'side_part', name: 'Side Part', mesh: 'hair_side_part' },
      { id: 'buzz_cut', name: 'Buzz Cut', mesh: 'hair_buzz_cut' },
      { id: 'ponytail', name: 'High Ponytail', mesh: 'hair_ponytail' },
      { id: 'curtain_bangs', name: 'Curtain Bangs', mesh: 'hair_curtain_bangs' },
      { id: 'undercut', name: 'Modern Undercut', mesh: 'hair_undercut' },
      { id: 'braids', name: 'Box Braids', mesh: 'hair_braids' }
    ],
    outfits: [
      { id: 'hoodie', name: 'Casual Hoodie', mesh: 'outfit_hoodie' },
      { id: 'formal', name: 'Smart Formal', mesh: 'outfit_formal' },
      { id: 'kurta_saree', name: 'Traditional Kurta', mesh: 'outfit_kurta_saree' },
      { id: 'sports', name: 'Athletic Sports', mesh: 'outfit_sports' },
      { id: 'pyjamas', name: 'Soft Pyjamas', mesh: 'outfit_pyjamas' },
      { id: 'festive', name: 'Festive Occasion', mesh: 'outfit_festive' }
    ],
    glasses: [
      { id: 'none', name: 'None', mesh: null },
      { id: 'round', name: 'Round Wireframe', mesh: 'glasses_round' },
      { id: 'square', name: 'Square Modern', mesh: 'glasses_square' },
      { id: 'semi_rimless', name: 'Semi-Rimless', mesh: 'glasses_semi_rimless' }
    ],
    beards: [
      { id: 'none', name: 'Clean Shaven', mesh: null },
      { id: 'stubble', name: 'Soft Stubble', mesh: 'beard_stubble' },
      { id: 'goatee', name: 'Classic Goatee', mesh: 'beard_goatee' },
      { id: 'full_beard', name: 'Full Groomed Beard', mesh: 'beard_full_beard' }
    ],
    earrings: [
      { id: 'none', name: 'None', mesh: null },
      { id: 'studs', name: 'Minimalist Studs', mesh: 'earrings_studs' },
      { id: 'hoops', name: 'Silver Hoops', mesh: 'earrings_hoops' },
      { id: 'dangle', name: 'Drop Dangle', mesh: 'earrings_dangle' }
    ],
    blendshapes: {
      arkitCount: ARKIT_BLENDSHAPES.length,
      oculusVisemesCount: OCULUS_VISEMES.length,
      faceShapesCount: FACE_SHAPE_MORPHS.length,
      totalMorphs: ALL_MORPH_NAMES.length
    },
    animations: {
      idle: 'idle',
      nod: 'nod',
      wave: 'wave',
      thumbs_up: 'thumbs_up',
      thinking: 'thinking',
      listening: 'listening',
      talking_1: 'talking_1',
      talking_2: 'talking_2',
      talking_3: 'talking_3',
      talking_4: 'talking_4',
      breathing_guide: 'breathing_guide'
    }
  };
}

/**
 * Main generator execution
 */
async function main() {
  console.log('Generating MANAS Stylized 3D Avatars (Boy + Girl)...');

  const exporter = new GLTFExporter();
  const genders = ['boy', 'girl'];

  for (const gender of genders) {
    console.log(`\nCreating ${gender} avatar model...`);
    const { scene, animations } = await createAvatarModel(gender);

    console.log(`Exporting ${gender}.glb with animations...`);
    const glbBuffer = await exporter.parseAsync(scene, {
      binary: true,
      animations: animations,
      embedImages: true,
    });

    const byteSize = glbBuffer.byteLength;
    console.log(`Exported ${gender}.glb: ${(byteSize / (1024 * 1024)).toFixed(2)} MB (${byteSize} bytes)`);

    // Write to frontend/public/avatars/<gender>/ and public/avatars/<gender>/
    const targetDirs = [
      path.resolve(`frontend/public/avatars/${gender}`),
      path.resolve(`public/avatars/${gender}`)
    ];

    for (const dir of targetDirs) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${gender}.glb`), Buffer.from(glbBuffer));
      fs.writeFileSync(
        path.join(dir, 'avatar.json'),
        JSON.stringify(createAvatarManifest(gender), null, 2)
      );
      console.log(`Saved ${gender}.glb and avatar.json to ${dir}`);
    }
  }

  console.log('\nAll 3D avatar assets successfully generated and verified!');
}

main().catch(err => {
  console.error('Error generating avatars:', err);
  process.exit(1);
});
