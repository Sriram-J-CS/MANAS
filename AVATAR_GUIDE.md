# EmotiCare — 3D Animated Mascot & Avatar Customization Guide

## 1. Overview & Architecture
EmotiCare features a real-time, fully rigged 3D cartoon humanoid mascot running client-side with Three.js. It features ACES filmic tone mapping, three-point studio lighting, ARKit facial blendshapes, Oculus viseme speech lip-sync, idle breathing animations, and reaction gestures.

### Folder Structure
```
d:/Mental health chatbot/
├── frontend/
│   ├── public/
│   │   └── avatars/
│   │       ├── README.txt              # Placeholder guide & export requirements
│   │       ├── boy.png                 # 2D fallback portrait (boy)
│   │       ├── girl.png                # 2D fallback portrait (girl)
│   │       ├── boy/                    # ← GENERATED 3D assets
│   │       │   ├── boy.glb             # Rigged compressed GLB (1.4 MB, 5892 triangles)
│   │       │   ├── boy.blend           # Blender source stub (run blender_avatar_source.py for full rig)
│   │       │   └── avatar.json         # Manifest: meshes, morphs, animations, modular parts
│   │       └── girl/                   # ← GENERATED 3D assets
│   │           ├── girl.glb            # Rigged compressed GLB (1.4 MB, 6052 triangles)
│   │           ├── girl.blend          # Blender source stub
│   │           └── avatar.json         # Manifest
│   └── src/
│       ├── components/
│       │   ├── avatar/
│       │   │   └── Avatar3DStage.tsx   # MAIN: Three.js stage, lighting, FaceDriver, AnimationMixer
│       │   ├── mascot/
│       │   │   ├── MascotViewer.tsx    # Wrapper that drives Avatar3DStage
│       │   │   ├── MascotControls.tsx  # NOD / BREATHE / ENCOURAGE / WAVE buttons with gesture wiring
│       │   │   ├── MascotCustomizer.tsx # Settings drawer (name, background, voice, upload)
│       │   │   ├── MascotSpeechBubble.tsx # Animated bubbles with safety widgets
│       │   │   └── MascotUploader.tsx  # Upload custom GLB/PNG
│       │   ├── ThreeMascot/
│       │   │   ├── ThreeCartoonMascot.tsx  # Legacy: Toon-shaded Three.js canvas (kept for reference)
│       │   │   ├── ThreeMascotStage.tsx    # Legacy: R3F stage
│       │   │   └── useMascotAudioLipSync.ts # Web Audio FFT lip-sync (used by ThreeCartoonMascot)
│       │   └── ChatCompanionModal.tsx  # Main glassmorphism conversational stage
│       └── lib/
│           ├── avatar/
│           │   ├── FaceDriver.ts       # ARKit 52 emotion presets + Oculus viseme blending + blink + gaze
│           │   ├── lipSyncEngine.ts    # Real-time audio analysis → 15 Oculus viseme weights
│           │   ├── speechPerformance.ts # SpeechPerformanceOrchestrator: segments → gestures + emotions
│           │   ├── assetValidator.ts   # GLB spec validator (ARKit, visemes, skeleton, budget)
│           │   └── avatarConfigService.ts # AvatarConfig: skin/hair/outfit tints, gender, accessories
│           └── mascot/
│               ├── mascotConfig.ts     # MascotConfig: name, personality, background, voice
│               └── mascotModelStorage.ts # IndexedDB: store/retrieve user-uploaded GLB
├── scripts/
│   ├── generate_avatar_assets.js       # Node.js: generates boy.glb + girl.glb from Three.js geometry
│   └── blender_avatar_source.py        # Blender Python: builds full rigged .blend source files
└── pages/
    ├── DevAvatarCheckPage.tsx          # /dev/avatar-check: validator report + expression studio
    └── DevLipSyncPage.tsx              # /dev/lipsync: multilingual viseme monitor
```

---

## 2. Asset Specifications (Verified ✅)

Both `boy.glb` and `girl.glb` pass 100% spec conformance:

| Specification | Boy | Girl |
|:---|:---|:---|
| **Triangles** | 5,892 (budget: 40,000) | 6,052 (budget: 40,000) |
| **File size** | 1.39 MB | 1.40 MB |
| **ARKit Blendshapes** | 52/52 ✅ | 52/52 ✅ |
| **Oculus Visemes** | 15/15 ✅ | 15/15 ✅ |
| **Face-Shape Morphs** | 8/8 ✅ | 8/8 ✅ |
| **Mixamo Bones** | 22/22 ✅ | 22/22 ✅ |
| **Separate Meshes** | 6/6 ✅ | 6/6 ✅ |
| **Total Morph Targets** | 75 (52+15+8) | 75 (52+15+8) |
| **Animations** | 11 clips ✅ | 11 clips ✅ |
| **Compression** | GLB binary | GLB binary |

---

## 3. All 52 ARKit Blendshapes (Exact Names)

```
Eye:         eyeBlinkLeft, eyeLookDownLeft, eyeLookInLeft, eyeLookOutLeft, eyeLookUpLeft,
             eyeSquintLeft, eyeWideLeft, eyeBlinkRight, eyeLookDownRight, eyeLookInRight,
             eyeLookOutRight, eyeLookUpRight, eyeSquintRight, eyeWideRight (14)

Jaw:         jawForward, jawLeft, jawRight, jawOpen (4)

Mouth:       mouthClose, mouthFunnel, mouthPucker, mouthLeft, mouthRight,
             mouthSmileLeft, mouthSmileRight, mouthFrownLeft, mouthFrownRight,
             mouthDimpleLeft, mouthDimpleRight, mouthStretchLeft, mouthStretchRight,
             mouthRollLower, mouthRollUpper, mouthShrugLower, mouthShrugUpper,
             mouthPressLeft, mouthPressRight, mouthLowerDownLeft, mouthLowerDownRight,
             mouthUpperUpLeft, mouthUpperUpRight (23)

Brow:        browDownLeft, browDownRight, browInnerUp, browOuterUpLeft, browOuterUpRight (5)

Cheek/Nose:  cheekPuff, cheekSquintLeft, cheekSquintRight,
             noseSneerLeft, noseSneerRight, tongueOut (6)
```

---

## 4. All 15 Oculus Visemes (Exact Names)

```
viseme_sil, viseme_PP, viseme_FF, viseme_TH, viseme_DD,
viseme_kk, viseme_CH, viseme_SS, viseme_nn, viseme_RR,
viseme_aa, viseme_E, viseme_I, viseme_O, viseme_U
```

---

## 5. Face-Shape Morphs (Exact Names)

```
faceWidth, jawWidth, chinLength, cheekFullness,
noseSize, eyeSize, eyeSpacing, browThickness
```

---

## 6. Mixamo-Compatible Bone Names (22 Required)

```
Hips, Spine, Spine1, Spine2, Neck, Head
LeftShoulder, LeftArm, LeftForeArm, LeftHand
RightShoulder, RightArm, RightForeArm, RightHand
LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase
RightUpLeg, RightLeg, RightFoot, RightToeBase
```

---

## 7. Separate Meshes (Required)

| Mesh Name | Description |
|:---|:---|
| `head` | Carries ALL 75 morph targets (ARKit + Oculus + face-shapes) |
| `body` | Torso, arms, legs, shoes |
| `hair` | Default hair style; additional `hair_<style>` variants |
| `eyes` | Eye spheres — skinned to Head bone |
| `teeth_tongue` | Upper/lower arch + tongue |
| `clothes` | Default outfit hoodie+jeans; additional `outfit_<type>` variants |

---

## 8. Modular Parts (All in GLB)

### Hair Styles (11)
`short_messy`, `curly_volume`, `wavy_long`, `straight_bob`, `afro_fade`,
`side_part`, `buzz_cut`, `ponytail`, `curtain_bangs`, `undercut`, `braids`

> **Color tinting**: Hair color driven by `mat_hair` material tint through `AvatarConfig.colors.hair`.

### Outfits (6)
`hoodie`, `formal`, `kurta_saree`, `sports`, `pyjamas`, `festive`

> **Color tinting**: Outfit color driven by `mat_clothes` via `AvatarConfig.colors.outfit`.

### Glasses (3)
`round`, `square`, `semi_rimless`

### Facial Hair (3)
`stubble`, `goatee`, `full_beard`

### Earrings (3)
`studs`, `hoops`, `dangle`

---

## 9. Animations (11 Mixamo-Compatible Clips)

| Clip Name | Duration | Description |
|:---|:---|:---|
| `idle` | 2.4s loop | Standing, hands clasped in front, gentle breathing |
| `nod` | 1.6s | Warm reassuring nod (2 repetitions) |
| `wave` | 2.0s | Friendly right-hand wave |
| `thumbs_up` | 1.8s | Right-hand thumbs-up encouragement |
| `thinking` | 2.2s | Head tilt + chin hand pose |
| `listening` | 2.5s | Attentive micro-nods with subtle head tilt |
| `talking_1..4` | 2.0s each | Conversational beat gestures (hand + head) |
| `breathing_guide` | 16.0s | Box breathing: 4s inhale, 4s hold, 4s exhale, 4s hold |

---

## 10. FaceDriver — Emotion Presets (10 Emotions)

Located in `src/lib/avatar/FaceDriver.ts`:

| Emotion | Key Blendshapes |
|:---|:---|
| `neutral` | Baseline (all 0) |
| `warm_smile` | mouthSmile ×0.38, cheekSquint ×0.22 |
| `happy` | mouthSmile ×0.82, cheekSquint ×0.55, eyeSquint ×0.28 |
| `empathetic` | browInnerUp ×0.60, mouthSmile ×0.28 |
| `concerned` | browDown ×0.42, browInnerUp ×0.55, mouthFrown ×0.28 |
| `sad` | browInnerUp ×0.72, mouthFrown ×0.55 |
| `surprised` | jawOpen ×0.45, browOuterUp ×0.80, eyeWide ×0.75 |
| `thinking` | browDown ×0.32, mouthPucker ×0.22, eyeLookUpRight ×0.45 |
| `encouraging` | mouthSmile ×0.65, cheekPuff ×0.12 |
| `calm` | mouthSmile ×0.18, browInnerUp ×0.08 |

---

## 11. LipSyncEngine — Audio Analysis

Located in `src/lib/avatar/lipSyncEngine.ts`:

- **40ms audio delay** on Web Audio graph so mouth opens before sound is heard
- **Multi-band FFT** mapping: F1 (250–900 Hz) → jawOpen, aa / F2 (1000–2200 Hz) → E, I / Sibilance (3800–7500 Hz) → SS, CH, FF
- **Attack 40ms / Release 90ms** asymmetric smoothing + coarticulation
- Language-independent (tested: English, Tamil, Spanish, French, Hindi, Japanese)

---

## 12. Generating or Replacing the GLBs

### Regenerating Programmatically (Node.js)
```bash
cd frontend
node scripts/generate_avatar_assets.js
```
Writes validated `boy.glb` + `girl.glb` + `avatar.json` to `frontend/public/avatars/boy/` and `girl/`.

### Regenerating from Blender (Full Artistic Rig)
```bash
blender --background --python scripts/blender_avatar_source.py
```
Produces `.blend` source files with full Mixamo armature, shape keys, PBR materials, and UVs.

### Importing External Custom GLBs
1. Ensure the GLB has bone names matching the Mixamo set above.
2. Add all 75 shape keys on the head mesh with exact names above.
3. Validate with the asset validator:
   ```tsx
   import { validateAvatarModel } from './lib/avatar/assetValidator';
   // Pass your GLTF object:
   const report = validateAvatarModel('custom', gltf);
   console.log(report);
   ```
4. Or navigate to `/dev/avatar-check` in the app for the interactive validator UI.

### Replacing with VRoid / Avaturn / MetaPerson
- Export your model as GLB.
- Rename bone hierarchy to Mixamo names (any retargeting tool).
- Add the 75 required shape keys using the exact names above.
- Drop into `frontend/public/avatars/boy/boy.glb` or `girl/girl.glb`.
- Run the validator to confirm 100% spec pass.

---

## 13. Developer Test Pages

| URL | Purpose |
|:---|:---|
| `/dev/avatar-check` | Asset Validator report, all 75 blendshape sliders, 10 emotion presets, 11 gesture clips, modular wardrobe |
| `/dev/lipsync` | Multilingual audio test (6 languages), live 15 Oculus viseme bars, 40ms delay monitor, microphone mode |

---

## 14. Environment Variables Reference (By Name Only)

> **CONFIDENTIALITY NOTICE**: Never print, log, or commit variable values. Reference strictly by name on the server in `.env.local`.

- `DATABASE_URL`: Supabase Postgres database connection string.
- `AUTH_SECRET`: Secret key used for session cookie signing and encryption.
- `GOOGLE_CLIENT_ID`: Google OAuth SSO Client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth SSO Client Secret.
- `AI_PROVIDER_API_KEY`: API key for generative chat and vision model attribute analysis.
- `AVATAR_PROVIDER_API_KEY`: (Optional) API key for third-party 3D avatar generation.
- `VOICE_PROVIDER_API_KEY`: API key for server-side TTS audio & viseme streaming.
- `STORAGE_ENDPOINT`: S3 API endpoint for Supabase Storage.
- `STORAGE_ACCESS_KEY`: S3 Access Key ID.
- `STORAGE_SECRET_KEY`: S3 Secret Access Key.
- `STORAGE_BUCKET`: Supabase bucket name holding avatar models.
- `YOUTUBE_API_KEY`: Mindfulness video resource key.
- `MUSIC_PROVIDER_CLIENT_ID`: Soothing background audio provider ID.
- `MUSIC_PROVIDER_CLIENT_SECRET`: Soothing background audio provider secret.
