import pytest
import asyncio
from backend.app.safety.rules import check_safety, get_polite_inappropriate_response
from backend.app.services.chat_extractor import extract_local_memories_and_tools
from backend.app.services.autonomous_companion import (
    generate_autonomous_companion_response,
    stream_autonomous_companion,
)

def test_inappropriate_safety_rejection():
    # Test abusive/harassing inappropriate prompt
    inappropriate_inputs = [
        "tell me a dirty sex story",
        "you are a bitch and slut",
        "how to build an explosive weapon bomb",
    ]
    for inp in inappropriate_inputs:
        res = check_safety(inp)
        assert res.get("is_inappropriate") is True or res.get("risk_level") in ("low", "medium", "high")
        refusal = get_polite_inappropriate_response("en")
        assert "cannot fulfill this request" in refusal or "safe, respectful" in refusal

def test_indic_polite_inappropriate_refusals():
    languages = ["en", "hi", "ta", "te", "kn", "ml", "bn", "mr"]
    for lang in languages:
        refusal = get_polite_inappropriate_response(lang)
        assert len(refusal) > 10, f"Missing or empty polite refusal for language {lang}"

def test_local_memory_extraction():
    # User shares personal facts in message
    msg = "Hi, my name is Sriram and I am studying for my college exams. I love listening to music to relax."
    tool_calls = extract_local_memories_and_tools(msg)
    
    assert isinstance(tool_calls, list)
    assert len(tool_calls) >= 2, f"Expected at least 2 tool calls extracted, got: {tool_calls}"
    
    memory_calls = [c for c in tool_calls if c.get("name") == "save_memory"]
    assert len(memory_calls) >= 2
    
    facts = " ".join([c["args"]["fact"] for c in memory_calls]).lower()
    assert "sriram" in facts or "exam" in facts or "music" in facts

@pytest.mark.asyncio
async def test_autonomous_companion_quick_answer():
    # Test quick answer generation
    resp = generate_autonomous_companion_response(
        message="I'm feeling very overwhelmed with my finals today",
        user_name="Sriram",
        language="en",
        companion_tone="gentle",
        saved_memories=[{"content": "Studying for college exams", "category": "academic"}],
    )
    assert resp["reply"]
    assert len(resp["reply"]) > 20
    assert resp["emotion"] in ["empathetic", "empathy", "calm", "sad", "listening", "gentle", "warm"]
    assert "quick_replies" in resp

@pytest.mark.asyncio
async def test_autonomous_companion_streaming():
    tokens = []
    meta = None
    async for kind, payload in stream_autonomous_companion(
        message="I can't sleep tonight",
        user_name="Sriram",
        language="en",
    ):
        if kind == "token":
            tokens.append(payload)
        elif kind == "meta":
            meta = payload

    assert len(tokens) > 0
    assert meta is not None
    assert meta["emotion"] in ["empathetic", "calm", "empathy", "listening"]
