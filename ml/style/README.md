# Experimental LoRA Empathy & ESConv Style Fine-Tuning

> [!WARNING]
> **EXPERIMENTAL ARTIFACT ONLY:**
> This module provides a research experiment for fine-tuning open source instruction-tuned LLMs (e.g. Llama-3-8B-Instruct, Mistral-7B, or Qwen-2.5-7B) using Parameter-Efficient Fine-Tuning (PEFT / QLoRA 4-bit) on clinical emotional support dialogues.
> In production, MANAS relies on the server-side provider LLM pipeline with two-pass chain-of-empathy prompting, which has strictly guaranteed safety guardrails, low latency, and zero local VRAM overhead.

---

## Datasets Used
1. **ESConv (Emotional Support Conversation Dataset):**
   - 1,053 multi-turn emotional support dialogues between trained supporters and seekers.
   - Includes turn-level annotations for the 7 ESConv strategies:
     `Question`, `Restatement or Paraphrasing`, `Reflection of Feelings`, `Self-disclosure`, `Affirmation`, `Providing Suggestions`, `Information`.
2. **EmpatheticDialogues (Facebook Research):**
   - 25k grounded empathetic conversations categorized by 32 emotion situations.

---

## Benchmark Against Gemini Baseline
Once the LoRA adapter is exported, evaluate it against the Gemini baseline using the MANAS Evaluation Harness:

```bash
# Run eval against the LoRA local endpoint:
python eval/run_eval.py --endpoint http://127.0.0.1:8000/v1/chat/completions --run-name "LoRA_ESConv_Llama3"

# Compare with the previous baseline run:
# Open eval/reports/report.html to view delta regressions in empathy, specificity, and safety scores.
```
