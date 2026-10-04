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
├── .env.example                               # Canonical template for all environment variables
├── .gitignore                                  # Excludes all .env* and credentials from Git
├── EMOTICARE_README.md                         # This documentation
├── package.json                                # Workspace root scripts (proxies dev, build, preview to frontend)
│
├── frontend/                                   # Client-Side Application (React 19 + Vite + TypeScript + Three.js)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── AuthModal.tsx               # Sign in & account registration modal (JWT Bearer tokens)
│   │   │   ├── ThreeMascot/
│   │   │   │   ├── ThreeCartoonMascot.tsx      # Three.js cartoon mascot, toon shading, soft rim light, morph targets
│   │   │   │   ├── ThreeMascotStage.tsx        # Stage container, WebGL detection, gestures & controls
│   │   │   │   ├── WardrobeDrawer.tsx          # 6-outfit drawer with smooth transitions
│   │   │   │   ├── Mascot2DFallback.tsx        # 2D animated portrait fallback for low-end / reduced-motion
│   │   │   │   ├── PhotoAttributeOnboarding.tsx# Onboarding photo color analyzer & consent
│   │   │   │   └── useMascotAudioLipSync.ts    # Web Audio / TTS viseme analyzer & mute toggle
│   │   │   ├── chat/
│   │   │   │   └── MoodJourneyDrawer.tsx       # Real mood tracker: dynamic baseline & honest empty state (zero fake data)
│   │   │   ├── InteractiveAvatar.tsx           # Dual-mode (3D Rig / Visor Spirit) avatar stage
│   │   │   ├── ChatCompanionModal.tsx          # Conversational modal with 8-language switcher & real-time lip-sync
│   │   │   ├── MenuOverlay.tsx                 # Full 8-language picker (English, தமிழ், हिन्दी, తెలుగు, etc.)
│   │   │   ├── OnboardingModal.tsx             # Multi-step gate with 3D Mascot & Photo Customizer
│   │   │   ├── ChatSettingsModal.tsx           # Settings drawer with 3D base & Wardrobe switcher
│   │   │   └── AmbientMusicPlayer.tsx          # 432 Hz Solfeggio binaural healing background music
│   │   ├── lib/
│   │   │   └── ai/
│   │   │       └── aiChatService.ts            # Client API layer: JWT bearer authentication, SSE streaming, mood APIs
│   │   └── types/
│   │       └── index.ts                        # Core interfaces, LanguageCode ('en'|'ta'|'hi'|'te'|'kn'|'ml'|'bn'|'mr')
│
├── backend/                                    # Production Python FastAPI Server (Port 8008)
│   ├── app/
│   │   ├── main.py                             # FastAPI entrypoint: 34 production routes, CORS, auth protection
│   │   ├── database.py                         # SQLite / PostgreSQL schema (auth_users, users, mood_logs, memories)
│   │   ├── auth/                               # Production JWT Authentication & RBAC
│   │   │   ├── routes.py                       # /api/auth/signup, /api/auth/login, /api/auth/refresh, /api/auth/me
│   │   │   ├── dependencies.py                 # require_auth, get_current_user_id, require_admin
│   │   │   ├── jwt_handler.py                  # HMAC-SHA256 PyJWT tokens (60m access / 30d refresh)
│   │   │   ├── password.py                     # Bcrypt salted password hashing & verification
│   │   │   └── schemas.py                      # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── pipeline.py                     # 8-Stage clinical safety & empathy pipeline
│   │   │   ├── llm_service.py                  # Multilingual LLM provider (Gemini / Groq / OpenAI)
│   │   │   ├── memory_service.py               # DPDP-compliant user memory & fact retrieval
│   │   │   ├── tts_service.py                  # Text-to-Speech synthesis with viseme timing
│   │   │   └── lip_sync.py                     # Viseme generator & phonetic mapping
│   │   └── safety/
│   │       ├── crisis.py                       # High-risk detection & Tele-MANAS 14416 national helpline routing
│   │       └── clinical.py                     # Medical boundary & non-prescriptive guardrails
│   └── knowledge/                              # Clinical mental health guidance & protocols
│
└── legacy_prototype/                           # Archived prototype exploration files (Next.js / Supabase)
    └── src/                                    # Isolated historical reference (not part of production runtime)
```

---

## 4. Security & Privacy Implementations

1. **Zero Secret Leakage:**
   - `.gitignore` strictly excludes `.env*`, `.env.local`, and `*.local`.
   - `.env.example` contains canonical template variable names with blank values.
   - All LLM keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`) and JWT secret keys reside strictly on the server.
2. **Robust JWT Authentication & RBAC:**
   - Stateless HMAC-SHA256 JWT tokens with 60-minute access token and 30-day refresh token lifecycles.
   - Passwords hashed using salted `bcrypt` with constant-time verification to prevent timing side-channels.
   - Server-enforced identity derivation (`get_current_user_id` / `require_auth`): client cannot spoof `user_id` in chat, mood, memory, or wardrobe requests.
   - Admin authorization check (`require_admin`) gating access to `/api/admin/feedback`.
   - Emergency contact OTP verification: OTP codes are securely dispatched via SMS/email and **never** returned in HTTP API responses unless explicitly running in local dev mode with `EXPOSE_DEV_OTP=1`.
3. **Photo Privacy & Instant Deletion (Zero Retention):**
   - User selfie photos are sent strictly with explicit user consent.
   - Computer vision (Gemini 1.5 Vision or local private PIL facial/hair pixel sampling) extracts dominant palette colors (`skinTone`, `hairColor`, `glasses`, `outfitColor`).
   - Image bytes are processed entirely in ephemeral memory and **immediately purged** after extraction. Zero photos or biometric vectors are ever stored on disk or in the database.
4. **Zero-Mock & Clinical Safety Standards:**
   - Strict ban on fabricated metrics: Mood Journey and Burnout Risk cards show dynamic user calculations or honest empty states when fewer than 2 logs exist.
   - 8-Stage safety pipeline screen all incoming messages: immediate high-risk detection redirects to Tele-MANAS (14416) / National Emergency (112).
   - Strict medical boundaries: AI will not diagnose or prescribe pharmaceuticals, guiding users toward licensed professional support.

