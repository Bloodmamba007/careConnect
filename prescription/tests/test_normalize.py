import pytest
from app.normalize import (
    fuzzy_match_rxnorm,
    normalize_medication,
    normalize_medications,
)
from app.schemas import Medication


def sample_med(drug_name: str, generic_name: str) -> Medication:
    return Medication(
        drug_name=drug_name,
        generic_name=generic_name,
        form="tablet",
        strength="20 mg",
        frequency="once daily",
        timing="evening",
        duration_days=30,
        confidence=0.90,
        rxnorm_id="",
    )


def test_fuzzy_match_exact_and_typo():
    # Exact generic
    rxcui, generic, score = fuzzy_match_rxnorm("atorvastatin")
    assert rxcui != ""
    assert generic == "atorvastatin"
    assert score >= 0.95

    # Brand name match
    rxcui_b, generic_b, score_b = fuzzy_match_rxnorm("Lipitor")
    assert rxcui_b != ""
    assert generic_b == "atorvastatin"
    assert score_b >= 0.95

    # Typo / fuzzy match
    rxcui_t, generic_t, score_t = fuzzy_match_rxnorm("Metformn")
    assert rxcui_t == "6809"
    assert generic_t == "metformin"
    assert score_t >= 0.80


@pytest.mark.anyio
async def test_normalize_medication_fallback():
    med = sample_med("Augmentin", "amoxicillin and clavulanate potassium")
    norm_med, score = await normalize_medication(med)
    assert norm_med.rxnorm_id != ""
    assert score >= 0.80


@pytest.mark.anyio
async def test_normalize_medications_batch():
    meds = [
        sample_med("Lipitor", "atorvastatin"),
        sample_med("Glucophage", "metformin"),
    ]
    norm_list, min_score = await normalize_medications(meds)
    assert len(norm_list) == 2
    assert norm_list[0].rxnorm_id != ""
    assert norm_list[1].rxnorm_id != ""
    assert min_score >= 0.80
