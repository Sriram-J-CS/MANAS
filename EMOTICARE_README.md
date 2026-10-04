# EmotiCare — 3D Animated Cartoon Mascot & Architecture Documentation

## Overview
**EmotiCare** is an AI-powered mental-wellness companion featuring a real-time animated 3D cartoon mascot. Built with an editorial aesthetic, robust dual-tier crisis safety guardrails (integrated with Tele-MANAS 14416), dynamic system prompting, and privacy compliance (DPDP 2023 / HIPAA-aligned private storage).

---

## 1. Environment Variables Reference

> **STRICT SECURITY NOTICE**: Environment variable values are confidential and must NEVER be committed to Git, exposed to the browser, or logged. All credentials reside strictly on the server in `.env.local`.

| Variable Name | Environment | Purpose & Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Server | Supabase PostgreSQL connection string for saving user profiles, long-term memory facts, mood logs, and avatar wardrobe selections. |
| `AUTH_SECRET` | Server | Secret key used by Auth.js / NextAuth (v5) to sign and encrypt session JWTs and cookies. |
| `GOOGLE_CLIENT_ID` | Server | Google OAuth Client ID for user single-sign-on (SSO). |
| `GOOGLE_CLIENT_SECRET` | Server | Google OAuth Client Secret for authenticating Google SSO token exchanges. |
| `AI_PROVIDER_API_KEY` | Server | API key for generative chat and vision models (e.g. OpenAI, Anthropic, or Google Gemini). Drives `/api/chat` streaming and the free vision-based photo attribute tinting. |
| `AVATAR_PROVIDER_API_KEY` | Server | (Optional) API key for third-party paid 3D avatar generation. If left empty, EmotiCare automatically uses the free vision model pipeline to extract skin tone, hair color, glasses, and outfit color. |
| `VOICE_PROVIDER_API_KEY` | Server | API key for text-to-speech providers (e.g. ElevenLabs, Sarvam, Cartesia). Streams speech audio and viseme timestamps through `/api/tts`. If empty, EmotiCare cleanly falls back to browser Web SpeechSynthesis with Web Audio frequency analysis. |
| `STORAGE_ENDPOINT` | Server | S3-compatible API endpoint for Supabase Storage (e.g. `https://<project-ref>.supabase.co/storage/v1/s3`). |
| `STORAGE_ACCESS_KEY` | Server | S3 Access Key ID for Supabase Storage buckets. |
| `STORAGE_SECRET_KEY` | Server | S3 Secret Access Key for Supabase Storage operations. |
| `STORAGE_BUCKET` | Server | Name of the primary Supabase Storage bucket holding 3D models (`boy.glb`, `girl.glb`) and outfit textures (e.g. `emoticare-avatars`). |
| `YOUTUBE_API_KEY` | Server | API key for retrieving curated mindfulness and relaxing soundscape video resources. |
| `MUSIC_PROVIDER_CLIENT_ID` | Server | Client ID for ambient music and soothing background audio streaming services. |
| `MUSIC_PROVIDER_CLIENT_SECRET` | Server | Client Secret for ambient audio provider token generation. |

---

## 2. Assets You Need to Supply

EmotiCare is equipped with a rich, procedural cartoon humanoid mascot with complete facial blendshapes and toon shading that renders immediately out-of-the-box. When you are ready to use your own custom rigged 3D meshes, supply the following files:

### A. 3D Character Models (Full Body Rigged)
Upload these to your Supabase `STORAGE_BUCKET` under `models/` (or place in `/public/assets/models/`):
1. **`boy.glb`**
   - Rigged full-body cartoon male character.
   - Recommended format: GLTF/GLB (Binary) or VRM 1.0.
   - Facial Blendshapes: `jawOpen`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`, `blinkLeft`, `blinkRight`, `smile`, `frown`, `browInnerUp`, `browDownLeft`, `browDownRight`.
2. **`girl.glb`**
   - Rigged full-body cartoon female character with equivalent blendshapes and rig bone hierarchy.

### B. Wardrobe & Outfit Mesh / Texture Sets
For the 6 wardrobe outfits supported in the Outfit Drawer:
1. **`hoodie`**: Casual oversized fleece hoodie model/texture.
2. **`formal`**: Smart tailored blazer and collar shirt model/texture.
3. **`kurta_saree`**: Traditional ethnic attire with border motifs.
4. **`sports`**: Athletic activewear tracksuit with dynamic stripes.
5. **`pyjamas`**: Soft cloud-print loungewear.
6. **`festive`**: Embroidered celebratory attire with shimmer shader.

### C. Animation Clips (Optional Mixamo / GLTF Animations)
If replacing procedural physics animations:
- `idle_breathing.glb`: Sinusoidal chest & spine breathing loop (~3.2s).
- `wave_hello.glb`: Friendly arm greeting gesture (~1.8s).
- `listening_pose.glb`: Attentive head tilt while user is typing.
- `guided_breathing.glb`: 4s inhale, 4s hold, 4s exhale cycle.

---

## 3. Project Folder Structure

```
├── .env.example                               # Empty placeholders for all required environment variables
├── .gitignore                                  # Excludes all .env* and credentials from Git
├── EMOTICARE_README.md                         # This documentation
├── package.json                                # Workspace root scripts
│
├── src/                                        # Next.js Server API Architecture & Libs
│   ├── app/
│   │   └── api/
│   │       ├── chat/route.ts                   # /api/chat: Rate limited, Auth, AI provider streaming & emotion tagging
│   │       ├── tts/route.ts                    # /api/tts: Voice provider, viseme timings, speech synthesis fallback
│   │       └── avatar/
│   │           ├── model-url/route.ts          # /api/avatar/model-url: Short-lived S3 signed URLs from STORAGE_BUCKET
│   │           ├── photo-attributes/route.ts   # /api/avatar/photo-attributes: Free vision analysis & instant photo purge
│   │           └── wardrobe/route.ts           # /api/avatar/wardrobe: Persists user outfit selection in Postgres
│   └── lib/
│       ├── auth.ts                             # Auth.js / NextAuth verification helper
│       ├── rate-limit.ts                       # Sliding window token bucket rate limiter
│       ├── s3-storage.ts                       # Supabase Storage S3 client & signed URL presigner
│       └── db.ts                               # Supabase Postgres client via DATABASE_URL
│
├── frontend/                                   # Client-Side Application (React + Vite + Three.js)
│   └── src/
│       ├── components/
│       │   ├── ThreeMascot/
│       │   │   ├── ThreeCartoonMascot.tsx      # Three.js cartoon mascot, toon shading, soft rim light, morph targets
│       │   │   ├── ThreeMascotStage.tsx        # Stage container, WebGL detection, gestures & controls
│       │   │   ├── WardrobeDrawer.tsx          # 6-outfit drawer with smooth transitions
│       │   │   ├── Mascot2DFallback.tsx        # 2D animated portrait fallback for low-end / reduced-motion
│       │   │   ├── PhotoAttributeOnboarding.tsx# Onboarding photo color analyzer & consent
│       │   │   └── useMascotAudioLipSync.ts    # Web Audio / TTS viseme analyzer & mute toggle
│       │   ├── InteractiveAvatar.tsx           # Dual-mode (3D Rig / Visor Spirit) avatar stage
│       │   ├── ChatCompanionModal.tsx          # Main conversational stage with real-time mascot lip-sync
│       │   ├── OnboardingModal.tsx             # Multi-step gate with 3D Mascot & Photo Customizer
│       │   ├── ChatSettingsModal.tsx           # Settings drawer with 3D base & Wardrobe switcher
│       │   └── AmbientMusicPlayer.tsx          # 432 Hz Solfeggio binaural healing background music
│       └── types/
│           └── index.ts                        # MascotExpression ('calm' | 'concerned' | 'happy' | 'sad' | 'neutral')
│
└── backend/                                    # Local Python FastAPI Proxy (matches all Next.js API routes)
    ├── app/
    │   ├── main.py                             # API endpoints: /api/chat, /api/tts, /api/avatar/*
    │   ├── services/
    │   │   ├── chat_engine.py                  # Anti-repetition, 20-turn context, emotion classifier
    │   │   └── rag.py                          # Knowledge base vector retriever
    │   └── safety/
    │       └── rules.py                        # Pre-screen crisis guardrails & Tele-MANAS 14416
    └── knowledge/                              # Vetted clinical markdown documents
```

---

## 4. Security & Privacy Implementations

1. **Zero Secret Leakage:**
   - `.gitignore` strictly excludes `.env*`, `.env.local`, and `*.local`.
   - `.env.example` contains only variable names with blank placeholders.
   - No `NEXT_PUBLIC_` prefixes on secrets. All S3 and AI calls occur server-side.
2. **Rate Limiting:**
   - Every API route (`/api/chat`, `/api/tts`, `/api/avatar/*`) is guarded by `checkRateLimit` (IP + user token sliding window). Exceeding requests return `429 Too Many Requests`.
3. **Authentication Verification:**
   - Routes verify user identity via `verifyAuth` using Auth.js session cookies or bearer tokens. Unauthenticated requests are rejected with `401 Unauthorized`.
4. **Photo Privacy & Instant Deletion:**
   - User selfie photos are sent strictly with explicit consent to a private quarantine memory/bucket.
   - Color and style attributes (`skinTone`, `hairColor`, `glasses`, `outfitColor`) are extracted to customize the 3D model.
   - The photo is **immediately deleted** from memory and storage upon extraction.
