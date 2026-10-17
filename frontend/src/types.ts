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
}
