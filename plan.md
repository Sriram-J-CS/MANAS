# Implementation Plan: MANAS Strict Backend & Multi-User Isolation

**Project**: MANAS AI Digital Mental Twin & Emotional Wellness Companion  
**Branch**: `backend-isolation`  
**Model Strategy**: `gemini-3.8-flash` (thinking LOW for conversational replies, MEDIUM for background analysis)

---

## 1. Executive Summary & Architecture Overview

The goal of this initiative is to eliminate all forms of cross-user data leakage, migrate to a single unified authentication architecture backed by Supabase with Row Level Security (RLS), enforce cryptographic user isolation where the server derives user identity solely from verified JWT tokens, and deliver modern ChatGPT/Gemini-style chat history, automatic background intelligence tracking, and compliant data deletion workflows.

---

## 2. Phase 0: Data Leak Audit & Remediation Findings

### A. Client-Side Storage Leaks (localStorage / sessionStorage / IndexedDB)
| Leak Location | File(s) | Current Behavior | Target Remediation |
|---|---|---|---|
| `manas_twin_profile` | `speechGateway.ts`, `EditProfileModal.tsx`, `PrivacyCenterModal.tsx` | Stored un-namespaced in `localStorage`. Leaks across users on the same machine. | Namespace with `${userId}:manas_twin_profile` and wipe on logout/switch/deletion. |
| `manas_chat_${userId}` | `ChatCompanionModal.tsx`, `aiChatService.ts` | Fallback to `manas_chat_default_user` when user is unauthenticated, sharing chat between anonymous sessions. | Replace with Supabase database `conversations` + `messages` tables; wipe all local caches. |
| `manas_mascot_db` (IndexedDB) | `mascotModelStorage.ts` | Uses static database name `manas_mascot_db` and key `current_custom_mascot`. Models persist across different user logins. | Namespace store by `user_id` and add complete IndexedDB purge on logout and account deletion. |
| `manas_access_token` / `manas_user_id` | `AuthModal.tsx`, `aiChatService.ts` | Static keys in localStorage; unauthenticated calls default to `'default_user'`. | Single Supabase client handles session; clear on sign out. |
| Service Worker Caches | `public/sw.js` | Caches VRM files in `manas-vrm-models-v1`. While VRM base models are public, custom avatar caches must be purged on deletion. | Add purge capability to service worker messaging on logout/delete. |

### B. Global Variables & Server-Side In-Memory Singletons
| Leak Location | File(s) | Current Behavior | Target Remediation |
|---|---|---|---|
| `_IN_MEMORY_SESSIONS` | `backend/app/services/redis_cache.py` | Global dictionary mapping `session_id` without verifying the requesting user's identity. | Bind sessions to validated `user_id` from JWT; clear on session completion. |
| `_IN_MEMORY_RATE_LIMITS` & `_IN_MEMORY_COSTS` | `backend/app/services/redis_cache.py` | In-memory fallback tracking. | Strictly keyed by verified `user_id`. |
| `get_current_user_id` fallback | `backend/app/auth/dependencies.py` | Returns `"guest_user"` when no valid token is supplied, consolidating all guest users into one shared profile. | Require valid Supabase token. For guests, client creates an anonymous Supabase session (`signInAnonymously`). |

### C. Database Tables Lacking `user_id`
| Table | Current Schema | Remediation |
|---|---|---|
| `voice_ratings` | `id`, `language`, `voice_gender`, `voice_name`, `overall_rating` (No `user_id`) | Add `user_id uuid references auth.users on delete cascade` with RLS. |
| `pipeline_traces` | `session_id`, `language`, ... (No `user_id`) | Anonymized telemetry remains decoupled or explicitly references optional `user_id`. |

### D. Hardcoded / Seeded Demo Data Leaks
| Demo Artifact | File(s) | Remediation |
|---|---|---|
| Hardcoded name `"Sriram"` | `gemini_provider.py` (L384-386), `ChatCompanionModal.tsx` (L660-663) | Remove hardcoded conditional logic; dynamically format user-provided names only. |
| Hardcoded name `"akshay"` | `aiChatService.ts` (L118) | Remove `"akshay"` exclusion; dynamically use verified profile name. |
| Hardcoded placeholder `"Sriram"` | `AuthModal.tsx` (L495, L565) | Replace placeholder with generic `"e.g. Alex"`. |
| Hardcoded companion name `"Luna"`/`"Maya"` on boy avatar | `MascotCustomizer.tsx`, `EditProfileModal.tsx` | Separate avatar gender and voice gender; default companion name aligns to gender (e.g., Aarav for Boy, Ananya for Girl). |
| Seeded Ratings & Feedback | `FeedbackDashboardModal.tsx`, `twin.py` | Replace mock/seeded fallback metrics with clean empty states (`"No entries recorded yet"`). |

---

## 3. Phase-by-Phase Execution Plan

### Phase 0: Audit Leaks & Remediation
- **Files to touch**:
  - `frontend/src/lib/storage/userStorage.ts` (new unified storage namespacing & purging module)
  - `backend/app/services/gemini_provider.py` (remove hardcoded "Sriram")
  - `frontend/src/components/ChatCompanionModal.tsx` (remove hardcoded "Sriram")
  - `frontend/src/lib/ai/aiChatService.ts` (remove hardcoded "akshay" and 'default_user' fallback)
  - `frontend/src/components/auth/AuthModal.tsx` (remove "Sriram" placeholders)
  - `backend/app/auth/dependencies.py` (remove `"guest_user"` fallback)
- **Risks**:
  - Breaking existing demo states if storage keys change.
  - *Mitigation*: Ensure smooth migration to authenticated or anonymous Supabase sessions.

### Phase 1: Supabase Foundation & Strict Isolation
- **Files to touch**:
  - `supabase/migrations/001_init.sql` (define 16 tables with RLS and CASCADE)
  - `backend/app/auth/dependencies.py` (Supabase JWT verification using `SUPABASE_JWT_SECRET` / `/auth/v1/user`)
  - `backend/app/database.py` (update PostgreSQL / Supabase connection pooling)
  - `frontend/src/lib/supabase.ts` (singleton Supabase client)
  - `frontend/src/lib/storage/userStorage.ts` (`clearAllAppStorage` implementation)
- **Risks**:
  - Supabase connectivity latency or missing environment variables.
  - *Mitigation*: Support pooler connection on port 5432, handle token caching, and fallback gracefully in test mode.

### Phase 2: OTP Login (Supabase) & SMS Test Mode
- **Files to touch**:
  - `frontend/src/components/auth/AuthModal.tsx` (refactor to `supabase.auth.signInWithOtp`, `verifyOtp`, `signInWithPassword`, `signUp`)
  - `frontend/src/components/OnboardingModal.tsx` (Step 4 Contact & Safety Verification using unified Supabase phone OTP)
  - `frontend/src/components/profile/EditProfileModal.tsx` (Add "Secure my account" flow for anonymous sessions)
  - `.env` / `backend/app/main.py` (`SMS_TEST_MODE` support)
- **Risks**:
  - Supabase rate limits on SMS (60s cooldown).
  - *Mitigation*: Enforce UI countdown timer and support test numbers in `SMS_TEST_MODE`.

### Phase 3: Onboarding Rules & Companion Voice Gender Single Source of Truth
- **Files to touch**:
  - `frontend/src/components/OnboardingModal.tsx`
    - Disable Next button until input is valid (Name 2+ chars, Age 13-100 without prefilled default, Companion chosen, Contact OTP verified, Language selected).
    - Inline hints when disabled.
    - "Skip for now" is the sole bypass.
    - Photo step live 3D preview with `applyAppearance` and adjust/reset.
  - `frontend/src/lib/voice/speechGateway.ts`
    - Read companion & voice gender strictly from saved profile at call time.
    - Assert boy -> male speaker, girl -> female speaker across all 8 languages.
  - `frontend/src/components/profile/EditProfileModal.tsx`
    - Independent toggles for Avatar Gender and Voice Gender.
  - `backend/tests/test_voice_gender_matrix.py` (automated test asserting speaker list across 8 languages).
- **Risks**:
  - Audio playback failure on un-interacted mobile browsers.
  - *Mitigation*: Retain `sharedAudioContext` user interaction unlocks.

### Phase 4: ChatGPT / Gemini / Claude Style Chat History
- **Files to touch**:
  - `supabase/migrations/001_init.sql` (`conversations` and `messages` tables)
  - `backend/app/api/conversations.py` or `backend/app/main.py` (routes: `GET /api/conversations`, `POST /api/conversations`, `PATCH /api/conversations/{id}`, `DELETE /api/conversations/{id}`, `GET /api/conversations/{id}/messages`)
  - `frontend/src/components/chat/ChatHistoryDrawer.tsx` (new History drawer with Today/Yesterday/Earlier grouping, search, rename, delete)
  - `frontend/src/components/ChatCompanionModal.tsx` (integrate "New chat" button, History drawer toggle, Gemini auto-titling)
- **Risks**:
  - Race conditions in title generation during active streaming.
  - *Mitigation*: Trigger title generation asynchronously after the first assistant response finishes.

### Phase 5: Automatic Intelligence Tracking (No Manual Entry)
- **Files to touch**:
  - `backend/app/services/chat_extractor.py` (Gemini 3.8 Flash structured output extraction: mood, twin dimensions, empathy judge, what works, OCEAN, journal/goals, durable memories)
  - `frontend/src/components/twin/DigitalTwinModal.tsx` (remove "Quick Wellness Log", add "Auto-updated from your chats" label)
  - `frontend/src/components/personality/PersonalityDiscoveryModal.tsx` (add 2-line Big Five explainer and "How MANAS adapts to you" toggle)
  - `frontend/src/components/interventions/WhatWorksModal.tsx` (dynamic 3-5 suggestions with evidence and action)
  - `frontend/src/components/chat/AutoSaveToast.tsx` (Undo toast integration)
- **Risks**:
  - Over-triggering crisis safety card on ordinary stress.
  - *Mitigation*: Strict classification thresholding; high-risk only triggers crisis response, everyday stress does not.

### Phase 6: Menu & Screen Alignment
- **Files to touch**:
  - `frontend/src/components/MenuOverlay.tsx` (remove Customize Mascot & Avatar Studio)
  - `frontend/src/components/ChatCompanionModal.tsx` (remove Customize Mascot & Avatar Studio from top-right menu; keep PHOTO button near avatar)
  - `frontend/src/components/chat/MoodJourneyDrawer.tsx` (pure `mood_events` history, remove manual emoji check-in, clean empty state)
  - `frontend/src/components/admin/FeedbackDashboardModal.tsx` (show only authenticated user's real empathy scores, empty state for new user)
  - `frontend/src/components/memory/MemoryCenterModal.tsx` (tabs: "Saved memories" and "Past chats", edit/delete items)
  - `frontend/src/components/privacy/PrivacyCenterModal.tsx` (remove JSON export, link toggles to `consents` table, eliminate unverified claims)
- **Risks**:
  - Broken modal triggers from other buttons in the UI.
  - *Mitigation*: Ensure all profile settings are cleanly accessible from `EditProfileModal.tsx`.

### Phase 7: Granular & Complete Data Deletion
- **Files to touch**:
  - `backend/app/services/privacy.py` (implement `delete_companion_memory` and `delete_all_user_data` via Supabase Admin API)
  - `frontend/src/components/privacy/PrivacyCenterModal.tsx` (dialogs for "Delete Companion Memory" and typing `DELETE` for "Delete My Data")
  - `frontend/src/lib/storage/userStorage.ts` (wipe all client storage and reset to Step 1 Language)
- **Risks**:
  - Orphaned rows in related tables.
  - *Mitigation*: Use PostgreSQL `ON DELETE CASCADE` across all foreign keys referencing `auth.users(id)`.

### Phase 8: Comprehensive Verification & QA
- Automated test suites:
  - `tests/test_isolation_security.py`
  - `backend/tests/test_voice_gender_matrix.py`
  - `backend/tests/test_auto_features.py`
- Manual cross-browser QA verification:
  1. Two accounts (Account A boy, Account B girl) in separate browsers.
  2. OTP end-to-end in test mode.
  3. Validation on onboarding steps.
  4. Speaker gender matching across all 8 languages.
  5. Chat persistence & History drawer.
  6. Auto-tracking population across Mood, Twin, Empathy, What Works.
  7. Verification of zero rows remaining after DELETE.
