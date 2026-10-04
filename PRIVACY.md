# EmotiCare AI — Privacy Architecture & Consent Policy

## 1. Compliance Philosophy

EmotiCare AI is built on privacy-by-design principles adhering to the **Digital Personal Data Protection (DPDP) Act 2023** and global data privacy standards:
- **No Unsolicited PII Retention**: User account creation supports pseudonymized handles and zero-PII authentication.
- **Explicit, Granular Consent**: Personalization modules are governed by separate, individually revocable consent switches.
- **Zero Photo Retention Guarantee**: Uploaded face photos are used solely to extract physical styling attributes in-memory. The image buffer is immediately purged with 0 persistent disk retention.

---

## 2. The 10 Granular Consent Categories

Users retain full granular control within the **Privacy Center** modal:

1. `ai_personalization`: Digital Twin baseline tracking and conversational style adaptation.
2. `memory`: Long-term retention of preferences, helpful coping tools, and personal milestones.
3. `photo_processing`: In-memory avatar parameterization (zero disk retention).
4. `voice_processing`: Speech-to-text transcript processing and personalized voice tone.
5. `typing_analysis`: Keystroke cadence telemetry (speed, pauses, correction ratio) compared strictly against the user's personal baseline. Raw text is never stored in telemetry tables.
6. `voice_behavior_analysis`: Speaking tempo and vocal energy baseline tracking.
7. `proactive_checkins`: Evidence-based check-in prompts triggered only when meaningful baseline deviation is detected.
8. `personalized_recommendations`: Contextual suggestions for grounding, breathing, or calm soundscapes.
9. `trusted_contact_alert`: Explicit authorization required before any emergency contact notification can be dispatched.
10. `data_retention`: Retention of journal reflections and longitudinal goal histories.

---

## 3. Data Subject Rights & Endpoints

### A. View & Review Data
Users can inspect every memory item, baseline metric, mood entry, and personality trait from the Privacy Center and domain modals.

### B. Machine-Readable Data Export
- **Endpoint**: `POST /api/privacy/export`
- **Output**: Structured JSON object containing user profile, active consents, mood entries, chat history, memories, journals, goals, and safety plan.

### C. Right to Erasure / Cascading Account Deletion
- **Endpoint**: `POST /api/privacy/delete-account`
- **Action**: Cascades deletion across all database tables:
  - `user_consents`
  - `avatar_profiles`
  - `voice_profiles`
  - `chat_sessions` & `chat_messages`
  - `wellness_entries`
  - `typing_observations` & `voice_observations`
  - `goals` & `goal_milestones`
  - `journal_entries`
  - `weekly_reflections` & `future_self_entries`
  - `personality_assessments`
  - `what_works_profiles`
  - `safety_plans` & `trusted_contacts`
  - `users`
- An immutable, content-free deletion receipt is registered in `deletion_requests` for compliance audit verification.
