export type AlertSeverity = "GREEN" | "YELLOW" | "RED";
export type AlertType = "VITALS" | "COMPOUND";

export interface VitalsPacket {
  patient_id: string;
  timestamp: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
}

export interface ChartPoint {
  timestamp: string;
  timeLabel: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  room: string;
  bed: string;
  conditions: string[];
  attendingPhysician: string;
  baseline: {
    heartRate: number;
    spo2: number;
    systolicBp: number;
    diastolicBp: number;
  };
}

export interface DemoScenario {
  id: string;
  title: string;
  subtitle: string;
  severity: AlertSeverity;
  vitals: {
    heart_rate: number;
    spo2: number;
    systolic_bp: number;
    diastolic_bp: number;
  };
  clinicalNote: string;
}

export interface Medication {
  drug_name: string;
  generic_name: string;
  form: string;
  strength: string;
  frequency: string;
  timing: string;
  duration_days: number;
  confidence: number;
  rxnorm_id: string;
  safety_notes?: string[];
}

export interface Interaction {
  drugs?: string[];
  mechanism?: string;
  clinical_effect?: string;
  affected_vitals?: string[];
  severity?: string;
}

export interface PrescriptionParseResponse {
  prescription_id: string;
  patient_id?: string;
  status: "auto_approved" | "needs_review" | "retake_needed" | "approved";
  overall_confidence: number;
  ocr_confidence: number;
  llm_confidence: number;
  match_confidence: number;
  medications: Medication[];
  warnings: string[];
  tip?: string | null;
  cropped_image_base64: string;
  gate_reasons?: string[];
  retention_mode?: string;
}

export interface ReviewQueueItem {
  id: string;
  patient_id?: string;
  status: string;
  overall_confidence: number;
  created_at: string;
  cropped_image: string;
  parsed_draft: Medication[];
  retention_mode?: string;
}

export interface AlertExplanation {
  signals: string[];
  duration: string;
  duration_seconds?: number;
  thresholds: Record<
    string,
    {
      value: number;
      threshold: number | [number, number];
      condition: string;
    }
  >;
  matched_rule: string;
  clinical_rationale?: string;
  medications?: string[];
  recommendation?: string;
}

export interface Alert {
  event_id: string;
  patient_id: string;
  timestamp: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  instructions: string[];
  contributing_signals: string[];
  interaction?: Interaction;
  explanation?: AlertExplanation;
  medications?: Medication[] | string[];
  acknowledged?: boolean;
  acknowledged_at?: string;
  feedback?: "False alarm" | "Real problem" | "false_alarm" | "real_problem";
  feedback_at?: string;
  silent?: boolean;
  dashboard_card_only?: boolean;
}
