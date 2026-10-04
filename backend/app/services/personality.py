"""
services/personality.py - Gamified OCEAN / Big Five Personality Discovery
Scenario-based, non-clinical exploration of personality preferences.
Used to personalize communication tone and reflection framing without medical stereotyping.
"""
import uuid
import json
from typing import Dict, List, Any, Optional
from ..database import get_db

OCEAN_SCENARIOS = [
    {
        "id": "s1_weekend",
        "scenario": "You wake up on a completely free Saturday with zero responsibilities. What sounds most natural to you?",
        "options": [
            {
                "text": "Deep dive into a creative project, read an unusual book, or explore a new part of town.",
                "scores": {"openness": 0.9, "extraversion": 0.5, "neuroticism": 0.2}
            },
            {
                "text": "Call up a group of friends for brunch, a game, or an energetic get-together.",
                "scores": {"extraversion": 0.9, "agreeableness": 0.8, "openness": 0.6}
            },
            {
                "text": "Tidy up your space, organize your week ahead, and enjoy the calm of a clean plan.",
                "scores": {"conscientiousness": 0.95, "neuroticism": 0.2, "openness": 0.4}
            },
            {
                "text": "Rest quietly at home, recharge your social battery, and avoid too much noise.",
                "scores": {"extraversion": 0.2, "conscientiousness": 0.5, "neuroticism": 0.4}
            }
        ]
    },
    {
        "id": "s2_unexpected_delay",
        "scenario": "A major project deadline or exam gets suddenly rescheduled to 24 hours earlier. How does your mind first react?",
        "options": [
            {
                "text": "Feel a momentary spike of worry, then run through all the things that could go wrong.",
                "scores": {"neuroticism": 0.85, "conscientiousness": 0.6}
            },
            {
                "text": "Instantly create a triage checklist, prioritize the essentials, and execute step-by-step.",
                "scores": {"conscientiousness": 0.9, "neuroticism": 0.25, "openness": 0.5}
            },
            {
                "text": "Reach out to peers or teammates to check how they're handling it and coordinate together.",
                "scores": {"agreeableness": 0.9, "extraversion": 0.75, "neuroticism": 0.4}
            },
            {
                "text": "Take a breath, view it as an interesting challenge, and improvise with what you have.",
                "scores": {"openness": 0.85, "neuroticism": 0.2, "extraversion": 0.6}
            }
        ]
    },
    {
        "id": "s3_disagreement",
        "scenario": "A close friend or colleague has a viewpoint on something that feels strongly opposed to yours. How do you approach the conversation?",
        "options": [
            {
                "text": "Listen carefully to understand where they are coming from before sharing my thoughts gently.",
                "scores": {"agreeableness": 0.95, "openness": 0.75, "neuroticism": 0.2}
            },
            {
                "text": "Enjoy a spirited, lively debate exploring both sides with logical rigor.",
                "scores": {"extraversion": 0.7, "openness": 0.8, "agreeableness": 0.5}
            },
            {
                "text": "Focus on the facts and practical outcome rather than getting bogged down in debate.",
                "scores": {"conscientiousness": 0.8, "agreeableness": 0.6, "openness": 0.5}
            },
            {
                "text": "Feel uncomfortable with conflict and look for a quiet, gentle middle ground quickly.",
                "scores": {"agreeableness": 0.85, "neuroticism": 0.7, "extraversion": 0.3}
            }
        ]
    },
    {
        "id": "s4_learning_style",
        "scenario": "When you want to learn something completely new (a skill, topic, or hobby), what pulls you in?",
        "options": [
            {
                "text": "The big abstract ideas, theories, and philosophical connections behind it.",
                "scores": {"openness": 0.95, "conscientiousness": 0.4}
            },
            {
                "text": "A structured syllabus, daily practice tracker, and clear milestones.",
                "scores": {"conscientiousness": 0.95, "openness": 0.5}
            },
            {
                "text": "Joining a study group, workshop, or community where people learn together.",
                "scores": {"extraversion": 0.85, "agreeableness": 0.8}
            },
            {
                "text": "Hands-on tinkering at your own quiet pace with no pressure.",
                "scores": {"openness": 0.7, "extraversion": 0.3, "neuroticism": 0.3}
            }
        ]
    },
    {
        "id": "s5_recovery",
        "scenario": "After an emotionally draining or overwhelming day, what restores your inner peace best?",
        "options": [
            {
                "text": "A long walk with soothing ambient music or journaling your thoughts privately.",
                "scores": {"openness": 0.8, "extraversion": 0.25, "neuroticism": 0.4}
            },
            {
                "text": "Venting to someone who loves you and gives you warm, validating reassurance.",
                "scores": {"agreeableness": 0.9, "extraversion": 0.7, "neuroticism": 0.5}
            },
            {
                "text": "A hot shower, an early bedtime, and getting the room completely organized.",
                "scores": {"conscientiousness": 0.85, "neuroticism": 0.3}
            },
            {
                "text": "Watching a comfort show or engrossing yourself in a world of fiction.",
                "scores": {"openness": 0.75, "extraversion": 0.35, "neuroticism": 0.4}
            }
        ]
    }
]

def get_personality_scenarios() -> List[Dict[str, Any]]:
    return [
        {
            "id": s["id"],
            "scenario": s["scenario"],
            "options": [{"text": opt["text"], "index": idx} for idx, opt in enumerate(s["options"])]
        }
        for s in OCEAN_SCENARIOS
    ]

def score_personality_answers(user_id: str, answers: Dict[str, int]) -> Dict[str, Any]:
    """
    Computes OCEAN trait scores from scenario answers.
    Answers map scenario_id -> selected_option_index.
    """
    trait_accum: Dict[str, List[float]] = {
        "openness": [],
        "conscientiousness": [],
        "extraversion": [],
        "agreeableness": [],
        "neuroticism": []
    }

    for s in OCEAN_SCENARIOS:
        sid = s["id"]
        if sid in answers:
            opt_idx = answers[sid]
            if 0 <= opt_idx < len(s["options"]):
                chosen_scores = s["options"][opt_idx]["scores"]
                for trait, val in chosen_scores.items():
                    trait_accum[trait].append(val)

    # Defaults to 0.5 if not enough data
    results = {}
    for trait, values in trait_accum.items():
        results[trait] = round(sum(values) / len(values), 2) if values else 0.50

    confidence = "high" if len(answers) >= 5 else ("moderate" if len(answers) >= 3 else "provisional")

    conn = get_db()
    cursor = conn.cursor()
    assessment_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT OR REPLACE INTO personality_assessments (
            id, user_id, openness, conscientiousness, extraversion, agreeableness, neuroticism,
            confidence, answers_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        assessment_id, user_id, results["openness"], results["conscientiousness"],
        results["extraversion"], results["agreeableness"], results["neuroticism"],
        confidence, json.dumps(answers)
    ))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "traits": results,
        "confidence": confidence,
        "description": get_trait_summary(results),
        "guidance": "These insights help MANAS tailor its communication rhythm and reflection prompts to your natural preferences."
    }

def get_trait_summary(traits: Dict[str, float]) -> Dict[str, str]:
    descriptions = {}
    if traits["openness"] >= 0.65:
        descriptions["openness"] = "High curiosity — you appreciate metaphors, creative perspectives, and deep exploratory questions."
    else:
        descriptions["openness"] = "Grounded & practical — you prefer concrete examples and straightforward insights."

    if traits["conscientiousness"] >= 0.65:
        descriptions["conscientiousness"] = "Methodical — you find clarity in actionable steps, structure, and reliable follow-through."
    else:
        descriptions["conscientiousness"] = "Flexible & adaptable — you thrive with open-ended guidance rather than rigid checklists."

    if traits["extraversion"] >= 0.65:
        descriptions["extraversion"] = "Socially energized — you express feelings best through lively dialogue and shared experiences."
    else:
        descriptions["extraversion"] = "Introspective — you recharge in quiet reflection and prefer calm, intimate check-ins."

    if traits["agreeableness"] >= 0.65:
        descriptions["agreeableness"] = "Empathetic & collaborative — you naturally value harmony and warmth in connections."
    else:
        descriptions["agreeableness"] = "Discerning & candid — you value direct honesty and objective truth over pleasantries."

    if traits["neuroticism"] >= 0.65:
        descriptions["neuroticism"] = "Emotionally sensitive — you feel stress acutely; grounding and gentle pacing are particularly supportive."
    else:
        descriptions["neuroticism"] = "Resilient & steady — you recover equilibrium relatively quickly after unexpected disruptions."

    return descriptions

def get_user_personality(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT openness, conscientiousness, extraversion, agreeableness, neuroticism, confidence, answers_json, updated_at
        FROM personality_assessments
        WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    traits = {
        "openness": row["openness"],
        "conscientiousness": row["conscientiousness"],
        "extraversion": row["extraversion"],
        "agreeableness": row["agreeableness"],
        "neuroticism": row["neuroticism"]
    }

    return {
        "traits": traits,
        "confidence": row["confidence"],
        "descriptions": get_trait_summary(traits),
        "updated_at": row["updated_at"]
    }

def update_user_personality(user_id: str, traits: Dict[str, float]) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO personality_assessments (
            id, user_id, openness, conscientiousness, extraversion, agreeableness, neuroticism,
            confidence, answers_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'user_adjusted', '{}', CURRENT_TIMESTAMP)
    """, (
        str(uuid.uuid4()), user_id,
        traits.get("openness", 0.5), traits.get("conscientiousness", 0.5),
        traits.get("extraversion", 0.5), traits.get("agreeableness", 0.5),
        traits.get("neuroticism", 0.5)
    ))
    conn.commit()
    conn.close()
    return {"status": "success", "traits": traits, "message": "Personality profile updated."}
