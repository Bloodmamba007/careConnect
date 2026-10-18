import base64
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
import cv2
import httpx
import numpy as np

from dotenv import load_dotenv

from .normalize import normalize_medications
from .schemas import Medication

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger("careconnect.prescription.vlm")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_VLM_MODEL = os.getenv("MISTRAL_VLM_MODEL", "pixtral-12b-2409")
MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions"

SYSTEM_VLM_PROMPT = """You are an expert clinical pharmacologist and medical vision reader analyzing doctor prescriptions.

CRITICAL CLINICAL SEPARATION RULES:
1. DISTINGUISH DOCUMENT SECTIONS:
   - Patient Complaints & Symptoms (e.g. Chest pain, SOB / Shortness of breath, Giddiness, sweating, DM) are NOT medications. Do NOT extract them!
   - Vitals & Lab Investigations (e.g. HR 55, BP 100/70, SpO2 75%, CBC, CRP, Trop I, CPK-MB) are clinical data, NOT medications. Do NOT extract them!
   - Provisional Diagnosis (e.g. Pulmonary edema with CCF, Cardiomegaly) is diagnostic, NOT a medication.
   - TREATMENT ORDERS (look for cursive 'Rx' symbol, 'Inj', 'Tab', 'Cap', 'STAT', 'Loading dose', 'Oxygen'):
     Extract ONLY the actual medications prescribed under the treatment orders!

2. ACCURATE DRUG RECOGNITION (COMMON EMERGENCY & CARDIAC DRUGS):
   - Recognize acute and hospital orders (e.g. Inj DYTOR [torsemide], Inj MAGNAM / MAGON [cefoperazone-sulbactam or magnesium], Inj LASIX [furosemide], Loading dose of antiplatelets [Ecosprin / Clopidogrel], Oxygen inhalation, ICU admission).
   - DO NOT hallucinate common outpatient drugs (such as Augmentin, Amoxicillin, Montelukast, Rabeprazole, Omeprazole) when inspecting an acute hospital or emergency prescription!
   - If a medication name is cursive or scribbled, provide the most plausible reading, note any ambiguity in warnings, and assign realistic moderate/low confidence (< 0.70).

3. STRICT CONFIDENCE CALIBRATION & SAFETY:
   - For clean, printed text: assign confidence 0.90 - 0.98.
   - For neat legible handwriting: assign confidence 0.80 - 0.90.
   - For cursive, rapid, or difficult physician handwriting: assign conservative confidence 0.50 - 0.70. NEVER report false high confidence (> 0.80) for ambiguous handwriting!
   - If any drug or dosage is unclear or requires human verification, set "status" to "needs_review".

4. SCHEMA CONFORMANCE:
Output MUST be a strictly valid JSON object matching:
{
  "overall_confidence": float (between 0.0 and 1.0),
  "status": string ("auto_approved" only if clear & confidence >= 0.85, else "needs_review", or "retake_needed" if illegible/blurry),
  "warnings": [string (plain language notes explaining any ambiguous cursive words or verification needed)],
  "tip": string or null (advice if retake_needed),
  "medications": [
    {
      "drug_name": string (Brand or prescribed name on Rx, e.g. "Inj Dytor"),
      "generic_name": string (Active ingredient, e.g. "torsemide"),
      "form": string (e.g. "injection", "tablet", "capsule", "inhalation"),
      "strength": string (e.g. "10 mg", "20 mg", "1.5 g"),
      "frequency": string (e.g. "STAT", "once daily", "twice daily"),
      "timing": string (e.g. "immediate", "after meals", "morning"),
      "duration_days": integer (e.g. 1 for STAT orders, 30, 60; 0 if not specified),
      "confidence": float (calibrated to visual legibility, 0.0 to 1.0)
    }
  ]
}

Expand abbreviations: Tab->tablet, Cap->capsule, Inj->injection, OD->once daily, BD/BID->twice daily, TDS/TID->three times daily, SOS->as needed, STAT->immediate single dose, pc->after meals, ac->before meals.
Never output patient names under any circumstances (privacy).
Output ONLY valid JSON.
"""


async def parse_image_with_mistral_vlm(
    image: np.ndarray,
    content_type: str = "image/jpeg",
) -> Tuple[List[Medication], float, str, List[str], Optional[str]]:
    """
    Directly processes a prescription image using Mistral AI's Vision Language Model (Pixtral).
    Returns:
        (medications, overall_confidence, status, warnings, tip)
    """
    # Encode OpenCV image to jpeg base64
    success, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not success:
        return [], 0.0, "retake_needed", ["Failed to encode image for VLM"], "Please re-upload a clear image"

    b64_image = base64.b64encode(buffer).decode("utf-8")
    data_uri = f"data:image/jpeg;base64,{b64_image}"

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MISTRAL_VLM_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SYSTEM_VLM_PROMPT},
                    {"type": "image_url", "image_url": data_uri},
                ],
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.0,
    }

    try:
        async with httpx.AsyncClient(timeout=50.0) as client:
            response = await client.post(MISTRAL_ENDPOINT, headers=headers, json=payload)

        if response.status_code != 200:
            logger.error(f"Mistral VLM error ({response.status_code}): {response.text}")
            raise RuntimeError(f"Mistral API returned status {response.status_code}: {response.text}")

        res_data = response.json()
        choice_text = res_data["choices"][0]["message"]["content"]
        parsed_json = json.loads(choice_text)

        overall_conf = float(parsed_json.get("overall_confidence", 0.70))
        status_val = str(parsed_json.get("status", "needs_review")).lower()

        warnings = [str(w) for w in parsed_json.get("warnings", [])]
        tip = parsed_json.get("tip")

        raw_meds = parsed_json.get("medications", [])
        med_objects: List[Medication] = []

        for m in raw_meds:
            d_name = str(m.get("drug_name") or m.get("name") or "Uncertain").strip()
            g_name = str(m.get("generic_name") or "").strip()
            f_name = str(m.get("form") or "tablet").strip()
            s_name = str(m.get("strength") or m.get("dosage") or "").strip()
            freq_name = str(m.get("frequency") or "once daily").strip()
            time_name = str(m.get("timing") or "morning").strip()

            dur = 0
            raw_dur = m.get("duration_days") or m.get("duration")
            if isinstance(raw_dur, int):
                dur = raw_dur
            elif isinstance(raw_dur, str):
                import re
                dur_match = re.search(r"\d+", raw_dur)
                dur = int(dur_match.group(0)) if dur_match else 0

            conf = float(m.get("confidence") or overall_conf)

            # Do not extract diagnostic terms or non-drugs as medications
            lower_d = d_name.lower()
            if any(term in lower_d for term in ["pulmonary edema", "cardiomegaly", "ccf", "chest pain", "sob", "creps", "ecg", "cbc", "crp"]):
                continue

            med_objects.append(
                Medication(
                    drug_name=d_name,
                    generic_name=g_name,
                    form=f_name,
                    strength=s_name,
                    frequency=freq_name,
                    timing=time_name,
                    duration_days=dur,
                    confidence=round(conf, 4),
                    rxnorm_id="",
                )
            )

        # Enforce conservative gating: if any medication has < 0.80 confidence, flag for pharmacist review
        has_uncertainty = any(m.confidence < 0.80 or "uncertain" in m.drug_name.lower() or "ambiguous" in m.strength.lower() for m in med_objects)
        if overall_conf < 0.85 or has_uncertainty or status_val == "needs_review":
            status_val = "needs_review"
            if not warnings:
                warnings.append("Physician handwriting contains cursive entries; pharmacist verification required.")
        elif status_val not in ["auto_approved", "needs_review", "retake_needed"]:
            status_val = "auto_approved"

        # Normalize with official RxNorm concepts
        normalized_meds, _ = await normalize_medications(med_objects)

        return normalized_meds, round(overall_conf, 4), status_val, warnings, tip

    except Exception as e:
        logger.error(f"Error calling Mistral VLM: {str(e)}")
        raise
