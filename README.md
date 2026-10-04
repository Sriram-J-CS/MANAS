# EmotiCare AI: AI Digital Mental Twin Platform

> **Product**: EmotiCare AI  
> **Engine**: MANAS (Mental AI & Neural Adaptive System)  
> **Core Concept**: AI Digital Mental Twin & Emotional Wellness Companion  
> **Classification**: Non-clinical emotional-wellness and self-reflection companion

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black?logo=three.js)](https://threejs.org)
[![Privacy](https://img.shields.io/badge/Privacy-DPDP%20Act%202023%20Aligned-success)](#privacy-center--consent)

---

## Important Non-Clinical Disclaimer
**EmotiCare AI is NOT a medical diagnosis system or healthcare provider.**  
It is an emotional-wellness and self-reflection companion. It never provides clinical diagnoses, clinical certainty, medication prescriptions, or guaranteed mental-health outcomes. If you are experiencing acute emotional crisis or distress, please connect immediately with accredited professional services: **Tele-MANAS toll-free 24/7 at 14416** or Emergency Services at **112**.

---

## 1. Quick Start: How to Run EmotiCare AI

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 18+ and npm

### Terminal 1 — Start FastAPI Backend (Port 8008)
```bash
# In project root:
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8008 --reload
```
*API is live at [http://127.0.0.1:8008](http://127.0.0.1:8008) (Swagger UI: [http://127.0.0.1:8008/docs](http://127.0.0.1:8008/docs))*

### Terminal 2 — Start React + Vite Frontend (Port 5173)
```bash
# In project root:
npm --prefix frontend run dev
```
*Web Application is live at [http://localhost:5173](http://localhost:5173)*

---

## 2. Core Capabilities & Production Domains

### 1. Digital Mental Twin Engine
- Longitudinal personal baselines (mean mood, variance, and trend calculations from actual user entries).
- Workload and strain signals derived from self-reported sleep, workload, and energy (without medical claims).
- Typing cadence telemetry (speed, pauses, correction ratio) compared strictly against the user's personal baseline.
- Zero-fabrication honest empty states (`"Not enough data yet to establish baseline"`).

### 2. Gamified OCEAN Personality Discovery
- Scenario-based Big Five discovery (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism).
- Dynamic conversational style modulation without stereotyping.

### 3. "What Works For Me" Intervention Efficacy Tracking
- Tracks real empirical feedback across 6 self-regulation tools (4-7-8 breathing, 5-4-3-2-1 grounding, cognitive reframing, journaling, soundscapes, walking breaks).

### 4. User-Controlled Memory Center
- Granular review, manual entry, editing, and deletion of stored facts, preferences, and coping tools.

### 5. Journal, Goals, Future Self & Weekly Reflection
- Reflective journaling with mood associations and optional privacy locks.
- Goal tracking with milestone progress and habit connections.
- Future self aspirations and weekly synthesis based on real weekly check-in data.

### 6. Safety Plan & Verified Emergency Helplines
- 7-section structured Safety Plan builder.
- Trusted Contacts management with explicit consent gates.
- Direct links to **Tele-MANAS (14416)**, National Emergency (112), KIRAN, NIMHANS, and Childline (1098).

### 7. Privacy Center & Granular Consent (DPDP Act 2023)
- 10 independently revocable consent categories.
- Single-click machine-readable JSON data export (`POST /api/privacy/export`).
- Permanent cascading account purge (`POST /api/privacy/delete-account`).

### 8. Real 3D Mascot Parameterization & Voice
- Zero Image Retention: Uploaded photos extract color palette and skin tone in-memory and are immediately purged.
- Three.js / React Three Fiber GLB 3D mascot with morph target facial expressions, blinking, breathing, and gaze.
- Native speech in 8 Indian languages (en, hi, ta, te, kn, ml, bn, mr) via Sarvam AI and Google Cloud Chirp 3 HD.

---

## 3. Security Architecture (P0)

1. **Token-Derived Identity**: The backend never derives user authorization from URL parameters, request bodies, or query strings. User identity is cryptographically derived from verified Bearer JWT tokens.
2. **Cross-User Snooping Defense**: Any attempt by User A to access User B's chat, mood, memory, journal, or safety plan results in an immediate `403 Forbidden`.
3. **Dev OTP Protection**: Development OTP codes are isolated behind `EXPOSE_DEV_OTP=1` and strictly hidden in production (`EXPOSE_DEV_OTP=0`).

---

## 4. Verification & Testing

EmotiCare AI features an automated test suite with **63 passing tests**:

```bash
# 1. Run all Pytest integration, pipeline, and security tests (52 tests)
python -m pytest tests/ backend/tests/

# 2. Run live server crisis triage regression (11 tests)
python tests/test_crisis.py

# 3. Verify TypeScript build and production bundle
npm --prefix frontend run build
```

---

## 5. Architecture Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md): Unified stack overview, component diagrams, and service breakdown.
- [`SECURITY.md`](SECURITY.md): Authorization matrix, token validation, and rate limiting.
- [`PRIVACY.md`](PRIVACY.md): DPDP Act 2023 compliance, 10 consent categories, export, and deletion.
- [`AI_SAFETY.md`](AI_SAFETY.md): 6-stage AI safety pipeline, non-clinical boundaries, and crisis escalation.
- [`TESTING.md`](TESTING.md): Test suite architecture and execution commands.
- [`DEPLOYMENT.md`](DEPLOYMENT.md): Local development, environment configuration, and production deployment.
