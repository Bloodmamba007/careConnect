import base64
from datetime import datetime, timezone
import logging
import uuid
from typing import Dict, List, Optional
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .gate import gate_prescription
from .layout import crop_rx_body, crop_text_lines, segment_layout
from .llm_parse import parse_with_llm
from .normalize import normalize_medications
from .ocr import perform_ocr_on_lines
from .preprocess import preprocess_prescription
from .schemas import (
    ApproveRequest,
    ApproveResponse,
    Medication,
    ParseRequest,
    PrescriptionParseResponse,
    ReviewQueueItem,
)

# Configure logger
logger = logging.getLogger("careconnect.prescription")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = FastAPI(title="CareConnect Prescription", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for review queue and approval records
# Key: prescription_id -> dict
review_store: Dict[str, dict] = {}


def image_to_base64(img: np.ndarray, format: str = ".jpg") -> str:
    """Encodes an OpenCV image to a base64 data URI string."""
    success, buffer = cv2.imencode(format, img)
    if not success:
        return ""
    b64_str = base64.b64encode(buffer).decode("utf-8")
    mime = "image/jpeg" if format.lower() in [".jpg", ".jpeg"] else "image/png"
    return f"data:{mime};base64,{b64_str}"


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "careconnect-prescription"}


@app.post("/parse", response_model=List[Medication])
def parse_text_legacy(body: ParseRequest) -> List[Medication]:
    """Legacy backward-compatible text-based parsing endpoint."""
    lowered = body.text.lower()
    if "atorvastatin" in lowered or "lipitor" in lowered:
        return [
            Medication(
                drug_name="Lipitor",
                generic_name="atorvastatin",
                form="tablet",
                strength="20 mg",
                frequency="once daily",
                timing="evening",
                duration_days=90,
                confidence=0.92,
                rxnorm_id="617314",
            )
        ]
    return [
        Medication(
            drug_name="Unknown",
            generic_name="",
            form="",
            strength="",
            frequency="",
            timing="",
            duration_days=0,
            confidence=0.1,
            rxnorm_id="",
        )
    ]


@app.post(
    "/prescriptions/parse",
    response_model=PrescriptionParseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def parse_prescription_image(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
) -> PrescriptionParseResponse:
    """
    Executes the 6-stage prescription parsing pipeline:
    1. Preprocess: deskew, bilateral filter, adaptive threshold
    2. Layout: segment header, patient info, Rx body, footer, crop text lines
    3. OCR: PaddleOCR for printed text, TrOCR for handwritten text
    4. LLM Parse: abbreviation expansion, 1-0-1 decode, brand-to-generic, retry
    5. Normalize: RxNav API lookup + rapidfuzz fallback
    6. Gate: overall confidence = min(OCR, LLM, match) -> auto_approved / needs_review

    CRITICAL PRIVACY: Never log patient names under any circumstances.
    """
    prescription_id = f"rx_{uuid.uuid4().hex[:10]}"
    # Privacy rule: Only log sanitized IDs, never patient names
    safe_patient_id = patient_id if patient_id else "anonymous"
    logger.info(f"Processing prescription image upload for prescription_id={prescription_id}, patient_id={safe_patient_id}")

    # Read image bytes
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Unable to decode uploaded image.")

    # Stage 1: Preprocessing
    preprocessed = preprocess_prescription(image)

    # Stage 2: Layout Segmentation & Line Cropping
    layout = segment_layout(preprocessed.deskewed)
    rx_body_img = crop_rx_body(preprocessed.deskewed, layout)
    text_lines = crop_text_lines(rx_body_img)

    # Stage 3: OCR (PaddleOCR / TrOCR per line)
    doc_ocr = perform_ocr_on_lines(text_lines)

    # Stage 4: LLM Parsing
    meds_draft, llm_conf = await parse_with_llm(doc_ocr.full_text)

    # Stage 5: RxNorm Normalization (RxNav + rapidfuzz)
    normalized_meds, match_conf = await normalize_medications(meds_draft)

    # Stage 6: Gate Decision
    gate_result = gate_prescription(
        ocr_confidence=doc_ocr.overall_confidence,
        llm_confidence=llm_conf,
        match_confidence=match_conf,
        threshold=0.85,
    )

    cropped_b64 = image_to_base64(rx_body_img)

    # Persist in review store
    created_at = datetime.now(timezone.utc).isoformat()
    record = {
        "id": prescription_id,
        "patient_id": safe_patient_id,
        "status": gate_result.status,
        "overall_confidence": gate_result.overall_confidence,
        "ocr_confidence": gate_result.ocr_confidence,
        "llm_confidence": gate_result.llm_confidence,
        "match_confidence": gate_result.match_confidence,
        "medications": normalized_meds,
        "cropped_image": cropped_b64,
        "gate_reasons": gate_result.reasons,
        "created_at": created_at,
        "approved_at": None,
        "approved_by": None,
    }
    review_store[prescription_id] = record

    logger.info(
        f"Prescription {prescription_id} processed: status={gate_result.status}, "
        f"overall_conf={gate_result.overall_confidence:.2f} "
        f"(OCR={gate_result.ocr_confidence:.2f}, LLM={gate_result.llm_confidence:.2f}, Match={gate_result.match_confidence:.2f})"
    )

    return PrescriptionParseResponse(
        prescription_id=prescription_id,
        patient_id=safe_patient_id,
        status=gate_result.status,
        overall_confidence=gate_result.overall_confidence,
        ocr_confidence=gate_result.ocr_confidence,
        llm_confidence=gate_result.llm_confidence,
        match_confidence=gate_result.match_confidence,
        medications=normalized_meds,
        cropped_image_base64=cropped_b64,
        gate_reasons=gate_result.reasons,
    )


@app.get("/prescriptions/review-queue", response_model=List[ReviewQueueItem])
def get_review_queue() -> List[ReviewQueueItem]:
    """Returns prescriptions awaiting pharmacist review (status == 'needs_review')."""
    pending = [
        ReviewQueueItem(
            id=item["id"],
            patient_id=item["patient_id"],
            status=item["status"],
            overall_confidence=item["overall_confidence"],
            created_at=item["created_at"],
            cropped_image=item["cropped_image"],
            parsed_draft=item["medications"],
        )
        for item in review_store.values()
        if item["status"] == "needs_review"
    ]
    # Sort newest first
    pending.sort(key=lambda x: x.created_at, reverse=True)
    return pending


@app.post("/prescriptions/{id}/approve", response_model=ApproveResponse)
def approve_prescription(id: str, body: Optional[ApproveRequest] = None) -> ApproveResponse:
    """
    Pharmacist 1-tap approval endpoint:
    - Approves the draft medication list (or accepts edited draft if corrections were made)
    - Returns the cropped prescription image and the finalized medication draft
    """
    record = review_store.get(id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Prescription '{id}' not found.")

    approved_by = body.approved_by if body and body.approved_by else "Pharmacist"
    approved_at = datetime.now(timezone.utc).isoformat()

    # If the pharmacist provided an edited draft, adopt it
    if body and body.edited_draft is not None:
        record["medications"] = body.edited_draft

    record["status"] = "approved"
    record["approved_at"] = approved_at
    record["approved_by"] = approved_by

    logger.info(f"Prescription {id} APPROVED by {approved_by} at {approved_at}")

    return ApproveResponse(
        id=id,
        status="approved",
        approved_at=approved_at,
        approved_by=approved_by,
        cropped_image=record["cropped_image"],
        parsed_draft=record["medications"],
    )
