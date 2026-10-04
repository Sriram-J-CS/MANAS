# EmotiCare AI Architecture Specification

> **Product**: EmotiCare AI  
> **Engine**: MANAS (Mental AI & Neural Adaptive System)  
> **Classification**: Emotional Wellness Companion & Digital Mental Twin (Non-Clinical)

---

## 1. Architectural Philosophy

EmotiCare AI is designed under three strict engineering imperatives:
1. **Zero Fabrication**: No simulated dashboard numbers, no hardcoded mood baselines, no fake ML confidence, and no fake progress bars. If user data does not exist, the system returns an honest empty state (`"Not enough data yet to establish baseline"`).
2. **Security P0 (Token-Derived Identity)**: The backend never trusts client-supplied `user_id` in request bodies, query params, or URL paths. The user identity is extracted strictly from cryptographically verified Bearer JWT tokens server-side.
3. **Privacy-by-Design & Zero Image Retention**: Sensitive artifacts (such as facial photos uploaded for 3D mascot tinting) are processed in-memory for attribute parameterization and immediately purged with 0 image retention.

---

## 2. Unified Production Stack

The application has been unified into a single, cohesive, production-grade architecture. All legacy orphaned Next.js / Auth.js prototypes have been formally decommissioned.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (Client Tier - Port 5173)                   │
│  React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion           │
│  React Three Fiber (R3F) + Three.js GLB Morph Target 3D Avatar         │
│  7 Production Modals: Twin, Personality, Privacy, Memory,              │
│  Interventions, Journal & Goals, Safety Plan & Helplines               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         REST / SSE / Bearer JWT
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    BACKEND (API Tier - Port 8008)                      │
│  FastAPI (Python 3.14) + Pydantic v2 Validation                        │
│  Domain Modules: Twin, Personality, Privacy, Interventions, Safety     │
│  Real Avatar Vision Attribute Extraction (Pillow / Gemini Vision)      │
│  Multilingual TTS/STT Orchestrator (8 Indian Languages)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                               SQL / ACID
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   DATA TIER (PostgreSQL / SQLite)                      │
│  Relational Schema: 20+ Tables with Foreign Keys, Constraints & Indexes│
│  Audit Logs, User Consents, Encrypted Profiles, Baseline Observations  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Domains & Services

### A. Digital Mental Twin Engine (`backend/app/services/twin.py`)
- Maintains longitudinal emotional baselines (mean, variance, trend).
- Computes strain / workload indicators from self-reported sleep, workload, and energy (without medical diagnoses).
- Computes typing cadence telemetry (typing speed, pause durations, correction ratio) compared strictly against the user's personal baseline.
- Proactive check-in evaluator governed by cooldowns and user consent.

### B. OCEAN Personality Discovery (`backend/app/services/personality.py`)
- Gamified, scenario-based Big Five assessment (5 situational dilemmas).
- Generates trait spectrums (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism).
- Modulates companion conversational style (e.g. structured vs. exploratory) without stereotyping.

### C. Privacy Center & Granular Consent (`backend/app/services/privacy.py`)
- Implements 10 distinct, revocable consent categories under DPDP principles.
- Full machine-readable data export (`POST /api/privacy/export`).
- Full cascading account purge (`POST /api/privacy/delete-account`).

### D. "What Works For Me" Interventions (`backend/app/services/interventions.py`)
- Tracks empirical efficacy of 6 self-regulation strategies (4-7-8 breathing, 5-4-3-2-1 grounding, cognitive reframing, reflective journaling, calming soundscapes, walking breaks).
- Shows honest counts (e.g. "Effective in 4 of 5 sessions") only when genuine feedback exists.

### E. Safety & Crisis Infrastructure (`backend/app/services/safety_service.py`)
- 7-section structured Safety Plan builder (Warning signs, internal coping, calming places, trusted contacts, professional contacts, crisis resources, environment safety steps).
- Direct integration with verified toll-free helplines: **Tele-MANAS (14416)**, Emergency (112), KIRAN (1800-599-0019), NIMHANS, Vandrevala Foundation, Childline (1098).
- Trusted Contact alerts require explicit consent.

### F. Real Avatar Parameterization (`backend/app/services/avatar_provider.py`)
- Photo processing pipeline extracts physical palette attributes (skin tone hex, dominant color tones, hair tone).
- Model textures and tints are mapped to the 3D GLB mascot.
- Input image buffer is immediately discarded from memory (Zero Retention guarantee).

### G. Multilingual Indian Voice Engine (`backend/app/services/voice_providers.py`)
- Full support for 8 Indian languages: English (`en-IN`), Hindi (`hi-IN`), Tamil (`ta-IN`), Telugu (`te-IN`), Kannada (`kn-IN`), Malayalam (`ml-IN`), Bengali (`bn-IN`), Marathi (`mr-IN`).
- Native voice synthesis via Sarvam AI (`bulbul:v2`) and speech recognition (`saarika:v2.5`), with Google Cloud Chirp 3 HD and Web Speech API fallbacks.
- Viseme mouth shapes mapped to Oculus/ARKit-compatible morph targets for genuine audio-driven lip sync.
