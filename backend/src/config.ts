export interface ClinicalThresholds {
  heart_rate_min: number;
  heart_rate_max: number;
  systolic_min: number;
  systolic_max: number;
  spo2_min: number;
}

export interface AnomalyConfig {
  thresholds: ClinicalThresholds;
  baselineWindowMs: number;
  sigma: number;
  minBaselineSamples: number;
  confirmViolations: number;
  slowVitalConfirmMs: number;
  dropoutMs: number;
}

export const DEFAULT_THRESHOLDS: ClinicalThresholds = {
  heart_rate_min: 60,
  heart_rate_max: 100,
  systolic_min: 90,
  systolic_max: 140,
  spo2_min: 92,
};

export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  baselineWindowMs: 24 * 60 * 60 * 1000,
  sigma: 2,
  minBaselineSamples: 5,
  confirmViolations: 3,
  slowVitalConfirmMs: 5 * 60 * 1000,
  dropoutMs: 10 * 60 * 1000,
};

export const CRITICAL_INSTRUCTIONS = [
  "Stay with the patient and have them sit or lie down.",
  "Recheck heart rate, oxygen level, and blood pressure now.",
  "Call the on-call clinician if the numbers stay out of range.",
] as const;
