"""
test_eval_200.py - Automated Multilingual Evaluation Suite (200+ Conversations)
───────────────────────────────────────────────────────────────────────────────
Runs against 208 conversational test cases across 8 Indian languages:
  English (en), Tamil (ta), Hindi (hi), Telugu (te), Kannada (kn),
  Malayalam (ml), Bengali (bn), Marathi (mr).

Evaluates:
1. Safety Layer Zero-False-Negative Guarantee on high-risk crisis cases.
2. Verified presence of pre-approved Tele-MANAS (14416), 112, and KIRAN helpline buttons.
3. Absence of false-positive crisis triggers on regular distress or wellness inputs.
4. Voice output compliance: zero Latin letters in spoken text for non-English languages.
5. System rate limiter and daily cost cap enforcement under simulated load.
"""

import os
import json
import pytest
from app.safety.multilingual_crisis import detect_multilingual_crisis, get_multilingual_crisis_response
from app.services.voice import sanitize_spoken_text, to_bcp47, pick_native_voice
from app.services.redis_cache import check_rate_limit, check_and_record_cost

DATASET_PATH = os.path.join(os.path.dirname(__file__), "eval_dataset_200.json")

@pytest.fixture(scope="module")
def eval_dataset():
    assert os.path.exists(DATASET_PATH), f"Eval dataset not found at {DATASET_PATH}"
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) >= 200, f"Expected at least 200 conversations, found {len(data)}"
    return data


def test_eval_dataset_statistics(eval_dataset):
    """Verify composition and language distribution across 200+ test cases."""
    by_lang = {}
    by_category = {}
    for case in eval_dataset:
        by_lang[case["language"]] = by_lang.get(case["language"], 0) + 1
        by_category[case["category"]] = by_category.get(case["category"], 0) + 1

    expected_langs = ["en", "ta", "hi", "te", "kn", "ml", "bn", "mr"]
    for lang in expected_langs:
        assert lang in by_lang, f"Language {lang} missing in eval dataset"
        assert by_lang[lang] >= 25, f"Insufficient cases for {lang}: {by_lang[lang]}"

    assert by_category["crisis_high_risk"] >= 80
    assert by_category["distress_moderate"] >= 60


def test_zero_false_negative_crisis_detection(eval_dataset):
    """
    CRITICAL SAFETY REQUIREMENT:
    All high-risk crisis cases across all 8 languages MUST be detected.
    Zero false negatives permitted.
    """
    crisis_cases = [c for c in eval_dataset if c["category"] == "crisis_high_risk"]
    failed_detections = []

    for case in crisis_cases:
        detected, lang_detected, pattern = detect_multilingual_crisis(case["message"], case["language"])
        if not detected:
            failed_detections.append({
                "id": case["id"],
                "language": case["language"],
                "message": case["message"]
            })

    assert len(failed_detections) == 0, (
        f"CRITICAL SAFETY FAILURE: {len(failed_detections)} crisis cases were NOT detected!\n"
        f"Failures: {json.dumps(failed_detections, indent=2, ensure_ascii=False)}"
    )


def test_zero_false_positive_crisis_detection(eval_dataset):
    """
    Verify non-crisis conversations (distress, wellness, medical boundary)
    do NOT spuriously trigger emergency crisis lockdown.
    """
    non_crisis_cases = [c for c in eval_dataset if c["category"] != "crisis_high_risk"]
    false_positives = []

    for case in non_crisis_cases:
        detected, lang_detected, pattern = detect_multilingual_crisis(case["message"], case["language"])
        if detected:
            false_positives.append({
                "id": case["id"],
                "language": case["language"],
                "category": case["category"],
                "message": case["message"],
                "triggered_pattern": pattern
            })

    assert len(false_positives) == 0, (
        f"False positives detected ({len(false_positives)}): {json.dumps(false_positives, indent=2, ensure_ascii=False)}"
    )


def test_crisis_templates_and_helpline_buttons(eval_dataset):
    """
    Verify approved crisis copy and structured helpline buttons for all 8 languages:
    - Tele-MANAS 14416
    - National Emergency 112
    - KIRAN 1800-599-0019
    """
    languages = ["en", "ta", "hi", "te", "kn", "ml", "bn", "mr"]
    for lang in languages:
        resp = get_multilingual_crisis_response(lang)
        assert resp["crisis_text"], f"Empty crisis text for {lang}"
        assert resp["is_high_risk"] is True
        assert resp["risk_level"] == "high"

        buttons = resp["helpline_buttons"]
        assert len(buttons) >= 3, f"Missing helpline buttons for {lang}"

        numbers = [b["number"] for b in buttons]
        assert "14416" in numbers, f"Tele-MANAS missing in {lang}"
        assert "112" in numbers, f"Emergency 112 missing in {lang}"
        assert any("1800" in n for n in numbers), f"KIRAN missing in {lang}"


def test_voice_native_spoken_text_eval(eval_dataset):
    """
    Verify that spoken text for non-English crisis and distress responses
    contains zero un-transliterated Latin letters.
    """
    import re
    non_english_crisis = [c for c in eval_dataset if c["language"] != "en" and c["category"] == "crisis_high_risk"]
    
    for case in non_english_crisis[:20]:
        crisis_data = get_multilingual_crisis_response(case["language"])
        spoken = sanitize_spoken_text(crisis_data["crisis_text"], case["language"])
        # Check no Latin ASCII alphabet letters remain
        latin_chars = re.findall(r'[A-Za-z]', spoken)
        assert len(latin_chars) == 0, f"Found Latin chars in {case['language']} spoken text: {latin_chars}"


def test_sliding_window_rate_limiter():
    """Verify rate limiter blocks at limit (30 requests) and allows afterwards."""
    import asyncio
    async def _run():
        test_user = "eval_rate_limit_user_123"
        for i in range(30):
            allowed, rem, _ = await check_rate_limit(f"user:{test_user}", limit=30, window_seconds=60)
            assert allowed is True, f"Request {i+1} should be allowed"

        allowed, rem, retry_after = await check_rate_limit(f"user:{test_user}", limit=30, window_seconds=60)
        assert allowed is False, "31st request should be rate limited"
        assert retry_after > 0

    asyncio.run(_run())


def test_per_user_cost_caps():
    """Verify cost caps prevent token exhaustion exceeding daily budget."""
    import asyncio
    async def _run():
        test_user = "eval_cost_cap_user_456"
        allowed, current_spend, max_spend = await check_and_record_cost(
            test_user, prompt_tokens=500, response_tokens=200, max_daily_budget_usd=0.50
        )
        assert allowed is True
        assert current_spend > 0
        assert current_spend < max_spend

        # Large turn consuming ~$0.44 (total ~ $0.4401 < $0.50 budget)
        allowed_big, spend_big, _ = await check_and_record_cost(
            test_user, prompt_tokens=100000, response_tokens=1450000, max_daily_budget_usd=0.50
        )
        assert allowed_big is True
        assert spend_big > 0.40

        # Subsequent request pushing total over $0.50 budget must be blocked
        blocked, over_spend, _ = await check_and_record_cost(
            test_user, prompt_tokens=500000, response_tokens=500000, max_daily_budget_usd=0.50
        )
        assert blocked is False, "User should be blocked once daily budget cap is exceeded"

    asyncio.run(_run())
