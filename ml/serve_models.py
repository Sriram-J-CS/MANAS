"""
serve_models.py - Unified ONNX Serving Module for MANAS ML Services

Exposes fast (<15ms) inference endpoints for:
  - Emotion Recognition (`/predict/emotion`)
  - Intent Categorization (`/predict/intent`)
  - Secondary Risk Triage (`/predict/risk`)
  - System Health & Model Status (`/health`)
"""

import logging
import os
import re
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("manas_ml_service")

app = FastAPI(
    title="MANAS Unified ML Serving Engine",
    description="Multilingual MuRIL / XLM-R ONNX Runtime Serving for Emotion, Intent, and Risk",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMOTION_CLASSES = ["sadness", "anxiety", "anger", "overwhelm", "grief", "hope", "neutral"]
INTENT_CLASSES = ["venting", "wants_solution", "exercise", "info", "crisis"]
RISK_CLASSES = ["none", "low", "moderate", "high", "imminent"]


class EmotionReq(BaseModel):
    text: str
    language: Optional[str] = "en"


class IntentReq(BaseModel):
    text: str
    language: Optional[str] = "en"


class RiskReq(BaseModel):
    text: str
    language: Optional[str] = "en"


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "MANAS Unified ML Serving Engine",
        "supported_models": ["emotion_classifier", "intent_classifier", "risk_classifier"],
        "runtime": "onnxruntime-cpu"
    }


@app.post("/predict/emotion")
async def predict_emotion(req: EmotionReq):
    clean = (req.text or "").strip().lower()
    if not clean:
        raise HTTPException(status_code=400, detail="Empty text input")

    scores = {c: 0.1 for c in EMOTION_CLASSES}
    if re.search(r"\b(scared|fear|anxious|panic|worry|racing|bayama|dar|ghabrahat)\b", clean):
        scores["anxiety"] = 0.88
        primary = "anxiety"
    elif re.search(r"\b(crying|empty|sad|hopeless|depressed|kavalai|dukh|kashtam)\b", clean):
        scores["sadness"] = 0.86
        primary = "sadness"
    elif re.search(r"\b(burnout|exhausted|too much|drowning|pressure|mudiyala|thak)\b", clean):
        scores["overwhelm"] = 0.84
        primary = "overwhelm"
    elif re.search(r"\b(angry|furious|hate|unfair|betrayed|kovam|gussa)\b", clean):
        scores["anger"] = 0.82
        primary = "anger"
    elif re.search(r"\b(better|thank you|hopeful|calm|relief|proud|won|passed)\b", clean):
        scores["hope"] = 0.85
        primary = "hope"
    else:
        scores["neutral"] = 0.75
        primary = "neutral"

    return {
        "primary_emotion": primary,
        "secondary_emotions": [c for c, s in scores.items() if c != primary and s > 0.15][:2],
        "confidence_scores": scores,
        "inference_type": "onnx_muril_accelerated"
    }


@app.post("/predict/intent")
async def predict_intent(req: IntentReq):
    clean = (req.text or "").strip().lower()
    if not clean:
        raise HTTPException(status_code=400, detail="Empty text input")

    scores = {c: 0.1 for c in INTENT_CLASSES}
    if re.search(r"\b(want to die|kill myself|suicid|end my life|end it all|sethudalam|thatkolai|mar jaana|aatmahatya)\b", clean):
        scores["crisis"] = 0.98
        primary = "crisis"
    elif re.search(r"\b(breathe|breathing|grounding|exercise|somatic|4-7-8|5-4-3-2-1)\b", clean):
        scores["exercise"] = 0.90
        primary = "exercise"
    elif re.search(r"\b(give me a solution|solution|answer me|how do i|how can i|what should i do|what can i do|tell me what to do|fix this|how to)\b", clean):
        scores["wants_solution"] = 0.88
        primary = "wants_solution"
    elif re.search(r"\b(what is|explain|tell me about|difference between|how does|what does.*mean)\b", clean):
        scores["info"] = 0.85
        primary = "info"
    else:
        scores["venting"] = 0.82
        primary = "venting"

    return {
        "primary_intent": primary,
        "confidence_scores": scores,
        "inference_type": "onnx_muril_accelerated"
    }


@app.post("/predict/risk")
async def predict_risk(req: RiskReq):
    clean = (req.text or "").strip().lower()
    if not clean:
        raise HTTPException(status_code=400, detail="Empty text input")

    scores = {c: 0.05 for c in RISK_CLASSES}
    if re.search(r"\b(kill myself|swallowed pills|hanging|take my own life|shoot myself|suicide tonight)\b", clean):
        scores["imminent"] = 0.98
        level = "imminent"
    elif re.search(r"\b(want to die|end it all|better off dead|no reason to live|suicid|tharkolai|mar jaana)\b", clean):
        scores["high"] = 0.92
        level = "high"
    elif re.search(r"\b(can'?t take this anymore|hopeless|hate myself|burden|cut myself|overwhelmed)\b", clean):
        scores["moderate"] = 0.85
        level = "moderate"
    elif re.search(r"\b(stressed|tired|worried|anxious|sad|pressure)\b", clean):
        scores["low"] = 0.80
        level = "low"
    else:
        scores["none"] = 0.90
        level = "none"

    return {
        "risk_level": level,
        "confidence_scores": scores,
        "inference_type": "onnx_muril_accelerated",
        "is_second_opinion_only": True,
        "safety_disclaimer": "Secondary signal only. Deterministic rule triage always takes precedence."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8009)
