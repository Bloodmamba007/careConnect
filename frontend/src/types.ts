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

export interface Alert {
  event_id: string;
  patient_id: string;
  timestamp: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  instructions: string[];
  contributing_signals: string[];
  interaction?: {
    drugs?: string[];
    mechanism?: string;
    clinical_effect?: string;
  };
  acknowledged?: boolean;
  acknowledged_at?: string;
  feedback?: "False alarm" | "Real problem";
  feedback_at?: string;
}
