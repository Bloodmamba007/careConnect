from __future__ import annotations

from datetime import datetime, timezone
from random import Random
from typing import TypedDict


class VitalsPacket(TypedDict):
    patient_id: str
    timestamp: str
    heart_rate: float
    spo2: float
    systolic_bp: float
    diastolic_bp: float


def generate_vitals(patient_id: str = "pt_001", rng: Random | None = None) -> VitalsPacket:
    r = rng or Random()
    return {
        "patient_id": patient_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "heart_rate": round(r.uniform(62, 95), 1),
        "spo2": round(r.uniform(95, 100), 1),
        "systolic_bp": round(r.uniform(108, 132), 1),
        "diastolic_bp": round(r.uniform(68, 86), 1),
    }
