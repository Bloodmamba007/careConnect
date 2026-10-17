from dataclasses import dataclass
from typing import List, Literal


GateStatus = Literal["auto_approved", "needs_review"]


@dataclass
class GateResult:
    overall_confidence: float
    ocr_confidence: float
    llm_confidence: float
    match_confidence: float
    status: GateStatus
    reasons: List[str]


def calculate_overall_confidence(
    ocr_confidence: float,
    llm_confidence: float,
    match_confidence: float,
) -> float:
    """
    Computes overall confidence as the minimum of the three stage scores:
    overall_confidence = min(OCR, LLM, match)
    """
    return round(float(min(ocr_confidence, llm_confidence, match_confidence)), 4)


def gate_prescription(
    ocr_confidence: float,
    llm_confidence: float,
    match_confidence: float,
    threshold: float = 0.85,
) -> GateResult:
    """
    Applies verification gate:
    >= 0.85 -> "auto_approved"
    < 0.85  -> "needs_review"
    """
    overall = calculate_overall_confidence(ocr_confidence, llm_confidence, match_confidence)
    reasons: List[str] = []

    if ocr_confidence < threshold:
        reasons.append(f"OCR confidence {ocr_confidence:.2f} is below threshold {threshold:.2f}")
    if llm_confidence < threshold:
        reasons.append(f"LLM extraction confidence {llm_confidence:.2f} is below threshold {threshold:.2f}")
    if match_confidence < threshold:
        reasons.append(f"RxNorm match confidence {match_confidence:.2f} is below threshold {threshold:.2f}")

    status: GateStatus = "auto_approved" if overall >= threshold else "needs_review"

    return GateResult(
        overall_confidence=overall,
        ocr_confidence=round(ocr_confidence, 4),
        llm_confidence=round(llm_confidence, 4),
        match_confidence=round(match_confidence, 4),
        status=status,
        reasons=reasons,
    )
