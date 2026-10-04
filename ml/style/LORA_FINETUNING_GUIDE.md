# MANAS LLM LoRA Fine-Tuning Guide (Clinical & Consented Data Only)

This guide documents the strict end-to-end protocol for fine-tuning or LoRA-tuning an open-weights Large Language Model (e.g., Llama-3-8B-Instruct, Mistral-7B-v0.3, or Qwen-2.5-7B-Instruct) using **exclusively consented, de-identified, professionally reviewed mental health dialogue data**.

---

## 1. Ethical, Legal & Clinical Safeguards

### Non-Negotiable Training Preconditions
1. **Consent-Gated Data Ingestion:**
   Only conversations where the user explicitly checked the opt-in checkbox (`user_consent == 1`) during session feedback may enter the training ingestion pool.
2. **Deterministic & Automated PII Scrubbing:**
   All text must pass through automated named-entity recognition (NER) and regex-based redaction:
   - Phone numbers, email addresses, social handles, URLs.
   - Government identifiers (Aadhaar, PAN, Passport).
   - Personal names, clinic/hospital names, specific geographic localities.
   - Timestamps and session IDs replaced with randomized epoch offsets.
3. **Dual-Clinician Review & Sign-Off:**
   Raw conversations—even de-identified ones—**MUST NEVER** be fed directly into an LLM training job.
   Every conversation turn must be reviewed and rated by at least two licensed mental health practitioners (clinical psychologists or psychiatrists):
   - **Safety Check:** Zero encouragement of self-harm, unverified medical prescribing, or therapeutic overreach.
   - **Quality Check:** Adherence to evidence-based frameworks (CBT cognitive restructuring, ESConv emotional support strategies, MI motivational interviewing).
   - Only turns marked `approved_for_golden_dataset = YES` by both clinicians are converted into training pairs.

---

## 2. Dataset Preparation Pipeline

### Data Extraction Command
Use the automated exporter to dump consented batches:
```bash
python ml/feedback/export_feedback.py --negative-only
```
Review the exported batch in `ml/feedback/batches/clinical_review_batch_<timestamp>.csv`.

### Conversation Formatting (ChatML / ShareGPT Format)
Format accepted turns into the standard ChatML conversation format with explicit strategy metadata:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are MANAS, an empathetic, culturally attuned emotional wellness companion for India. You practice evidence-based emotional support, cognitive reframing, and active listening. You never provide medical diagnoses or prescribe medications. If crisis risk is present, you provide 24/7 helplines (Tele-MANAS 14416)."
    },
    {"role": "user", "content": "I feel like a complete failure because I didn't clear the exam cut-off."},
    {
      "role": "assistant",
      "content": "<thought>\nStrategy: validate_and_reframe\nEmotion: sadness (intensity 7/10)\nTopic: exam\nCognitive Distortion: all-or-nothing thinking\n</thought>\nI hear how painful this cut-off result is, especially after putting so much of your energy into preparing. It is completely natural to feel crushed right now. But falling short of a test score does not make *you* a failure as a human being. When you're ready, do you want to talk about how heavy this feels, or would you rather take things one quiet step at a time today?"
    }
  ]
}
```

---

## 3. QLoRA (4-Bit) Training Configuration

We recommend **QLoRA** (Quantized Low-Rank Adaptation) via Hugging Face `peft`, `bitsandbytes`, and `trl` (`SFTTrainer`) on an A100 (40GB/80GB) or RTX 4090 (24GB).

### Recommended Hyperparameters
| Parameter | Value | Clinical Justification |
| :--- | :--- | :--- |
| **Base Model** | `meta-llama/Meta-Llama-3-8B-Instruct` or `Qwen/Qwen2.5-7B-Instruct` | Strong multilingual and reasoning capability. |
| **Quantization** | 4-bit NormalFloat (`nf4`) with double quantization | Fits 8B parameter model in ~6 GB VRAM during training. |
| **LoRA Rank ($r$)** | 16 | Sufficient capacity for empathy style adaptation without catastrophic forgetting. |
| **LoRA Alpha ($\alpha$)** | 32 | Scaling factor ($2 \times r$) ensuring stable gradient propagation. |
| **Target Modules** | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` | Adapts all linear attention and MLP layers for linguistic richness. |
| **Learning Rate** | `2e-4` with Cosine decay | Prevents aggressive weight divergence from the base aligned checkpoint. |
| **Warmup Ratio** | `0.05` | Stable optimization during initial iterations. |
| **Batch Size** | 4 per device, gradient accumulation steps = 4 (Effective BS = 16) | Smooth gradient descent. |
| **Max Sequence Length** | 2048 tokens | Accommodates multi-turn context and reasoning scratchpads. |
| **Epochs** | 2 to 3 epochs | Avoids memorization of specific user anecdotes; encourages generalization. |

### Sample Training Script (`train_lora.py`)
```python
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

MODEL_ID = "meta-llama/Meta-Llama-3-8B-Instruct"

# 1. 4-bit Quantization Config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto"
)
model = prepare_model_for_kbit_training(model)

# 2. LoRA Adapter Config
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
)
model = get_peft_model(model, peft_config)

# 3. Load Clinically Approved Consented Dataset
dataset = load_dataset("json", data_files={"train": "curated_consented_train.jsonl"})

training_args = TrainingArguments(
    output_dir="./lora_manas_adapter",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    num_train_epochs=3,
    logging_steps=10,
    fp16=False,
    bf16=True,
    save_strategy="epoch"
)

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset["train"],
    peft_config=peft_config,
    tokenizer=tokenizer,
    args=training_args,
    max_seq_length=2048
)

trainer.train()
trainer.model.save_pretrained("./lora_manas_adapter_final")
tokenizer.save_pretrained("./lora_manas_adapter_final")
```

---

## 4. Post-Training Validation & Release Gate

Before the newly trained LoRA adapter can be deployed or merged into production:

1. **Deploy to a staging endpoint:**
   ```bash
   # Serve via vLLM or Ollama with LoRA adapter
   python -m vllm.entrypoints.openai.api_server \
       --model meta-llama/Meta-Llama-3-8B-Instruct \
       --enable-lora \
       --lora-modules manas-adapter=./lora_manas_adapter_final \
       --port 8000
   ```
2. **Execute the MANAS 200+ Multilingual Evaluation Harness:**
   ```bash
   python eval/run_eval.py
   ```
3. **Automated Release Blocker:**
   - **Safety Score MUST BE $\ge 4.80$** (Mandatory zero tolerance for missed crisis signals).
   - **Empathy Score MUST BE $\ge 4.20$**.
   - **Fluency across all 8 Indic languages MUST NOT regress** by more than 0.15 vs. baseline.
   - If any regression occurs, the release is blocked automatically by `eval/run_eval.py`.
