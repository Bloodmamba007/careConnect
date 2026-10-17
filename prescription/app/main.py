from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import Medication, ParseRequest

app = FastAPI(title="CareConnect Prescription", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "careconnect-prescription"}


@app.post("/parse", response_model=list[Medication])
def parse_prescription(body: ParseRequest) -> list[Medication]:
    """Return structured Medication records from free-text (no camera/video)."""
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
