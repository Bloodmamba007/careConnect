from typing import List, Optional
from pydantic import BaseModel, Field


class Medication(BaseModel):
    drug_name: str
    generic_name: str
    form: str
    strength: str
    frequency: str
    timing: str
    duration_days: int
    confidence: float = Field(ge=0, le=1)
    rxnorm_id: str


class Interaction(BaseModel):
    drugs: Optional[List[str]] = None
    mechanism: Optional[str] = None
    clinical_effect: Optional[str] = None


class Alert(BaseModel):
    event_id: str
    patient_id: str
    timestamp: str
    severity: str = Field(pattern="^(GREEN|YELLOW|RED)$")
    type: str = Field(pattern="^(VITALS|COMPOUND)$")
    message: str
    instructions: List[str]
    contributing_signals: List[str]
    interaction: Optional[Interaction] = None


class ParseRequest(BaseModel):
    text: str
    patient_id: str


class PrescriptionParseResponse(BaseModel):
    prescription_id: str
    patient_id: Optional[str] = None
    status: str  # auto_approved | needs_review | retake_needed | approved
    overall_confidence: float = 0.0
    ocr_confidence: float = 0.0
    llm_confidence: float = 0.0
    match_confidence: float = 0.0
    medications: List[Medication] = []
    warnings: List[str] = []
    tip: Optional[str] = None
    cropped_image_base64: str = ""
    gate_reasons: List[str] = []
    retention_mode: Optional[str] = "delete"


class ReviewQueueItem(BaseModel):
    id: str
    patient_id: Optional[str] = None
    status: str
    overall_confidence: float
    created_at: str
    cropped_image: str
    parsed_draft: List[Medication]
    retention_mode: Optional[str] = "delete"


class ApproveRequest(BaseModel):
    approved_by: Optional[str] = "Pharmacist"
    notes: Optional[str] = None
    edited_draft: Optional[List[Medication]] = None


class ApproveResponse(BaseModel):
    id: str
    status: str
    approved_at: str
    approved_by: Optional[str] = None
    cropped_image: str
    parsed_draft: List[Medication]
