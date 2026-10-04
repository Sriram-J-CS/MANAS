# Model Card: MANAS Multilingual Risk & Intent Classifier

## Model Details
- **Model Name:** MANAS Multilingual Risk & Intent Classifier
- **Base Architecture:** `google/muril-base-cased` or `xlm-roberta-base` with asymmetric cost-sensitive loss (Focal Loss / Weighted Cross-Entropy).
- **Supported Languages:** English (`en`), Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Kannada (`kn`), Malayalam (`ml`).
- **Risk Taxonomy:**
  - `none`: General conversation, psychoeducation, casual greeting, positive reflection.
  - `low`: Manageable stress, academic concern, mild interpersonal friction.
  - `moderate`: Acute emotional pain, panic symptoms, insomnia, severe burnout.
  - `high`: Passive suicidal ideation, perceived burdensomeness, preparatory talk ("better off without me").
  - `imminent`: Active suicidal intent, plans, means inquiry, ongoing self-harm.

---

## CRITICAL SAFETY ARCHITECTURE RULE
> [!CAUTION]
> **Secondary Signal Only:** This classifier serves **strictly as an additional safety signal** and MUST NEVER be the sole crisis detector. The MANAS system enforces deterministic keyword/regex filtering (Layer 1) before model execution. If *either* the deterministic filter OR this classifier detects `high` or `imminent` risk, the system immediately diverts to the crisis protocol with verified helplines (Tele-MANAS `14416`, KIRAN `1800-599-0019`, Emergency `112`).

---

## Training & Loss Function
- **Asymmetric Class Penalty:** False negatives on `high` or `imminent` risk are penalized **5x to 10x higher** than false positives to guarantee sensitivity over specificity.
- **Stratified Split:** 80% train, 20% validation with stratified sampling across both risk tiers and languages.
- **Dataset:** Initial seed dataset (`risk_training_template.csv`) expandable with user-provided counselor-reviewed samples.

---

## Evaluation Guidelines
- Target Recall for `high` and `imminent` classes: **>= 0.98**.
- Any false negative in high-stakes tiers fails the automated deployment validation suite.
