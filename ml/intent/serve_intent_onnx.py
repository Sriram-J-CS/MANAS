"""
serve_intent_onnx.py - High-Performance ONNX Intent Inference Server

Provides sub-15ms intent inference for MANAS:
  - venting
  - wants_solution
  - exercise
  - info
  - crisis
"""

import logging
import os
import re
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("onnx_intent_server")

app = FastAPI(
    title="MANAS Fast ONNX Intent Classifier",
    description="Multilingual MuRIL / XLM-R ONNX inference service for dialogue intent categorization",
    version="1.0.0"
)

INTENT_CLASSES = ["venting", "wants_solution", "exercise", "info", "crisis"]

MODEL_PATH = os.getenv("ONNX_INTENT_MODEL_PATH", "ml/intent/models/intent_model_int8.onnx")
TOKENIZER_DIR = os.getenv("ONNX_INTENT_TOKENIZER_DIR", "ml/intent/models/tokenizer")

ort_session = None
tokenizer = None


def init_runtime():
    global ort_session, tokenizer
    try:
        import onnxruntime as ort
        from transformers import AutoTokenizer

        if os.path.exists(MODEL_PATH) and os.path.exists(TOKENIZER_DIR):
            logger.info("Loading ONNX intent session from %s", MODEL_PATH)
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 2
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            ort_session = ort.InferenceSession(MODEL_PATH, sess_options, providers=["CPUExecutionProvider"])
            tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_DIR)
            logger.info("ONNX Intent Model initialized successfully.")
        else:
            logger.warning(
                "ONNX intent model file or tokenizer not found at '%s'. Using high-fidelity heuristic fallback.",
                MODEL_PATH
            )
    except Exception as e:
        logger.warning("ONNX runtime initialization note: %s. Using heuristic fallback.", e)


@app.on_event("startup")
def startup_event():
    init_runtime()


class IntentRequest(BaseModel):
    text: str
    language: Optional[str] = "en"


class IntentResponse(BaseModel):
    primary_intent: str
    confidence_scores: Dict[str, float]
    inference_type: str  # "onnx_muril" or "clinical_heuristic"


@app.post("/predict/intent", response_model=IntentResponse)
async def predict_intent(req: IntentRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text input")

    # If ONNX model is loaded, run tensor inference
    if ort_session is not None and tokenizer is not None:
        try:
            import numpy as np
            inputs = tokenizer(text, padding=True, truncation=True, max_length=128, return_tensors="np")
            ort_inputs = {
                "input_ids": inputs["input_ids"].astype(np.int64),
                "attention_mask": inputs["attention_mask"].astype(np.int64),
            }
            outputs = ort_session.run(None, ort_inputs)
            logits = outputs[0][0]
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / exp_logits.sum()

            scores = {cls_name: float(round(probs[i], 4)) for i, cls_name in enumerate(INTENT_CLASSES)}
            sorted_classes = sorted(scores.items(), key=lambda x: x[1], reverse=True)

            return IntentResponse(
                primary_intent=sorted_classes[0][0],
                confidence_scores=scores,
                inference_type="onnx_muril"
            )
        except Exception as e:
            logger.error("ONNX inference failed: %s, falling back to heuristics", e)

    # Deterministic Clinical Heuristic Fallback
    lower = text.lower()
    scores = {c: 0.1 for c in INTENT_CLASSES}

    if re.search(r"\b(want to die|kill myself|suicid|end my life|end it all|sethudalam|thatkolai|mar jaana|aatmahatya)\b", lower):
        scores["crisis"] = 0.95
        primary = "crisis"
    elif re.search(r"\b(breathe|breathing|grounding|exercise|somatic|4-7-8|5-4-3-2-1)\b", lower):
        scores["exercise"] = 0.90
        primary = "exercise"
    elif re.search(r"\b(give me a solution|solution|answer me|how do i|how can i|what should i do|what can i do|tell me what to do|fix this|how to)\b", lower):
        scores["wants_solution"] = 0.88
        primary = "wants_solution"
    elif re.search(r"\b(what is|explain|tell me about|difference between|how does|what does.*mean)\b", lower):
        scores["info"] = 0.85
        primary = "info"
    else:
        scores["venting"] = 0.82
        primary = "venting"

    return IntentResponse(
        primary_intent=primary,
        confidence_scores=scores,
        inference_type="clinical_heuristic"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
