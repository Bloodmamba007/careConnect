"""
CareConnect Validation Harness - Prescription Pipeline Benchmark
Tests 30 sample prescriptions across 3 archetypes:
  - 10 Printed prescriptions (clean typography, high confidence)
  - 10 Neat handwriting prescriptions (1-0-1 pattern, Latin abbreviations)
  - 10 Messy/Ambiguous prescriptions (illegible dosages, scribbles, unknown drugs)
Evaluates:
  - Per-field accuracy across: drug_name, generic_name, form, strength, frequency, timing, duration_days, rxnorm_id
  - Overall field accuracy
  - Fraction sent to pharmacist review queue (needs_review vs auto_approved)
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

# Add prescription directory to python path
PRESCRIPTION_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../prescription"))
if PRESCRIPTION_DIR not in sys.path:
    sys.path.insert(0, PRESCRIPTION_DIR)

from app.gate import gate_prescription
from app.llm_parse import parse_with_llm
from app.normalize import normalize_medications
from app.schemas import Medication


@dataclass
class PrescriptionTestCase:
    id: str
    category: str  # "printed", "neat_handwriting", "messy"
    raw_ocr_text: str
    ocr_confidence: float
    ground_truth: Dict[str, Any]
    expected_status: str  # "auto_approved" or "needs_review"


# 30 Curated Clinical Sample Prescriptions
SAMPLE_CASES: List[PrescriptionTestCase] = [
    # ---------------- 10 Printed Prescriptions ----------------
    PrescriptionTestCase(
        id="rx_p01",
        category="printed",
        raw_ocr_text="Tab Lipitor 20mg OD pc for 30 days",
        ocr_confidence=0.96,
        ground_truth={
            "drug_name": "Lipitor",
            "generic_name": "atorvastatin",
            "form": "tablet",
            "strength": "20mg",
            "frequency": "once daily",
            "timing": "after meals",
            "duration_days": 30,
            "rxnorm_id": "83367",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p02",
        category="printed",
        raw_ocr_text="Tab Metformin 500mg BD pc for 60 days",
        ocr_confidence=0.95,
        ground_truth={
            "drug_name": "Metformin",
            "generic_name": "metformin",
            "form": "tablet",
            "strength": "500mg",
            "frequency": "twice daily",
            "timing": "after meals",
            "duration_days": 60,
            "rxnorm_id": "6809",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p03",
        category="printed",
        raw_ocr_text="Tab Lisinopril 10mg OD pc for 90 days",
        ocr_confidence=0.97,
        ground_truth={
            "drug_name": "Lisinopril",
            "generic_name": "lisinopril",
            "form": "tablet",
            "strength": "10mg",
            "frequency": "once daily",
            "timing": "after meals",
            "duration_days": 90,
            "rxnorm_id": "29046",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p04",
        category="printed",
        raw_ocr_text="Tab Norvasc 5mg OD pc for 30 days",
        ocr_confidence=0.95,
        ground_truth={
            "drug_name": "Norvasc",
            "generic_name": "amlodipine",
            "form": "tablet",
            "strength": "5mg",
            "frequency": "once daily",
            "timing": "after meals",
            "duration_days": 30,
            "rxnorm_id": "17767",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p05",
        category="printed",
        raw_ocr_text="Cap Prilosec 20mg OD ac for 14 days",
        ocr_confidence=0.96,
        ground_truth={
            "drug_name": "Prilosec",
            "generic_name": "omeprazole",
            "form": "capsule",
            "strength": "20mg",
            "frequency": "once daily",
            "timing": "before meals",
            "duration_days": 14,
            "rxnorm_id": "7646",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p06",
        category="printed",
        raw_ocr_text="Cap Augmentin 625mg TDS pc for 7 days",
        ocr_confidence=0.96,
        ground_truth={
            "drug_name": "Augmentin",
            "generic_name": "amoxicillin and clavulanate potassium",
            "form": "capsule",
            "strength": "625mg",
            "frequency": "three times daily",
            "timing": "after meals",
            "duration_days": 7,
            "rxnorm_id": "617312",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p07",
        category="printed",
        raw_ocr_text="Tab Lasix 40mg OD pc for 30 days",
        ocr_confidence=0.95,
        ground_truth={
            "drug_name": "Lasix",
            "generic_name": "furosemide",
            "form": "tablet",
            "strength": "40mg",
            "frequency": "once daily",
            "timing": "after meals",
            "duration_days": 30,
            "rxnorm_id": "4603",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p08",
        category="printed",
        raw_ocr_text="Tab Cozaar 50mg OD pc for 60 days",
        ocr_confidence=0.97,
        ground_truth={
            "drug_name": "Cozaar",
            "generic_name": "losartan",
            "form": "tablet",
            "strength": "50mg",
            "frequency": "once daily",
            "timing": "after meals",
            "duration_days": 60,
            "rxnorm_id": "5224",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p09",
        category="printed",
        raw_ocr_text="Tab Synthroid 50mcg OD ac for 90 days",
        ocr_confidence=0.96,
        ground_truth={
            "drug_name": "Synthroid",
            "generic_name": "levothyroxine",
            "form": "tablet",
            "strength": "50mcg",
            "frequency": "once daily",
            "timing": "before meals",
            "duration_days": 90,
            "rxnorm_id": "10582",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_p10",
        category="printed",
        raw_ocr_text="Tab Cipro 500mg BD pc for 10 days",
        ocr_confidence=0.95,
        ground_truth={
            "drug_name": "Cipro",
            "generic_name": "ciprofloxacin",
            "form": "tablet",
            "strength": "500mg",
            "frequency": "twice daily",
            "timing": "after meals",
            "duration_days": 10,
            "rxnorm_id": "2551",
        },
        expected_status="auto_approved",
    ),
    # ---------------- 10 Neat Handwriting Prescriptions ----------------
    PrescriptionTestCase(
        id="rx_h11",
        category="neat_handwriting",
        raw_ocr_text="Tab Glucophage 500mg 1-0-1 pc x 60d",
        ocr_confidence=0.88,
        ground_truth={
            "drug_name": "Glucophage",
            "generic_name": "metformin",
            "form": "tablet",
            "strength": "500mg",
            "frequency": "twice daily",
            "timing": "morning and night",
            "duration_days": 60,
            "rxnorm_id": "6809",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h12",
        category="neat_handwriting",
        raw_ocr_text="Cap Augmentin 625mg 1-1-1 pc x 7d",
        ocr_confidence=0.89,
        ground_truth={
            "drug_name": "Augmentin",
            "generic_name": "amoxicillin and clavulanate potassium",
            "form": "capsule",
            "strength": "625mg",
            "frequency": "three times daily",
            "timing": "morning, afternoon, and night",
            "duration_days": 7,
            "rxnorm_id": "617312",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h13",
        category="neat_handwriting",
        raw_ocr_text="Tab Zestril 10mg 1-0-0 pc x 30d",
        ocr_confidence=0.87,
        ground_truth={
            "drug_name": "Zestril",
            "generic_name": "lisinopril",
            "form": "tablet",
            "strength": "10mg",
            "frequency": "once daily",
            "timing": "morning",
            "duration_days": 30,
            "rxnorm_id": "29046",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h14",
        category="neat_handwriting",
        raw_ocr_text="Tab Plavix 75mg 1-0-0 pc x 90d",
        ocr_confidence=0.88,
        ground_truth={
            "drug_name": "Plavix",
            "generic_name": "clopidogrel",
            "form": "tablet",
            "strength": "75mg",
            "frequency": "once daily",
            "timing": "morning",
            "duration_days": 90,
            "rxnorm_id": "617314",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h15",
        category="neat_handwriting",
        raw_ocr_text="Tab Norvasc 10mg 0-0-1 pc x 30d",
        ocr_confidence=0.87,
        ground_truth={
            "drug_name": "Norvasc",
            "generic_name": "amlodipine",
            "form": "tablet",
            "strength": "10mg",
            "frequency": "once daily",
            "timing": "night",
            "duration_days": 30,
            "rxnorm_id": "17767",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h16",
        category="neat_handwriting",
        raw_ocr_text="Tab Lasix 40mg 1-0-0 pc x 30d",
        ocr_confidence=0.89,
        ground_truth={
            "drug_name": "Lasix",
            "generic_name": "furosemide",
            "form": "tablet",
            "strength": "40mg",
            "frequency": "once daily",
            "timing": "morning",
            "duration_days": 30,
            "rxnorm_id": "4603",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h17",
        category="neat_handwriting",
        raw_ocr_text="Tab Advil 200mg SOS pc x 5d",
        ocr_confidence=0.88,
        ground_truth={
            "drug_name": "Advil",
            "generic_name": "ibuprofen",
            "form": "tablet",
            "strength": "200mg",
            "frequency": "as needed",
            "timing": "after meals",
            "duration_days": 5,
            "rxnorm_id": "5640",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h18",
        category="neat_handwriting",
        raw_ocr_text="Tab Synthroid 100mcg 1-0-0 ac x 90d",
        ocr_confidence=0.87,
        ground_truth={
            "drug_name": "Synthroid",
            "generic_name": "levothyroxine",
            "form": "tablet",
            "strength": "100mcg",
            "frequency": "once daily",
            "timing": "morning",
            "duration_days": 90,
            "rxnorm_id": "10582",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h19",
        category="neat_handwriting",
        raw_ocr_text="Tab Cipro 500mg 1-0-1 pc x 10d",
        ocr_confidence=0.88,
        ground_truth={
            "drug_name": "Cipro",
            "generic_name": "ciprofloxacin",
            "form": "tablet",
            "strength": "500mg",
            "frequency": "twice daily",
            "timing": "morning and night",
            "duration_days": 10,
            "rxnorm_id": "2551",
        },
        expected_status="auto_approved",
    ),
    PrescriptionTestCase(
        id="rx_h20",
        category="neat_handwriting",
        raw_ocr_text="Tab Crestor 10mg 0-0-1 hs x 30d",
        ocr_confidence=0.87,
        ground_truth={
            "drug_name": "Crestor",
            "generic_name": "rosuvastatin",
            "form": "tablet",
            "strength": "10mg",
            "frequency": "once daily",
            "timing": "night",
            "duration_days": 30,
            "rxnorm_id": "83367",
        },
        expected_status="auto_approved",
    ),
    # ---------------- 10 Messy / Ambiguous Prescriptions ----------------
    PrescriptionTestCase(
        id="rx_m21",
        category="messy",
        raw_ocr_text="Cap Augmentin ??? mg scribble TDS SOS",
        ocr_confidence=0.55,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "capsule",
            "strength": "",
            "frequency": "three times daily",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m22",
        category="messy",
        raw_ocr_text="Tab Zestril ??? dose illegible",
        ocr_confidence=0.48,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "",
            "frequency": "",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m23",
        category="messy",
        raw_ocr_text="Tab Metfor... 500mg ??? x 30d illegible",
        ocr_confidence=0.52,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "500mg",
            "frequency": "",
            "timing": "",
            "duration_days": 30,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m24",
        category="messy",
        raw_ocr_text="Tab Coumadin ??? unclear dose monitor",
        ocr_confidence=0.50,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "",
            "frequency": "",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m25",
        category="messy",
        raw_ocr_text="Unclear Rx scribble 20mg once daily x 30d",
        ocr_confidence=0.45,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "",
            "strength": "20mg",
            "frequency": "once daily",
            "timing": "",
            "duration_days": 30,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m26",
        category="messy",
        raw_ocr_text="Tab ??? illegible 60mg BID",
        ocr_confidence=0.46,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "60mg",
            "frequency": "twice daily",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m27",
        category="messy",
        raw_ocr_text="Tab Warfarin ??? mg scribble alternate",
        ocr_confidence=0.51,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "",
            "frequency": "",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m28",
        category="messy",
        raw_ocr_text="Scribble ??? 20mg OD unknown",
        ocr_confidence=0.40,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "",
            "strength": "20mg",
            "frequency": "once daily",
            "timing": "",
            "duration_days": 0,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m29",
        category="messy",
        raw_ocr_text="Tab ??? 10mg OD morning x 30d unclear",
        ocr_confidence=0.48,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "tablet",
            "strength": "10mg",
            "frequency": "once daily",
            "timing": "morning",
            "duration_days": 30,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
    PrescriptionTestCase(
        id="rx_m30",
        category="messy",
        raw_ocr_text="Syrup ??? 5ml TDS x 5d illegible",
        ocr_confidence=0.42,
        ground_truth={
            "drug_name": "Uncertain",
            "generic_name": "",
            "form": "syrup",
            "strength": "5ml",
            "frequency": "three times daily",
            "timing": "",
            "duration_days": 5,
            "rxnorm_id": "",
        },
        expected_status="needs_review",
    ),
]


async def evaluate_prescription_pipeline() -> Dict[str, Any]:
    print("Evaluating CareConnect 6-stage Prescription Pipeline across 30 sample prescriptions...\n")

    fields = [
        "drug_name",
        "generic_name",
        "form",
        "strength",
        "frequency",
        "timing",
        "duration_days",
        "rxnorm_id",
    ]
    field_correct_counts = {f: 0 for f in fields}
    field_total_counts = {f: 0 for f in fields}

    status_counts = {"auto_approved": 0, "needs_review": 0}
    category_results: Dict[str, Dict[str, Any]] = {
        "printed": {"total": 0, "auto_approved": 0, "needs_review": 0, "field_correct": 0, "field_total": 0},
        "neat_handwriting": {"total": 0, "auto_approved": 0, "needs_review": 0, "field_correct": 0, "field_total": 0},
        "messy": {"total": 0, "auto_approved": 0, "needs_review": 0, "field_correct": 0, "field_total": 0},
    }

    results_detail = []

    for tc in SAMPLE_CASES:
        # Step 1: LLM Parsing
        parsed_meds, llm_conf = await parse_with_llm(tc.raw_ocr_text)

        # Step 2: RxNorm Normalization
        normalized_meds, match_conf = await normalize_medications(parsed_meds)

        # Step 3: Gating Decision
        gate_res = gate_prescription(
            ocr_confidence=tc.ocr_confidence,
            llm_confidence=llm_conf,
            match_confidence=match_conf,
            threshold=0.85,
        )

        actual_status = gate_res.status
        status_counts[actual_status] = status_counts.get(actual_status, 0) + 1

        cat_stats = category_results[tc.category]
        cat_stats["total"] += 1
        cat_stats[actual_status] += 1

        # Evaluate fields
        parsed_med = normalized_meds[0] if normalized_meds else None
        tc_field_matches = {}

        for f in fields:
            gt_val = tc.ground_truth.get(f)
            if parsed_med is not None:
                actual_val = getattr(parsed_med, f, None)
            else:
                actual_val = None

            # Normalization matching
            is_match = False
            if gt_val == "" or gt_val is None or gt_val == "Uncertain":
                # For messy/uncertain cases, matching means correctly flagging uncertain or empty
                if actual_val in ("", None, "Uncertain") or (f == "rxnorm_id" and actual_val == ""):
                    is_match = True
            elif isinstance(gt_val, str):
                if actual_val and gt_val.strip().lower() in str(actual_val).strip().lower():
                    is_match = True
                elif actual_val and str(actual_val).strip().lower() in gt_val.strip().lower():
                    is_match = True
            elif isinstance(gt_val, int):
                is_match = (actual_val == gt_val)

            field_total_counts[f] += 1
            cat_stats["field_total"] += 1
            if is_match:
                field_correct_counts[f] += 1
                cat_stats["field_correct"] += 1
            tc_field_matches[f] = is_match

        results_detail.append(
            {
                "id": tc.id,
                "category": tc.category,
                "status": actual_status,
                "expected_status": tc.expected_status,
                "overall_confidence": gate_res.overall_confidence,
                "field_matches": tc_field_matches,
            }
        )

    # Calculate Accuracies
    field_accuracies = {
        f: round((field_correct_counts[f] / field_total_counts[f]) * 100.0, 1)
        for f in fields
    }
    total_fields = sum(field_total_counts.values())
    total_correct = sum(field_correct_counts.values())
    overall_accuracy = round((total_correct / total_fields) * 100.0, 1)

    fraction_sent_to_review = round(
        (status_counts["needs_review"] / len(SAMPLE_CASES)) * 100.0, 1
    )
    fraction_auto_approved = round(
        (status_counts["auto_approved"] / len(SAMPLE_CASES)) * 100.0, 1
    )

    # Print Report
    print("=" * 80)
    print("CARECONNECT PRESCRIPTION PIPELINE VALIDATION RESULTS (30 SAMPLES)")
    print("=" * 80)
    print(f"Total Prescriptions Tested: {len(SAMPLE_CASES)}")
    print(f"  - Auto-Approved:           {status_counts['auto_approved']} ({fraction_auto_approved}%)")
    print(f"  - Sent to Review Queue:   {status_counts['needs_review']} ({fraction_sent_to_review}%)")
    print(f"  - Overall Field Accuracy: {overall_accuracy}%\n")

    print("-" * 50)
    print("PER-FIELD EXTRACTION ACCURACY")
    print("-" * 50)
    for f in fields:
        print(f"  - {f:<15} : {field_accuracies[f]:>5.1f}% ({field_correct_counts[f]}/{field_total_counts[f]})")
    print("-" * 50)

    print("\nPER-CATEGORY GATING & ACCURACY BREAKDOWN")
    print("-" * 80)
    print(f"{'Category':<18} | {'Count':<5} | {'Auto-Approved':<13} | {'Needs Review':<12} | {'Field Acc %':<10}")
    print("-" * 80)
    for cat, stats in category_results.items():
        cat_acc = round((stats["field_correct"] / stats["field_total"]) * 100.0, 1) if stats["field_total"] else 0.0
        print(
            f"{cat:<18} | {stats['total']:<5} | {stats['auto_approved']:<13} | {stats['needs_review']:<12} | {cat_acc:>9.1f}%"
        )
    print("=" * 80)

    return {
        "total_samples": len(SAMPLE_CASES),
        "status_counts": status_counts,
        "fraction_sent_to_review": fraction_sent_to_review,
        "fraction_auto_approved": fraction_auto_approved,
        "overall_field_accuracy": overall_accuracy,
        "per_field_accuracy": field_accuracies,
        "category_results": category_results,
        "details": results_detail,
    }


def main():
    return asyncio.run(evaluate_prescription_pipeline())


if __name__ == "__main__":
    main()
