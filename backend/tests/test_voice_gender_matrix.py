"""
test_voice_gender_matrix.py
────────────────────────────
Automated test suite asserting speaker gender correctness:
For all 8 Indian languages (en, hi, ta, te, kn, ml, bn, mr):
1. Boy companion -> speaker MUST be in the male speaker list.
2. Girl companion -> speaker MUST be in the female speaker list.
3. Every boy tone card -> speaker MUST be in the male speaker list.
4. Every girl tone card -> speaker MUST be in the female speaker list.
"""

import pytest
from app.services.voice_config import (
    ALL_SUPPORTED_LANGUAGES,
    SARVAM_VOICE_CATALOG,
    SARVAM_DEFAULT_SPEAKERS,
    VOICE_TONE_SPEAKER_MAP,
    get_sarvam_speaker,
    get_tones_for_companion,
)

FEMALE_SPEAKERS = {voice["id"].lower() for voice in SARVAM_VOICE_CATALOG["female"]}
MALE_SPEAKERS = {voice["id"].lower() for voice in SARVAM_VOICE_CATALOG["male"]}

# Disjointness check: No voice ID should belong to both male and female lists
def test_voice_catalog_gender_disjointness():
    intersection = FEMALE_SPEAKERS.intersection(MALE_SPEAKERS)
    assert not intersection, f"Voices {intersection} belong to both male and female catalogs!"

@pytest.mark.parametrize("lang", list(ALL_SUPPORTED_LANGUAGES))
def test_default_speaker_gender_matrix(lang):
    """Assert default companion speaker matches gender for every language."""
    boy_speaker = get_sarvam_speaker(lang, "boy")
    girl_speaker = get_sarvam_speaker(lang, "girl")

    assert boy_speaker.lower() in MALE_SPEAKERS, (
        f"Language '{lang}' boy speaker '{boy_speaker}' is not in male catalog: {MALE_SPEAKERS}"
    )
    assert girl_speaker.lower() in FEMALE_SPEAKERS, (
        f"Language '{lang}' girl speaker '{girl_speaker}' is not in female catalog: {FEMALE_SPEAKERS}"
    )

    # Aliases
    male_alias = get_sarvam_speaker(lang, "male")
    female_alias = get_sarvam_speaker(lang, "female")
    assert male_alias.lower() in MALE_SPEAKERS
    assert female_alias.lower() in FEMALE_SPEAKERS

@pytest.mark.parametrize("lang", list(ALL_SUPPORTED_LANGUAGES))
def test_tone_cards_gender_matrix(lang):
    """Assert every tone card for a gender maps to a speaker of that gender."""
    boy_tones = get_tones_for_companion(lang, "boy")
    assert len(boy_tones) > 0, f"Language '{lang}' has no boy tones defined"
    for tone in boy_tones:
        assert tone["gender"] == "boy"
        assert tone["speaker"].lower() in MALE_SPEAKERS, (
            f"Boy tone '{tone['id']}' ({tone['name']}) in '{lang}' uses non-male speaker: {tone['speaker']}"
        )

    girl_tones = get_tones_for_companion(lang, "girl")
    assert len(girl_tones) > 0, f"Language '{lang}' has no girl tones defined"
    for tone in girl_tones:
        assert tone["gender"] == "girl"
        assert tone["speaker"].lower() in FEMALE_SPEAKERS, (
            f"Girl tone '{tone['id']}' ({tone['name']}) in '{lang}' uses non-female speaker: {tone['speaker']}"
        )
