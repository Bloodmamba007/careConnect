import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from pydantic import ValidationError

from .schemas import Medication

# Common medical abbreviation mappings
ABBREVIATIONS = {
    r"\btab\.?\b": "tablet",
    r"\bcap\.?\b": "capsule",
    r"\bsyp\.?\b": "syrup",
    r"\bsyr\.?\b": "syrup",
    r"\binj\.?\b": "injection",
    r"\bo\.?d\.?\b": "once daily",
    r"\bb\.?d\.?\b": "twice daily",
    r"\bb\.?i\.?d\.?\b": "twice daily",
    r"\bt\.?d\.?s\.?\b": "three times daily",
    r"\bt\.?i\.?d\.?\b": "three times daily",
    r"\bq\.?d\.?s\.?\b": "four times daily",
    r"\bq\.?i\.?d\.?\b": "four times daily",
    r"\bp\.?c\.?\b": "after meals",
    r"\ba\.?c\.?\b": "before meals",
    r"\bs\.?o\.?s\.?\b": "as needed",
    r"\bh\.?s\.?\b": "at bedtime",
}

# 1-0-1 pattern decoder
DOSE_PATTERNS = {
    "1-0-1": ("twice daily", "morning and night"),
    "1-1-1": ("three times daily", "morning, afternoon, and night"),
    "1-0-0": ("once daily", "morning"),
    "0-0-1": ("once daily", "night"),
    "0-1-0": ("once daily", "afternoon"),
    "1-1-0": ("twice daily", "morning and afternoon"),
    "0-1-1": ("twice daily", "afternoon and night"),
    "2-0-2": ("twice daily (2 units each)", "morning and night"),
}

# Known brand to generic mapping
BRAND_TO_GENERIC = {
    "lipitor": "atorvastatin",
    "augmentin": "amoxicillin and clavulanate potassium",
    "glucophage": "metformin",
    "tylenol": "acetaminophen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "zestril": "lisinopril",
    "prinivil": "lisinopril",
    "norvasc": "amlodipine",
    "plavix": "clopidogrel",
    "nexium": "esomeprazole",
    "prilosec": "omeprazole",
    "lasix": "furosemide",
    "synthroid": "levothyroxine",
    "amoxil": "amoxicillin",
    "cipro": "ciprofloxacin",
    "zithromax": "azithromycin",
    "crestor": "rosuvastatin",
}

SYSTEM_PROMPT = """You are a clinical pharmacology assistant specializing in parsing prescription text into structured JSON.
CRITICAL RULES:
1. Output MUST be a strictly valid JSON array of objects conforming to the Medication schema:
   [
     {
       "drug_name": str,
       "generic_name": str,
       "form": str,
       "strength": str,
       "frequency": str,
       "timing": str,
       "duration_days": int,
       "confidence": float (between 0.0 and 1.0),
       "rxnorm_id": ""
     }
   ]
2. ABBREVIATION EXPANSION:
   - Tab / Tab. -> tablet
   - Cap / Cap. -> capsule
   - Syp / Syr. -> syrup
   - pc -> after meals
   - ac -> before meals
   - SOS -> as needed
   - OD -> once daily
   - BD / BID -> twice daily
   - TDS / TID -> three times daily
3. 1-0-1 DOSING PATTERNS:
   - 1-0-1 -> frequency: "twice daily", timing: "morning and night"
   - 1-1-1 -> frequency: "three times daily", timing: "morning, afternoon, and night"
   - 1-0-0 -> frequency: "once daily", timing: "morning"
   - 0-0-1 -> frequency: "once daily", timing: "night"
4. BRAND TO GENERIC:
   - Convert recognized brand names to generic (e.g. Lipitor -> atorvastatin, Augmentin -> amoxicillin and clavulanate potassium).
5. UNCERTAINTY:
   - NEVER guess uncertain names or doses.
   - If a medication name or dose is illegible, scribbled, or ambiguous, return null/empty string and low confidence (<0.5).
6. PRIVACY:
   - NEVER extract, output, or mention patient names under any circumstances.
"""


def expand_text_abbreviations(text: str) -> str:
    """Expands Latin and prescription abbreviations in raw OCR text."""
    expanded = text
    for pattern, replacement in ABBREVIATIONS.items():
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
    return expanded


def local_deterministic_parser(ocr_text: str) -> List[Dict[str, Any]]:
    """
    Rule-based clinical parser matching the exact rules of the system prompt.
    Used when LLM_API_KEY is not configured or in offline/test environments.
    """
    lines = [line.strip() for line in ocr_text.split("\n") if line.strip()]
    medications: List[Dict[str, Any]] = []

    for line in lines:
        lower_line = line.lower()

        # Skip headers / labels
        if lower_line.startswith(("rx:", "date:", "dr.", "patient", "sig:")):
            continue

        # Check for uncertain or illegible markers
        if any(marker in lower_line for marker in ["???", "illegible", "unclear", "scribble", "unknown"]):
            medications.append(
                {
                    "drug_name": "Uncertain",
                    "generic_name": "",
                    "form": "",
                    "strength": "",
                    "frequency": "",
                    "timing": "",
                    "duration_days": 0,
                    "confidence": 0.25,
                    "rxnorm_id": "",
                }
            )
            continue

        # Form detection
        form = "tablet"
        if "cap" in lower_line or "capsule" in lower_line:
            form = "capsule"
        elif "syp" in lower_line or "syrup" in lower_line:
            form = "syrup"
        elif "inj" in lower_line or "injection" in lower_line:
            form = "injection"

        # Strength detection (e.g. 20mg, 500 mg, 625mg)
        strength_match = re.search(r"(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))", lower_line)
        strength = strength_match.group(1).strip() if strength_match else ""

        # Duration detection (e.g. x 30 days, for 7 days, 10 days)
        duration_match = re.search(r"(?:for|x|\b)\s*(\d+)\s*(?:days?|d)\b", lower_line)
        duration_days = int(duration_match.group(1)) if duration_match else 0

        # Frequency and timing (1-0-1 pattern check first)
        frequency = "once daily"
        timing = "routine"
        matched_pattern = False
        for pat, (freq_val, time_val) in DOSE_PATTERNS.items():
            if pat in lower_line:
                frequency = freq_val
                timing = time_val
                matched_pattern = True
                break

        if not matched_pattern:
            if "tds" in lower_line or "tid" in lower_line or "three times daily" in lower_line:
                frequency = "three times daily"
            elif "bd" in lower_line or "bid" in lower_line or "twice daily" in lower_line:
                frequency = "twice daily"
            elif "od" in lower_line or "once daily" in lower_line:
                frequency = "once daily"
            elif "sos" in lower_line or "as needed" in lower_line:
                frequency = "as needed"

            if "pc" in lower_line or "after meals" in lower_line:
                timing = "after meals"
            elif "ac" in lower_line or "before meals" in lower_line:
                timing = "before meals"
            elif "hs" in lower_line or "bedtime" in lower_line:
                timing = "at bedtime"

        # Brand to generic resolution
        detected_brand = ""
        generic_name = ""
        for brand, generic in BRAND_TO_GENERIC.items():
            if brand in lower_line:
                detected_brand = brand.capitalize()
                generic_name = generic
                break

        if not detected_brand:
            # Fallback: find word following form or initial word
            words = re.findall(r"\b[A-Za-z]{3,}\b", line)
            filtered_words = [
                w
                for w in words
                if w.lower()
                not in {
                    "tab",
                    "tablet",
                    "cap",
                    "capsule",
                    "syp",
                    "syrup",
                    "pc",
                    "ac",
                    "od",
                    "bd",
                    "bid",
                    "tds",
                    "tid",
                    "days",
                    "for",
                }
            ]
            if filtered_words:
                detected_brand = filtered_words[0].capitalize()
                generic_name = BRAND_TO_GENERIC.get(detected_brand.lower(), detected_brand.lower())
            else:
                detected_brand = "Uncertain"
                generic_name = ""

        confidence = 0.92 if detected_brand != "Uncertain" and strength else 0.40

        medications.append(
            {
                "drug_name": detected_brand,
                "generic_name": generic_name,
                "form": form,
                "strength": strength,
                "frequency": frequency,
                "timing": timing,
                "duration_days": duration_days,
                "confidence": confidence,
                "rxnorm_id": "",
            }
        )

    return medications


def validate_medications(data: Any) -> Tuple[List[Medication], Optional[str]]:
    """Validates raw dict data against the Medication schema."""
    if not isinstance(data, list):
        return [], "Expected a list of medication objects"

    medications: List[Medication] = []
    try:
        for item in data:
            med = Medication(**item)
            medications.append(med)
        return medications, None
    except (ValidationError, TypeError) as e:
        return [], str(e)


async def call_llm_api(prompt_text: str, is_retry: bool = False, retry_error: str = "") -> str:
    """Calls external LLM API if configured."""
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        return ""

    url = os.getenv("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Parse this prescription text:\n{prompt_text}"},
    ]
    if is_retry and retry_error:
        messages.append(
            {
                "role": "user",
                "content": f"Your previous response had validation error: {retry_error}. Correct it and return valid JSON only.",
            }
        )

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": os.getenv("LLM_MODEL", "gpt-4o-mini"), "messages": messages, "temperature": 0.0},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def parse_with_llm(ocr_text: str) -> Tuple[List[Medication], float]:
    """
    Main LLM parsing orchestrator:
    - Pre-processes abbreviations and 1-0-1 notations
    - Calls LLM with strict system prompt
    - Retries once on invalid JSON
    - Falls back gracefully to local deterministic clinical parser if no API key or network failure
    - Validates against Medication schema
    - Returns (medications, mean_llm_confidence)
    """
    expanded_text = expand_text_abbreviations(ocr_text)

    # 1. Attempt LLM API if key is present
    api_key = os.getenv("LLM_API_KEY")
    if api_key:
        try:
            raw_response = await call_llm_api(expanded_text)
            parsed_json = json.loads(raw_response.strip("` \n").replace("json\n", ""))
            meds, err = validate_medications(parsed_json)
            if not err:
                mean_conf = float(sum(m.confidence for m in meds) / len(meds)) if meds else 0.0
                return meds, mean_conf

            # Retry once on invalid JSON / schema error
            retry_response = await call_llm_api(expanded_text, is_retry=True, retry_error=err)
            parsed_json2 = json.loads(retry_response.strip("` \n").replace("json\n", ""))
            meds2, err2 = validate_medications(parsed_json2)
            if not err2:
                mean_conf2 = float(sum(m.confidence for m in meds2) / len(meds2)) if meds2 else 0.0
                return meds2, mean_conf2
        except Exception:
            # Fall back to local parser
            pass

    # 2. Local deterministic clinical parser
    parsed_dicts = local_deterministic_parser(expanded_text)
    meds, _ = validate_medications(parsed_dicts)
    mean_conf = float(sum(m.confidence for m in meds) / len(meds)) if meds else 0.0
    return meds, mean_conf
