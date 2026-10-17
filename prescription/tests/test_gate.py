from app.gate import (
    calculate_overall_confidence,
    gate_prescription,
)


def test_calculate_overall_confidence_takes_minimum():
    # min(0.95, 0.90, 0.85) = 0.85
    assert calculate_overall_confidence(0.95, 0.90, 0.85) == 0.85
    # min(0.90, 0.70, 0.95) = 0.70
    assert calculate_overall_confidence(0.90, 0.70, 0.95) == 0.70
    # min(0.60, 0.92, 0.90) = 0.60
    assert calculate_overall_confidence(0.60, 0.92, 0.90) == 0.60


def test_gate_prescription_auto_approved():
    res = gate_prescription(ocr_confidence=0.92, llm_confidence=0.90, match_confidence=0.88)
    assert res.overall_confidence == 0.88
    assert res.status == "auto_approved"
    assert len(res.reasons) == 0

    # Exactly 0.85
    res2 = gate_prescription(ocr_confidence=0.85, llm_confidence=0.85, match_confidence=0.85)
    assert res2.overall_confidence == 0.85
    assert res2.status == "auto_approved"


def test_gate_prescription_needs_review():
    # One stage below 0.85 drops overall below 0.85
    res = gate_prescription(ocr_confidence=0.95, llm_confidence=0.90, match_confidence=0.80)
    assert res.overall_confidence == 0.80
    assert res.status == "needs_review"
    assert any("RxNorm" in r for r in res.reasons)

    # Low OCR drops below 0.85
    res_ocr = gate_prescription(ocr_confidence=0.65, llm_confidence=0.90, match_confidence=0.90)
    assert res_ocr.overall_confidence == 0.65
    assert res_ocr.status == "needs_review"
