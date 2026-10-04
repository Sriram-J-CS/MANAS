"""
Lightweight ONNX Emotion Inference Server
Provides fast (<15ms) emotion pre-check alongside Pass A.
Designed to be decoupled from heavy web app dependencies.
"""

import os
import json
import logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("onnx_emotion_server")

app = FastAPI(
    title="MANAS Fast ONNX Emotion Classifier",
    description="Multilingual MuRIL / XLM-R ONNX inference service for affective pre-checks",
    version="1.0.0"
)

EMOTION_CLASSES = [
    "sadness",
    "anxiety",
    "anger",
    "overwhelm",
    "grief",
    "hope",
    "neutral"
]

MODEL_PATH = os.getenv("ONNX_EMOTION_MODEL_PATH", "ml/emotion/models/emotion_model.onnx")
TOKENIZER_DIR = os.getenv("ONNX_TOKENIZER_DIR", "ml/emotion/models/tokenizer")

# Global session holder
ort_session = None
tokenizer = None


def init_runtime():
    global ort_session, tokenizer
    try:
        import onnxruntime as ort
        from transformers import AutoTokenizer

        if os.path.exists(MODEL_PATH) and os.path.exists(TOKENIZER_DIR):
            logger.info("Loading ONNX runtime session from %s", MODEL_PATH)
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 2
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            ort_session = ort.InferenceSession(MODEL_PATH, sess_options, providers=["CPUExecutionProvider"])
            tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_DIR)
            logger.info("ONNX Emotion Model initialized successfully.")
        else:
            logger.warning(
                "ONNX model file or tokenizer directory not found at '%s'. "
                "Serving in high-fidelity heuristic pre-check mode until notebook export is copied.",
                MODEL_PATH
            )
    except ImportError as e:
        logger.warning("onnxruntime/transformers not installed in current env: %s. Using heuristic pre-check.", e)


@app.on_event("startup")
def startup_event():
    init_runtime()


class EmotionRequest(BaseModel):
    text: str
    language: str = "en"


class EmotionResponse(BaseModel):
    primary_emotion: str
    secondary_emotions: List[str]
    confidence_scores: Dict[str, float]
    inference_type: str  # "onnx_muril" or "heuristic_precheck"


@app.post("/predict/emotion", response_model=EmotionResponse)
async def predict_emotion(req: EmotionRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text input")

    # If ONNX session is available, run tensor inference
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
            # Softmax
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / exp_logits.sum()

            scores = {cls_name: float(round(probs[i], 4)) for i, cls_name in enumerate(EMOTION_CLASSES)}
            sorted_classes = sorted(scores.items(), key=lambda x: x[1], reverse=True)

            return EmotionResponse(
                primary_emotion=sorted_classes[0][0],
                secondary_emotions=[c[0] for c in sorted_classes[1:3] if c[1] > 0.15],
                confidence_scores=scores,
                inference_type="onnx_muril"
            )
        except Exception as e:
            logger.error("ONNX inference failed: %s, falling back to heuristic", e)

    # Heuristic clinical pre-check fallback
    lower = text.lower()
    scores = {c: 0.1 for c in EMOTION_CLASSES}

    if any(w in lower for w in ("scared", "fear", "anxious", "panic", "worry", "racing", "bayama", "dar", "bhaya", "pedi")):
        scores["anxiety"] = 0.88
    elif any(w in lower for w in ("crying", "empty", "sad", "hopeless", "depressed", "kavalai", "dukh", "badha")):
        scores["sadness"] = 0.86
    elif any(w in lower for w in ("burnout", "exhausted", "too much", "drowning", "pressure", "mudiyala", "thak")):
        scores["overwhelm"] = 0.84
    elif any(w in lower for w in ("passed away", "lost", "died", "grief", "miss them")):
        scores["grief"] = 0.89
    elif any(w in lower for w in ("angry", "furious", "hate", "unfair", "betrayed", "kobam", "gussa")):
        scores["anger"] = 0.82
    elif any(w in lower for w in ("better", "thank you", "hopeful", "calm", "relief")):
        scores["hope"] = 0.80
    else:
        scores["neutral"] = 0.75

    sorted_classes = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return EmotionResponse(
        primary_emotion=sorted_classes[0][0],
        secondary_emotions=[c[0] for c in sorted_classes[1:3] if c[1] > 0.2],
        confidence_scores=scores,
        inference_type="heuristic_precheck"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8009)
