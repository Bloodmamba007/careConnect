import pytest
from app.llm_parse import (
    expand_text_abbreviations,
    local_deterministic_parser,
    parse_with_llm,
    validate_medications,
)


def test_abbreviation_expansion():
    raw = "Tab Lipitor 20mg OD pc for 30 days"
    expanded = expand_text_abbreviations(raw)
    assert "tablet" in expanded
    assert "once daily" in expanded
    assert "after meals" in expanded


def test_decode_1_0_1_and_brand_conversion():
    raw = "Tab Glucophage 500mg 1-0-1 pc x 60 days"
    meds = local_deterministic_parser(raw)
    assert len(meds) == 1
    med = meds[0]

    # Brand converted to generic
    assert med["generic_name"] == "metformin"
    assert med["strength"] == "500 mg" or med["strength"] == "500mg"
    # 1-0-1 pattern decoded
    assert med["frequency"] == "twice daily"
    assert "morning and night" in med["timing"]
    assert med["duration_days"] == 60


def test_uncertain_name_dose_never_guessed():
    raw = "Tab ??? 100mg once daily\nScribble illegible dose"
    meds = local_deterministic_parser(raw)
    for m in meds:
        # If uncertain, confidence must be low (< 0.50)
        assert m["confidence"] < 0.50


def test_schema_validation():
    valid_data = [
        {
            "drug_name": "Lipitor",
            "generic_name": "atorvastatin",
            "form": "tablet",
            "strength": "20 mg",
            "frequency": "once daily",
            "timing": "evening",
            "duration_days": 90,
            "confidence": 0.92,
            "rxnorm_id": "617314",
        }
    ]
    meds, err = validate_medications(valid_data)
    assert err is None
    assert len(meds) == 1

    invalid_data = [{"drug_name": "Incomplete"}]
    _, err_inv = validate_medications(invalid_data)
    assert err_inv is not None


@pytest.mark.anyio
async def test_full_parse_with_llm_pipeline():
    text = "Tab Augmentin 625mg TDS pc for 7 days"
    meds, conf = await parse_with_llm(text)
    assert len(meds) == 1
    assert meds[0].generic_name == "amoxicillin and clavulanate potassium"
    assert meds[0].frequency == "three times daily"
    assert conf >= 0.80
