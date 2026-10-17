# CareConnect JSON Contracts

These schemas are the source of truth for payloads exchanged between `simulator/`, `backend/`, `frontend/`, and `prescription/`. TypeScript types in `backend/src/types.ts` must match this document exactly.

All timestamps use ISO 8601 (`date-time`), for example `2026-10-18T02:46:00.000Z`.

---

## 1. VitalsPacket

Emitted by the patient vitals simulator and ingested by the backend.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://careconnect.local/schemas/VitalsPacket.json",
  "title": "VitalsPacket",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "patient_id",
    "timestamp",
    "heart_rate",
    "spo2",
    "systolic_bp",
    "diastolic_bp"
  ],
  "properties": {
    "patient_id": {
      "type": "string",
      "minLength": 1,
      "description": "Stable identifier for the patient."
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp when the sample was taken."
    },
    "heart_rate": {
      "type": "number",
      "description": "Heart rate in beats per minute."
    },
    "spo2": {
      "type": "number",
      "description": "Peripheral oxygen saturation (percent)."
    },
    "systolic_bp": {
      "type": "number",
      "description": "Systolic blood pressure in mmHg."
    },
    "diastolic_bp": {
      "type": "number",
      "description": "Diastolic blood pressure in mmHg."
    }
  }
}
```

Example:

```json
{
  "patient_id": "pt_001",
  "timestamp": "2026-10-18T02:46:00.000Z",
  "heart_rate": 78,
  "spo2": 98,
  "systolic_bp": 122,
  "diastolic_bp": 78
}
```

---

## 2. Medication

Structured medication record produced by the prescription service (text/OCR-derived input is out of scope for camera/video; this is a JSON contract only).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://careconnect.local/schemas/Medication.json",
  "title": "Medication",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "drug_name",
    "generic_name",
    "form",
    "strength",
    "frequency",
    "timing",
    "duration_days",
    "confidence",
    "rxnorm_id"
  ],
  "properties": {
    "drug_name": {
      "type": "string",
      "description": "Brand or labeled drug name."
    },
    "generic_name": {
      "type": "string",
      "description": "Generic / INN name."
    },
    "form": {
      "type": "string",
      "description": "Dosage form, e.g. tablet, capsule, syrup."
    },
    "strength": {
      "type": "string",
      "description": "Strength as written, e.g. 500 mg."
    },
    "frequency": {
      "type": "string",
      "description": "How often the drug is taken, e.g. BID, once daily."
    },
    "timing": {
      "type": "string",
      "description": "When it is taken relative to meals or time of day."
    },
    "duration_days": {
      "type": "integer",
      "minimum": 0,
      "description": "Prescribed duration in days."
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Extractor confidence in the range [0, 1]."
    },
    "rxnorm_id": {
      "type": "string",
      "description": "RxNorm concept identifier (empty string if unknown)."
    }
  }
}
```

Example:

```json
{
  "drug_name": "Lipitor",
  "generic_name": "atorvastatin",
  "form": "tablet",
  "strength": "20 mg",
  "frequency": "once daily",
  "timing": "evening",
  "duration_days": 90,
  "confidence": 0.92,
  "rxnorm_id": "617314"
}
```

---

## 3. Alert

Clinical or compound-risk event published by the backend to the frontend (and optional notification channels).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://careconnect.local/schemas/Alert.json",
  "title": "Alert",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "event_id",
    "patient_id",
    "timestamp",
    "severity",
    "type",
    "message",
    "instructions",
    "contributing_signals"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "minLength": 1,
      "description": "Unique identifier for this alert instance."
    },
    "patient_id": {
      "type": "string",
      "minLength": 1
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp when the alert was generated."
    },
    "severity": {
      "type": "string",
      "enum": ["GREEN", "YELLOW", "RED"]
    },
    "type": {
      "type": "string",
      "enum": ["VITALS", "COMPOUND"]
    },
    "message": {
      "type": "string",
      "description": "Human-readable summary of the event."
    },
    "instructions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Ordered caregiver or patient actions."
    },
    "contributing_signals": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Named signals that triggered the alert, e.g. heart_rate, spo2."
    },
    "interaction": {
      "type": "object",
      "description": "Optional interaction details, typically when type is COMPOUND.",
      "additionalProperties": false,
      "properties": {
        "drugs": {
          "type": "array",
          "items": { "type": "string" }
        },
        "mechanism": {
          "type": "string"
        },
        "clinical_effect": {
          "type": "string"
        },
        "affected_vitals": {
          "type": "array",
          "items": { "type": "string" }
        },
        "severity": {
          "type": "string"
        }
      }
    },
    "explanation": {
      "type": "object",
      "description": "Evidence payload for 'Why this alert?' panel.",
      "properties": {
        "signals": {
          "type": "array",
          "items": { "type": "string" }
        },
        "duration": {
          "type": "string"
        },
        "duration_seconds": {
          "type": "number"
        },
        "thresholds": {
          "type": "object"
        },
        "matched_rule": {
          "type": "string"
        },
        "clinical_rationale": {
          "type": "string"
        },
        "medications": {
          "type": "array",
          "items": { "type": "string" }
        },
        "recommendation": {
          "type": "string"
        }
      }
    }
  }
}

```

Example (VITALS):

```json
{
  "event_id": "evt_8f2c",
  "patient_id": "pt_001",
  "timestamp": "2026-10-18T02:46:05.000Z",
  "severity": "YELLOW",
  "type": "VITALS",
  "message": "Heart rate elevated above resting baseline.",
  "instructions": [
    "Have the patient sit and rest for 5 minutes.",
    "Recheck heart rate and blood pressure."
  ],
  "contributing_signals": ["heart_rate"]
}
```

Example (COMPOUND, with optional `interaction`):

```json
{
  "event_id": "evt_9a11",
  "patient_id": "pt_001",
  "timestamp": "2026-10-18T02:47:00.000Z",
  "severity": "RED",
  "type": "COMPOUND",
  "message": "Possible additive hypotensive effect with current medications and low blood pressure.",
  "instructions": [
    "Do not give the next dose until a clinician reviews.",
    "Check blood pressure again in 10 minutes."
  ],
  "contributing_signals": ["systolic_bp", "diastolic_bp"],
  "interaction": {
    "drugs": ["amlodipine", "lisinopril"],
    "mechanism": "additive vasodilation",
    "clinical_effect": "hypotension"
  }
}
```
