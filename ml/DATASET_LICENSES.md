# Dataset & Model License Audit

This document audits the intellectual property, attribution requirements, and commercial compliance for all training, pre-training, fine-tuning, and evaluation datasets used in MANAS.

---

## Comprehensive License Check Table

| Dataset / Model | Author / Provider | Primary Purpose in MANAS | License | Commercial Use Permitted? | Attribution / Compliance Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **GoEmotions** | Google Research | Emotion classifier fine-tuning (58k Reddit comments labeled with 27 emotions mapped to 7 classes) | **Apache-2.0** | **YES** | Requires copyright notice and disclaimer in redistributed artifacts. Machine-translated via IndicTrans2. |
| **EmpatheticDialogues** | Meta AI Research | Dialogue evaluation benchmarks & empathy style validation | **CC-BY-NC 4.0** | **Conditional / Research** | Non-commercial for direct data redistribution. Permissible for evaluation benchmarking and synthetic reference distillation. |
| **ESConv (Emotional Support Conversation)** | Tsinghua University / CoRR | Clinical strategy taxonomies (Reflection, Validation, Reframing, Small Steps, Clarification) | **MIT License** | **YES** | Fully permissive. Requires standard copyright notice. Used to structure MANAS 7-strategy dialogue choices. |
| **Counsel Chat** | Bertie Vidgen et al. / CounselChat.com | CBT domain knowledge, psychoeducation response validation | **CC-BY 4.0 / Open Data** | **YES** | Freely usable with attribution. Sourced from licensed professional therapist answers on public forums. |
| **WHO mhGAP Intervention Guide** | World Health Organization (WHO) | Clinical protocols for depression, anxiety, stress, self-harm crisis routing | **CC BY-NC-SA 3.0 IGO** | **YES (Healthcare / Non-commercial terms)** | Used for factual psychoeducation grounding in RAG database (`backend/knowledge/`). Must preserve attribution to WHO. |
| **AI4Bharat IndicTrans2** | AI4Bharat / IIT Madras | Multilingual machine translation between English and 22 Indian languages | **MIT License / CC-BY 4.0** | **YES** | State-of-the-art open models for Indic translation. Permissive commercial and research deployment. |
| **MuRIL (Multilingual Representations for Indian Languages)** | Google Research | Multilingual encoder backbone for emotion and intent classification | **Apache-2.0** | **YES** | Hugging Face model (`google/muril-base-cased`). Covered under Apache-2.0 license for inference & ONNX export. |
| **IndicBERT** | AI4Bharat / IIT Madras | Secondary multilingual transformer for Dravidian and Indo-Aryan validation | **MIT License** | **YES** | Permissive open-source transformer architecture. Fully compatible with production ONNX runtime. |
| **Tele-MANAS & Verified Helpline Directory** | Ministry of Health & Family Welfare (MoHFW), Govt of India | Critical public emergency crisis routing (14416, 112, 1800-599-0019) | **Public Domain / Official Directory** | **YES** | Official 24/7 public service toll-free numbers. Always presented verbatim without modification. |
| **Consented User Feedback Telemetry** | MANAS Internal | Offline clinical review, error analysis, and evaluation updates | **Proprietary / User-Consented** | **YES** | Governed under India's Digital Personal Data Protection Act (DPDP Act 2023) and GDPR. Requires explicit opt-in (`user_consent == 1`), de-identification, and zero automatic online learning. |

---

## Compliance Guidelines for Production Deployment

1. **Attribution File:** When distributing or deploying containerized images, maintain the notices file at `ml/ATTRIBUTION.txt` acknowledging Google Research (GoEmotions, MuRIL), AI4Bharat (IndicTrans2, IndicBERT), and Tsinghua University (ESConv).
2. **Clinical Safety Separation:** No third-party dataset is permitted to override safety gate Layer 1 rules or Tele-MANAS helpline emergency contacts.
3. **Synthetic Augmentation Safety:** Synthetic Indian-language data generated for training must undergo the dual-clinician review protocol detailed in `ml/feedback/FEEDBACK_LOOP.md`.
