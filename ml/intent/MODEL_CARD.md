# Model Card: MANAS Multilingual Intent Classifier (MuRIL / XLM-R)

## Model Overview
- **Model Name:** MANAS Intent Classifier
- **Architecture:** Fine-tuned `google/muril-base-cased` / `xlm-roberta-base` with sequence classification head, exported to INT8 quantized ONNX graph.
- **Languages Supported:** English (`en`), Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Kannada (`kn`), Malayalam (`ml`), Bengali (`bn`), Marathi (`mr`), Tanglish, Hinglish.
- **Classes (5):**
  1. `venting`
  2. `wants_solution`
  3. `exercise`
  4. `info`
  5. `crisis`

---

## Clinical Scope & Safety Constraints
- **Primary Function:** Determines conversational readiness and directs conversation flow.
- **Rule of Solution Mode:** If `intent == 'wants_solution'`, the pipeline delivers direct actionable guidance, avoiding breath-pacing exercises unless explicitly requested.
- **Crisis Priority:** Any match for suicide or self-harm immediately escalates to emergency helpline protocol (`Tele-MANAS 14416`), independent of model confidence.
- **Non-Diagnostic:** This model does NOT diagnose mental health conditions.

---

## Training Methodology
- **Data Composition:**
  - 12,000 counselor-annotated dialogue utterances from ESConv and Counsel Chat.
  - Multi-turn synthetic and translated Indic samples generated via AI4Bharat IndicTrans2.
  - Tanglish and Hinglish colloquial samples.
- **Loss Function:** Weighted Cross-Entropy with 2.0x recall penalty on `crisis` to minimize false negatives.
- **ONNX Export:** Quantized with `quantize_dynamic` (QInt8) for <15ms latency on CPU.
