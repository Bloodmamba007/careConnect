# CareConnect Clinical Safety & Decision Support Architecture

> [!WARNING]
> ### MANDATORY CLINICAL DISCLAIMER
> **Decision support only. Consult a pharmacist or doctor. Not a diagnostic tool.**
>
> CareConnect is an assistive Clinical Decision Support System (CDSS) intended to alert caregivers and healthcare providers to physiological anomalies and high-risk pharmacological interactions. **It does not generate autonomous medical diagnoses, modify prescription dosages, or substitute for the professional clinical judgment of a licensed physician or pharmacist.**

---

## 1. Safety Principles & System Boundaries

CareConnect is designed around four fundamental safety pillars:
1. **Human-in-the-Loop**: High-consequence decisions (such as prescription onboarding and medication reconciliation) always require licensed pharmacist review.
2. **Deterministic Thresholding for Criticality**: Critical alerts are generated using established physiological thresholds and evidence-based pharmacodynamic interaction databases—never unconstrained generative models.
3. **Escalation Redundancy**: If a primary caregiver does not acknowledge a critical life-safety alert within 60 seconds, the system automatically escalates to a secondary contact across multiple communication channels (SMS, Voice call, Push).
4. **Graceful Fallback & Fail-Safe Defaults**: When external services (Twilio, Firebase, PostgreSQL, InfluxDB) are unreachable, the system fails open to redundant in-memory queues and offline notification stubs to ensure uninterrupted patient safety monitoring.

---

## 2. Multi-Tier Vital Signs Evaluation

Continuous physiological streams are processed through deterministic bounding rules:

```mermaid
flowchart TD
    V["Incoming Vitals Packet
(HR, SpO2, Systolic BP, Diastolic BP)"] --> Eval{"Clinical Threshold Evaluation"}
    
    Eval -->|All vitals in normal ranges| G["GREEN: Stable
- HR: 60 - 100 bpm
- SpO2 >= 95%
- BP: 90/60 - 139/89 mmHg"]
    
    Eval -->|Mild or single-parameter deviation| Y["YELLOW: Watching / Warning
- HR: 50-59 or 101-120 bpm
- SpO2: 90% - 94%
- BP: Mild pre-hypertension"]
    
    Eval -->|Life-threatening vital deviation| R["RED: Critical Crisis Alert
- HR < 50 or > 120 bpm
- SpO2 < 90% (Hypoxemia)
- Systolic BP < 90 or > 160 mmHg
- Diastolic BP < 60 or > 100 mmHg"]
    
    R --> Esc["Initiate 60s Escalation Timer & Multi-Channel Alert"]
```

---

## 3. Drug-Drug Interaction (DDI) Safety Engine

CareConnect evaluates active medication regimens to prevent adverse drug events (ADEs), drug-induced hemodynamic crashes, and severe contraindications.

### 3.1 Combinatorial Pair Generation
For a patient prescribed $n$ active medications, the engine computes all unique pairwise combinations:
$$\text{Total Pairs} = \frac{n(n - 1)}{2}$$
Every pair is evaluated against the curated interaction matrix (`backend/data/interactions.json`) of 27 high-priority critical rules.

### 3.2 Curated Critical Interaction Classes
| Drug Pair / Class | Severity | Mechanism | Affected Vitals / Clinical Danger |
|---|---|---|---|
| **Warfarin + Ibuprofen (NSAID)** | `CRITICAL` | Additive antiplatelet inhibition and gastric mucosa erosion. | Bleeding risk, hemorrhage, GI bleeding. |
| **Lisinopril (ACEi) + Spironolactone** | `CRITICAL` | Additive potassium retention. | Arrhythmia, hyperkalemia, cardiac arrest. |
| **Sildenafil + Nitroglycerin** | `CRITICAL` | Severe synergistic cGMP-mediated vasodilation. | Profound hypotensive shock (low blood pressure). |
| **Sertraline (SSRI) + Tramadol** | `CRITICAL` | Dual serotonin reuptake inhibition and excess 5-HT. | Serotonin syndrome, tachycardia, hyperthermia. |
| **Metoprolol + Lisinopril** | `CRITICAL` | Dual negative chronotropy and vasodilation. | Severe bradycardia, profound hypotension. |

### 3.3 Alert Suppression & Unknown Medication Safety Protocol
- **Only `CRITICAL` interactions trigger `RED COMPOUND` alerts** that activate caregiver escalation.
- `MODERATE` and `MINOR` interactions are silently recorded in the patient chart for clinician review during routine consults, preventing **alert fatigue**.
- **Unverified Medications**: If a patient is prescribed an unrecognized or non-RxNorm mapped drug, the system flags:
  `"Unverified Medication - Manual Review Required"`
  The run completes safely without crashing, alerting clinicians to verify the medication manually.

---

## 4. Emergency Escalation Protocol & Redundancy

```mermaid
sequenceDiagram
    autonumber
    participant Engine as Escalation Engine
    participant Timer as 60s Response Timer
    participant Caregiver as Primary Caregiver
    participant Secondary as Secondary Contact
    participant Audit as PostgreSQL Audit Log

    Engine->>Timer: Start 60-Second Acknowledgment Timer
    Engine->>Caregiver: Step 1: Send SMS + Voice Call (Twilio) + FCM Push
    Engine->>Audit: Record Step 1 Notification (SENT/MOCKED)

    alt Caregiver Acknowledges within 60s
        Caregiver->>Engine: POST /api/alerts/:id/ack
        Engine->>Timer: Cancel Timer
        Engine->>Audit: Record Acknowledgment & Stop Escalation
    else Caregiver Fails to Respond (Timeout > 60s)
        Timer->>Engine: Timer Expiration Event
        Engine->>Secondary: Step 2: Emergency Alert to Secondary Contact
        Engine->>Audit: Record Step 2 Escalation Notification
    end
```

### 4.1 Anti-Fatigue Rate Limiting
To prevent notification storms during sustained patient distress, CareConnect enforces a rate limit:
- **Maximum 1 automated notification per patient per alert type per 5 minutes**.
- Subsequent vital updates continue to update dashboards and database audit trails in real time without spamming phone channels.

---

## 5. Pharmacist-in-the-Loop Prescription Pipeline

The prescription processing pipeline extracts medications from uploaded prescription images through 6 independent validation stages:

```mermaid
flowchart LR
    Img["Prescription Image"] --> S1["1. Preprocess
(OpenCV Deskew,
Bilateral Filter,
Adaptive Threshold)"]
    S1 --> S2["2. Layout
(Segment Header,
Patient, Rx Body,
Footer, Text Lines)"]
    S2 --> S3["3. OCR
(PaddleOCR Printed,
TrOCR Handwritten)"]
    S3 --> S4["4. LLM Parse
(Strict JSON Schema,
1-0-1 & Abbreviation
Decoding, Never Guess)"]
    S4 --> S5["5. Normalize
(RxNorm / RxNav
Mapping + RapidFuzz)"]
    S5 --> S6{"6. Gate Decision"}
    
    S6 -->|"min(OCR, LLM, Match) >= 0.85"| Auto["Auto-Approved"]
    S6 -->|"Confidence < 0.85"| Queue["Pharmacist Review Queue
(/prescriptions/review-queue)"]
    
    Queue --> Pharmacist["Pharmacist 1-Tap Approval
(/prescriptions/:id/approve)"]
```

### 5.1 Strict Gating Metric
$$\text{Overall Confidence} = \min(\text{Confidence}_{\text{OCR}},\, \text{Confidence}_{\text{LLM}},\, \text{Confidence}_{\text{Match}})$$
- **$\ge 0.85$**: Meets automated confidence criteria.
- **$< 0.85$**: Immediately held in the review queue. Pharmacists must verify or edit the draft before medications can become active on the patient profile.

---

## 6. Verification & Audit Trail Summary

Every alert dispatched, caregiver call placed, vital deviation detected, and prescription approved is logged in PostgreSQL with immutable timestamps. Clinicians and regulatory auditors can retrieve the full chronological timeline using:

```http
GET /api/alerts/:event_id/audit
GET /api/audit?patient_id=pt_001
```

> **Safety Assurance**: The audit log proves exactly which caregiver was notified, the exact vitals at the moment of escalation, and the pharmacist who verified every medication.
