import type { Alert, ChartPoint, DemoScenario, Medication, Patient, VitalsPacket } from "../types";

export const PATIENTS: Patient[] = [
  {
    id: "pt_001",
    name: "Eleanor Vance",
    age: 74,
    gender: "Female",
    room: "ICU-304B",
    bed: "Bed 01",
    conditions: ["Hypertension Stage 2", "Coronary Artery Disease", "Mild COPD"],
    attendingPhysician: "Dr. Kathryn Vance, MD",
    baseline: {
      heartRate: 72,
      spo2: 98,
      systolicBp: 120,
      diastolicBp: 78,
    },
  },
  {
    id: "pt_002",
    name: "Arthur Pendelton",
    age: 68,
    gender: "Male",
    room: "Ward-210A",
    bed: "Bed 02",
    conditions: ["Post-Op Cardiac Rehab", "Atrial Fibrillation"],
    attendingPhysician: "Dr. Samuel Chen, MD",
    baseline: {
      heartRate: 68,
      spo2: 97,
      systolicBp: 124,
      diastolicBp: 80,
    },
  },
  {
    id: "pt_003",
    name: "Sarah Lin",
    age: 59,
    gender: "Female",
    room: "Stepdown-105C",
    bed: "Bed 01",
    conditions: ["Type 2 Diabetes Mellitus", "Asthma"],
    attendingPhysician: "Dr. Rafael Alvarez, MD",
    baseline: {
      heartRate: 76,
      spo2: 99,
      systolicBp: 118,
      diastolicBp: 75,
    },
  },
];

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    drug_name: "Lipitor",
    generic_name: "atorvastatin",
    form: "tablet",
    strength: "20 mg",
    frequency: "once daily",
    timing: "evening",
    duration_days: 90,
    confidence: 0.94,
    rxnorm_id: "617314",
  },
  {
    drug_name: "Lisinopril",
    generic_name: "lisinopril",
    form: "tablet",
    strength: "10 mg",
    frequency: "once daily",
    timing: "morning",
    duration_days: 30,
    confidence: 0.98,
    rxnorm_id: "29046",
  },
  {
    drug_name: "Norvasc",
    generic_name: "amlodipine",
    form: "tablet",
    strength: "5 mg",
    frequency: "once daily",
    timing: "morning",
    duration_days: 60,
    confidence: 0.91,
    rxnorm_id: "17767",
  },
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "normal",
    title: "Resting Baseline",
    subtitle: "Optimal vitals within resting threshold",
    severity: "GREEN",
    vitals: {
      heart_rate: 74,
      spo2: 98.4,
      systolic_bp: 120,
      diastolic_bp: 78,
    },
    clinicalNote: "Patient stable in resting supine position.",
  },
  {
    id: "tachycardia",
    title: "Tachycardia & Strain",
    subtitle: "Heart rate exceeds 110 bpm resting baseline",
    severity: "YELLOW",
    vitals: {
      heart_rate: 118,
      spo2: 96.2,
      systolic_bp: 138,
      diastolic_bp: 88,
    },
    clinicalNote: "Exertion or anxiety spike; caregiver rest protocol recommended.",
  },
  {
    id: "hypoxia",
    title: "Critical Hypoxia Desaturation",
    subtitle: "Peripheral SpO2 drops severely below 90%",
    severity: "RED",
    vitals: {
      heart_rate: 106,
      spo2: 88.5,
      systolic_bp: 114,
      diastolic_bp: 72,
    },
    clinicalNote: "Acute respiratory distress protocol. Titrate oxygen immediately.",
  },
  {
    id: "compound",
    title: "Compound Risk: Dual Hypotension",
    subtitle: "Amlodipine + Lisinopril additive blood pressure crash",
    severity: "RED",
    vitals: {
      heart_rate: 54,
      spo2: 95.0,
      systolic_bp: 82,
      diastolic_bp: 50,
    },
    clinicalNote: "Additive vasodilation from concomitant ACE inhibitor + Calcium channel blocker.",
  },
];

export const INITIAL_ALERTS: Alert[] = [
  {
    event_id: "evt_init_01",
    patient_id: "pt_001",
    timestamp: new Date(Date.now() - 45000).toISOString(),
    severity: "GREEN",
    type: "VITALS",
    message: "Resting vitals stable within clinical limits.",
    instructions: [
      "Maintain ambient room temperature.",
      "Scheduled continuous telemetry monitoring active.",
    ],
    contributing_signals: [],
    acknowledged: true,
  },
  {
    event_id: "evt_init_02",
    patient_id: "pt_001",
    timestamp: new Date(Date.now() - 15000).toISOString(),
    severity: "YELLOW",
    type: "VITALS",
    message: "Systolic blood pressure borderline elevation noted.",
    instructions: [
      "Verify patient is seated comfortably.",
      "Repeat reading in 5 minutes after resting.",
    ],
    contributing_signals: ["systolic_bp"],
    acknowledged: false,
  },
];

export const SAMPLE_PRESCRIPTIONS = [
  {
    label: "Lipitor 20mg (Atorvastatin)",
    text: "Lipitor (atorvastatin) 20 mg tablet. Take 1 tablet by mouth once daily in the evening for 90 days. High cholesterol management.",
  },
  {
    label: "Lisinopril 10mg (ACE Inhibitor)",
    text: "Lisinopril 10 mg tablet once daily in the morning for hypertension management. Monitor BP closely.",
  },
  {
    label: "Norvasc 5mg (Amlodipine)",
    text: "Norvasc (amlodipine besylate) 5 mg oral tablet once daily in morning for 60 days. Observe for peripheral edema.",
  },
  {
    label: "Metoprolol 50mg (Beta-Blocker)",
    text: "Lopressor (metoprolol tartrate) 50 mg tablet twice daily with food for post-infarct rate stabilization.",
  },
];

export function generateInitialHistory(patientId: string): ChartPoint[] {
  const points: ChartPoint[] = [];
  const now = Date.now();
  const patient = PATIENTS.find((p) => p.id === patientId) ?? PATIENTS[0];

  for (let i = 18; i >= 0; i--) {
    const time = new Date(now - i * 3000);
    const jitter = Math.sin(i * 0.7) * 3;
    points.push({
      timestamp: time.toISOString(),
      timeLabel: time.toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" }),
      heart_rate: Math.round((patient.baseline.heartRate + jitter) * 10) / 10,
      spo2: Math.min(100, Math.round((patient.baseline.spo2 - Math.abs(jitter * 0.2)) * 10) / 10),
      systolic_bp: Math.round((patient.baseline.systolicBp + jitter * 1.5) * 10) / 10,
      diastolic_bp: Math.round((patient.baseline.diastolicBp + jitter * 0.8) * 10) / 10,
    });
  }

  return points;
}

export function createInitialPacket(patientId: string): VitalsPacket {
  const patient = PATIENTS.find((p) => p.id === patientId) ?? PATIENTS[0];
  return {
    patient_id: patient.id,
    timestamp: new Date().toISOString(),
    heart_rate: patient.baseline.heartRate,
    spo2: patient.baseline.spo2,
    systolic_bp: patient.baseline.systolicBp,
    diastolic_bp: patient.baseline.diastolicBp,
  };
}
