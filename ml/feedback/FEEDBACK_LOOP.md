# MANAS Feedback Loop & Clinical Review Architecture

## 1. Core Principle: Zero Automatic Online Learning
In mental health and emotional wellness applications, **automatic online learning (continual auto-training on raw user conversations) is strictly prohibited**. 
Allowing an AI model to continuously update its parameters on unverified user input introduces grave clinical risks:
- Malicious prompt injection or adversarial poisoning.
- Amplification of harmful self-injurious ruminations or cognitive distortions.
- Unchecked hallucination and drift away from evidence-based CBT/ESConv frameworks.

**MANAS Policy:**
> **Nothing is learned automatically from users.** Model weights are frozen in production. Datasets are strictly updated through an asynchronous, consented, de-identified, human-in-the-loop clinical review pipeline.

---

## 2. User Interface Signals & Consent Mechanics

The chat interface includes explicit feedback controls on each assistant turn:
1. **Action Buttons:**
   - 👍 **"Helpful"** (`rating = 1`, `felt_understood = 1`): Signifies attunement, appropriate validation, or helpful action step.
   - 💔 **"Didn't feel understood"** (`rating = -1`, `felt_understood = 0`): Signifies misaligned emotion, unhelpful advice, premature problem-solving, or robotic cliches.
2. **Consent Checkbox:**
   - `[ ] Allow anonymous review to help improve MANAS` (`user_consent = 1 | 0`).
   - Default state is **unchecked** (opt-in only, compliant with DPDP Act 2023 and GDPR).
3. **Database Storage Gate:**
   - If `user_consent == 0`: Only anonymous telemetry metrics (timestamp, rating category, trace ID) are stored. The actual conversation text (`user_message` and `bot_reply`) is set to `NULL` / discarded immediately.
   - If `user_consent == 1`: Message text is stored in `message_feedback` for offline de-identification and clinical audit.

---

## 3. Data Pipeline & De-Identification Protocol

Before any consented conversation is viewed by clinical reviewers:
1. **Identifier Stripping:** User UUIDs are replaced with irreversible cryptographic hashes: `HMAC-SHA256(user_id, salt)`.
2. **Automated PII Scrubbing:**
   - Indian phone numbers (`+91`, 10-digit mobile patterns).
   - Email addresses.
   - Indian National Identifiers (Aadhaar, PAN).
   - Specific named entities (people names, educational institutions, specific street addresses).
3. **Batch Export:** The script `ml/feedback/export_feedback.py` pulls consented records and exports them into standardized review sheets.

---

## 4. Clinical Review Protocol

1. **Reviewer Qualifications:** Only certified psychologists, psychiatric social workers, or trained wellness counselors review feedback batches.
2. **Review Criteria:**
   - **Affective Attunement:** Did the bot correctly discern the user's primary emotion and intensity?
   - **Intent Accuracy:** Did the bot recognize if the user wanted to vent vs. seek practical solutions?
   - **Safety & Boundaries:** Did the bot avoid prescriptive medical claims or invalidating clichés?
   - **Cultural & Linguistic Naturalness:** Did the response sound compassionate in the user's chosen language (Tamil, Hindi, Telugu, etc.)?
3. **Gold-Standard Curation:** Only turns that receive unanimous clinical sign-off are added to the curated evaluation harness or offline training corpus.
