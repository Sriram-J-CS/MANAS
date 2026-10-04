# MANAS TWIN - Animated 3D Mascot System & Asset Curation Guide

This guide documents the Pixar-style 3D animated mascot system, asset folder structure, server-side generation pipeline, runtime audio lip-sync, and instructions on how to regenerate and curate characters.

---

## 1. Style Reference & Visual Specification

- **Reference Image**: Located at `frontend/public/reference/mascot-style.png` (and `public/reference/mascot-style.png`).
- **Aesthetic**: Pixar-style 3D-rendered cartoon character, full body, front-facing, standing, smooth skin, large friendly expressive eyes, soft studio lighting on a warm cream studio background (`#FDFBF7`), consistent proportions, no text, no watermark.
- **Default Boy**: Curly voluminous black hair, large expressive brown eyes with glossy highlights, cheerful gentle smile, vibrant yellow t-shirt, blue denim jeans, white sneakers with yellow stripes, soft ambient ground shadow.
- **Default Girl**: Long dark wavy hair with soft curls, large expressive warm eyes, empathetic smile, yellow t-shirt, blue jeans, white sneakers.

---

## 2. Asset Folder Structure

```
frontend/public/
├── reference/
│   └── mascot-style.png                # Fixed master style reference
├── avatars/
│   ├── boy.png                         # Approved default boy mascot
│   ├── girl.png                        # Approved default girl mascot
│   ├── default/
│   │   ├── boy_base.png                # Fallback base render
│   │   └── girl_base.png               # Fallback base render
│   ├── review/                         # 4 candidate variations each for human review
│   │   ├── boy_candidate_1.png
│   │   ├── boy_candidate_2.png
│   │   ├── boy_candidate_3.png
│   │   ├── boy_candidate_4.png
│   │   ├── girl_candidate_1.png
│   │   ├── girl_candidate_2.png
│   │   ├── girl_candidate_3.png
│   │   └── girl_candidate_4.png
│   ├── faces/                          # Expression patches, mouth shapes & gestures
│   │   ├── boy_face_neutral.png
│   │   ├── boy_face_happy.png
│   │   ├── boy_face_concerned.png
│   │   ├── boy_face_sad.png
│   │   ├── boy_face_surprised.png
│   │   ├── boy_face_blink.png          # Blinking frame (2-6s cycle)
│   │   ├── boy_mouth_closed_smile.png
│   │   ├── boy_mouth_wide_open.png     # Viseme phoneme (ah, aa)
│   │   ├── boy_mouth_wide_smile.png    # Viseme phoneme (ee, i, s)
│   │   ├── boy_mouth_round_o.png       # Viseme phoneme (o, u, w)
│   │   ├── boy_mouth_small_closed.png  # Viseme consonant transition
│   │   ├── boy_gesture_wave.png        # Welcome & entry wave pose
│   │   ├── boy_gesture_thumbs_up.png   # Encouragement pose
│   │   └── boy_gesture_breathe.png     # Guided breathing pose (hands on chest)
│   └── outfits/                        # Wardrobe variations (face & pose preserved)
│       ├── boy_outfit_yellow_tshirt.png
│       ├── boy_outfit_hoodie.png
│       ├── boy_outfit_formal.png
│       ├── boy_outfit_kurta_saree.png
│       ├── boy_outfit_sports.png
│       ├── boy_outfit_pyjamas.png
│       └── boy_outfit_festive.png
```

---

## 3. Architecture & Renderer Interface

The mascot system uses the `AvatarRenderer` interface (`frontend/src/lib/avatar/AvatarRenderer.ts`), completely decoupling character rendering from chat dialogue, TTS, and state management:

1. **`SpriteRigRenderer`** (`frontend/src/lib/avatar/SpriteRigRenderer.ts`):
   - **Active Implementation**: Canvas 2D animated rig with sub-pixel composite transforms.
   - **Dynamic Breathing**: Torso scaling anchored at the feet (`ctx.translate(centerX, footY)`), breathing at natural human cadence (slower during guided breathing).
   - **Eye Blinking**: Natural randomized blink every 2 to 6 seconds with micro-saccades.
   - **Lip-Sync**: Web Audio `AnalyserNode` computes RMS volume and spectral centroid in real time, smoothly morphing between mouth shapes (`closed_smile`, `wide_open`, `wide_smile`, `round_o`, `small_closed`).
   - **Perspective Tilt**: Follows user cursor position `(nx, ny)` with damped smoothing for a 3D depth illusion.
   - **Gestures & Outfits**: Live crossfade between `nod`, `breathe`, `thumbs_up`, `wave`, and 7 wardrobe presets.
   - **Accessibility**: Respects `prefers-reduced-motion`.

2. **`Model3DRenderer`** (`frontend/src/lib/avatar/Model3DRenderer.ts`):
   - **Stub Implementation**: Future-ready drop-in replacement implementing the exact same `AvatarRenderer` contract for GLB 3D models with ARKit blendshapes (`jawOpen`, `eyeBlinkLeft`, `mouthSmile`), swappable without altering any chat code.

---

## 4. Regenerating and Curating Mascots

### A. Regenerating Default Mascots via Server Script
Run the one-time default generation script:
```bash
npx tsx scripts/generate-default-mascots.ts
```
- Calls Gemini server-side using `AI_PROVIDER_API_KEY` and `GEMINI_IMAGE_MODEL`.
- Produces 4 candidates each in `frontend/public/avatars/review/`.
- Review candidates and copy your preferred candidate over to `frontend/public/avatars/boy.png` or `frontend/public/avatars/girl.png`.

### B. Building the Full Procedural Rig Asset Pack
Run the automated Pillow asset compilation script:
```bash
python scripts/build_asset_pack.py
```
This automatically updates all face patches, mouth shapes, gestures, outfits, and the master style reference.

### C. Photo Personalization (Onboarding Step 04)
When a user uploads a photo:
1. Photo is sent server-side to `POST /api/avatar/job`.
2. Server queries Gemini image edit with the style reference + user photo prompt ("stylized cartoon version with matching hair, skin tone, glasses, wearing default outfit, never photorealistic").
3. As required by privacy guidelines, the original uploaded photo is **immediately purged from memory** upon processing.
4. If Gemini fails or times out, the system automatically falls back to the approved default mascot with zero user error screens.

---

## 5. Multi-Language Voice Quality Assurance (QA)

Run the automated voice QA suite:
```bash
npx tsx scripts/language-qa.ts
```
Outputs the test report to `scripts/language-qa-report.md`. Evaluates Word Error Rate (WER), helpline 14416 digit-by-digit parsing, and native script pronunciation across all 10 supported languages (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, English).
