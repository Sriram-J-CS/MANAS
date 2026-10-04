"""
serve_risk_onnx.py - High-Performance ONNX Risk Inference Server (Second Opinion Only)

Provides secondary risk classification:
  - none
  - low
  - moderate
  - high
  - imminent

CRITICAL SAFETY RULE:
This ML service is ONLY a secondary opinion and NEVER the sole safety gate.
Deterministic rule checks always take precedence.
"""

import logging
import os
import re
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("onnx_risk_server")

app = FastAPI(
    title="MANAS Fast ONNX Risk Classifier (Secondary Safety Opinion)",
    description="Multilingual MuRIL / XLM-R ONNX risk triage service. Never the sole safety gate.",
    version="1.0.0"
)

RISK_CLASSES = ["none", "low", "moderate", "high", "imminent"]

MODEL_PATH = os.getenv("ONNX_RISK_MODEL_PATH", "ml/risk/models/risk_model_int8.onnx")
TOKENIZER_DIR = os.getenv("ONNX_RISK_TOKENIZER_DIR", "ml/risk/models/tokenizer")

ort_session = None
tokenizer = None


def init_runtime():
    global ort_session, tokenizer
    try:
        import onnxruntime as ort
        from transformers import AutoTokenizer

        if os.path.exists(MODEL_PATH) and os.path.exists(TOKENIZER_DIR):
            logger.info("Loading ONNX risk session from %s", MODEL_PATH)
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 2
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            ort_session = ort.InferenceSession(MODEL_PATH, sess_options, providers=["CPUExecutionProvider"])
            tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_DIR)
            logger.info("ONNX Risk Model initialized successfully.")
        else:
            logger.warning(
                "ONNX risk model file not found at '%s'. Using high-fidelity heuristic fallback.",
                MODEL_PATH
            )
    except Exception as e:
        logger.warning("ONNX runtime risk initialization note: %s. Using heuristic fallback.", e)


@app.on_event("startup")
def startup_event():
    init_runtime()


class RiskRequest(BaseModel):
    text: str
    language: Optional[str] = "en"


class RiskResponse(BaseModel):
    risk_level: str
    confidence_scores: Dict[str, float]
    inference_type: str
    is_second_opinion_only: bool = True
    safety_disclaimer: str = "Secondary signal only. Deterministic rule triage takes precedence."


@app.post("/predict/risk", response_model=RiskResponse)
async def predict_risk(req: RiskRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text input")

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

            scores = {cls_name: float(round(probs[i], 4)) for i, cls_name in enumerate(RISK_CLASSES)}
            sorted_classes = sorted(scores.items(), key=lambda x: x[1], reverse=True)

            return RiskResponse(
                risk_level=sorted_classes[0][0],
                confidence_scores=scores,
                inference_type="onnx_muril"
            )
        except Exception as e:
            logger.error("ONNX risk inference failed: %s, falling back to heuristics", e)

    # Heuristic Clinical Fallback
    lower = text.lower()
    scores = {c: 0.05 for c in RISK_CLASSES}

    if re.search(r"\b(kill myself|swallowed pills|hanging|take my own life|shoot myself|suicide tonight)\b", lower):
        scores["imminent"] = 0.98
        level = "imminent"
    elif re.search(r"\b(want to die|end it all|better off dead|no reason to live|suicid|tharkolai|mar jaana)\b", lower):
        scores["high"] = 0.92
        level = "high"
    elif re.search(r"\b(can'?t take this anymore|hopeless|hate myself|burden|cut myself|overwhelmed)\b", lower):
        scores["moderate"] = 0.85
        level = "moderate"
    elif re.search(r"\b(stressed|tired|worried|anxious|sad|pressure)\b", lower):
        scores["low"] = 0.80
        level = "low"
    else:
        scores["none"] = 0.90
        level = "none"

    return RiskResponse(
        risk_level=level,
        confidence_scores=scores,
        inference_type="clinical_heuristic"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8011)
