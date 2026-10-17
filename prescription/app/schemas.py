from typing import Optional

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
    drugs: Optional[list[str]] = None
    mechanism: Optional[str] = None
    clinical_effect: Optional[str] = None


class Alert(BaseModel):
    event_id: str
    patient_id: str
    timestamp: str
    severity: str = Field(pattern="^(GREEN|YELLOW|RED)$")
    type: str = Field(pattern="^(VITALS|COMPOUND)$")
    message: str
    instructions: list[str]
    contributing_signals: list[str]
    interaction: Optional[Interaction] = None


class ParseRequest(BaseModel):
    text: str
    patient_id: str
