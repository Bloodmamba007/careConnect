from typing import Any, Dict, List, Optional, Tuple
import httpx
from rapidfuzz import fuzz, process

from .schemas import Medication

# Curated local RxNorm catalog for fuzzy fallback
RXNORM_CATALOG: Dict[str, Dict[str, str]] = {
    "atorvastatin": {"rxcui": "83367", "generic": "atorvastatin", "brand": "Lipitor"},
    "amoxicillin and clavulanate potassium": {"rxcui": "617312", "generic": "amoxicillin and clavulanate potassium", "brand": "Augmentin"},
    "metformin": {"rxcui": "6809", "generic": "metformin", "brand": "Glucophage"},
    "lisinopril": {"rxcui": "29046", "generic": "lisinopril", "brand": "Zestril"},
    "amlodipine": {"rxcui": "17767", "generic": "amlodipine", "brand": "Norvasc"},
    "acetaminophen": {"rxcui": "161", "generic": "acetaminophen", "brand": "Tylenol"},
    "ibuprofen": {"rxcui": "5640", "generic": "ibuprofen", "brand": "Advil"},
    "furosemide": {"rxcui": "4603", "generic": "furosemide", "brand": "Lasix"},
    "omeprazole": {"rxcui": "7646", "generic": "omeprazole", "brand": "Prilosec"},
    "losartan": {"rxcui": "5224", "generic": "losartan", "brand": "Cozaar"},
    "levothyroxine": {"rxcui": "10582", "generic": "levothyroxine", "brand": "Synthroid"},
    "ciprofloxacin": {"rxcui": "2551", "generic": "ciprofloxacin", "brand": "Cipro"},
    "azithromycin": {"rxcui": "18631", "generic": "azithromycin", "brand": "Zithromax"},
    "metoprolol": {"rxcui": "6918", "generic": "metoprolol", "brand": "Lopressor"},
}

RXNAV_API_BASE = "https://rxnav.nlm.nih.gov/REST"


async def query_rxnav_api(term: str, client: Optional[httpx.AsyncClient] = None) -> Optional[Tuple[str, float]]:
    """
    Queries NIH RxNav REST API:
    1. Attempts exact term match via /rxcui.json?name=...
    2. Falls back to /approximateTerm.json?term=...
    """
    if not term or term.lower() == "uncertain":
        return None

    try:
        # 1. Exact match endpoint
        rxcui_url = f"{RXNAV_API_BASE}/rxcui.json"
        if client:
            resp = await client.get(rxcui_url, params={"name": term}, timeout=3.0)
        else:
            async with httpx.AsyncClient(timeout=3.0) as default_client:
                resp = await default_client.get(rxcui_url, params={"name": term})

        if resp.status_code == 200:
            data = resp.json()
            rxnorm_ids = data.get("idGroup", {}).get("rxnormId", [])
            if rxnorm_ids:
                return str(rxnorm_ids[0]), 0.98

        # 2. Approximate match endpoint
        approx_url = f"{RXNAV_API_BASE}/approximateTerm.json"
        if client:
            resp2 = await client.get(approx_url, params={"term": term, "maxEntries": 1}, timeout=3.0)
        else:
            async with httpx.AsyncClient(timeout=3.0) as default_client:
                resp2 = await default_client.get(approx_url, params={"term": term, "maxEntries": 1})

        if resp2.status_code == 200:
            data2 = resp2.json()
            candidates = data2.get("approximateGroup", {}).get("candidate", [])
            if candidates:
                cand = candidates[0]
                rxcui = str(cand.get("rxcui", ""))
                if rxcui:
                    return rxcui, 0.90
    except Exception:
        # Network unreachable or timeout -> fallback to fuzzy
        pass
    return None


def fuzzy_match_rxnorm(query: str, threshold: float = 65.0) -> Tuple[str, str, float]:
    """
    Fuzzy-matches a drug query against the local RxNorm catalog using rapidfuzz.
    Returns: (rxcui, generic_name, match_confidence_0_to_1)
    """
    if not query or query.lower() == "uncertain":
        return "", "", 0.0

    names_to_match = list(RXNORM_CATALOG.keys())
    brand_map = {v["brand"].lower(): k for k, v in RXNORM_CATALOG.items()}
    all_choices = names_to_match + list(brand_map.keys())

    match_result = process.extractOne(
        query.lower(),
        all_choices,
        scorer=fuzz.token_sort_ratio,
    )

    if match_result:
        matched_term, score, _ = match_result
        if score >= threshold:
            generic_key = brand_map.get(matched_term, matched_term)
            meta = RXNORM_CATALOG[generic_key]
            confidence = round(score / 100.0, 4)
            return meta["rxcui"], meta["generic"], confidence

    return "", query, 0.20


async def normalize_medication(
    med: Medication,
    client: Optional[httpx.AsyncClient] = None,
) -> Tuple[Medication, float]:
    """
    Normalizes a Medication record:
    1. Attempts RxNav API lookup with generic_name or drug_name.
    2. Falls back to rapidfuzz fuzzy matching.
    3. Fills in rxnorm_id and returns (updated_medication, match_confidence).
    """
    search_term = med.generic_name or med.drug_name
    if not search_term or search_term.lower() == "uncertain":
        return med.model_copy(update={"rxnorm_id": ""}), 0.10

    # 1. RxNav API
    api_result = await query_rxnav_api(search_term, client=client)
    if api_result:
        rxcui, score = api_result
        return med.model_copy(update={"rxnorm_id": rxcui}), score

    # 2. Rapidfuzz Fallback
    rxcui, generic_name, score = fuzzy_match_rxnorm(search_term)
    updated = med.model_copy(
        update={
            "rxnorm_id": rxcui,
            "generic_name": generic_name if generic_name else med.generic_name,
        }
    )
    return updated, score


async def normalize_medications(
    meds: List[Medication],
    client: Optional[httpx.AsyncClient] = None,
) -> Tuple[List[Medication], float]:
    """Normalizes all medications in a prescription and returns (meds, min_match_confidence)."""
    if not meds:
        return [], 0.0

    normalized_list: List[Medication] = []
    scores: List[float] = []

    for m in meds:
        norm_m, score = await normalize_medication(m, client=client)
        normalized_list.append(norm_m)
        scores.append(score)

    min_score = min(scores) if scores else 0.0
    return normalized_list, round(min_score, 4)
