import { DEFAULT_THRESHOLDS, type ClinicalThresholds } from "./config.js";
import type { AlertSeverity, VitalsPacket } from "./types.js";

export interface VitalsBreach {
  signal: string;
  value: number;
  threshold: number;
  condition: "low" | "high";
  severity: AlertSeverity;
}

export interface VitalsDeterioration {
  patient_id: string;
  timestamp: string;
  has_breach: boolean;
  severity: AlertSeverity;
  is_sustained: boolean;
  consecutive_breaches: number;
  duration_seconds: number;
  first_breach_timestamp?: string;
  contributing_signals: string[];
  breaches: Record<string, VitalsBreach>;
  packet: VitalsPacket;
}

interface PatientAnomalyState {
  consecutiveBreaches: number;
  firstBreachTimeMs: number | null;
  lastPacketTimeMs: number;
  history: VitalsPacket[];
  lastDeterioration?: VitalsDeterioration;
}

export interface AnomalyEngineOptions {
  thresholds?: Partial<ClinicalThresholds>;
  confirmViolations?: number; // Number of consecutive readings to consider sustained
}

export class AnomalyEngine {
  private thresholds: ClinicalThresholds;
  private confirmViolations: number;
  private patientStates = new Map<string, PatientAnomalyState>();

  constructor(options?: AnomalyEngineOptions) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...(options?.thresholds ?? {}),
    };
    // Default to 1 for immediate detection, but tracks consecutive breaches and duration
    this.confirmViolations = options?.confirmViolations ?? 1;
  }

  public processPacket(packet: VitalsPacket, forceTimestampMs?: number): VitalsDeterioration {
    const patientId = packet.patient_id;
    const packetTimeMs = forceTimestampMs ?? (Date.parse(packet.timestamp) || Date.now());

    let state = this.patientStates.get(patientId);
    if (!state) {
      state = {
        consecutiveBreaches: 0,
        firstBreachTimeMs: null,
        lastPacketTimeMs: packetTimeMs,
        history: [],
      };
      this.patientStates.set(patientId, state);
    }

    state.lastPacketTimeMs = packetTimeMs;
    state.history.push(packet);
    if (state.history.length > 50) {
      state.history.shift();
    }

    const breaches: Record<string, VitalsBreach> = {};
    const contributing_signals: string[] = [];

    // Heart Rate evaluation
    // Warning: < 60 or > 100; Critical: < 50 or > 130
    if (packet.heart_rate < 50) {
      breaches.heart_rate = {
        signal: "heart_rate",
        value: packet.heart_rate,
        threshold: 50,
        condition: "low",
        severity: "RED",
      };
      contributing_signals.push("heart_rate");
    } else if (packet.heart_rate > 130) {
      breaches.heart_rate = {
        signal: "heart_rate",
        value: packet.heart_rate,
        threshold: 130,
        condition: "high",
        severity: "RED",
      };
      contributing_signals.push("heart_rate");
    } else if (packet.heart_rate < this.thresholds.heart_rate_min) {
      breaches.heart_rate = {
        signal: "heart_rate",
        value: packet.heart_rate,
        threshold: this.thresholds.heart_rate_min,
        condition: "low",
        severity: "YELLOW",
      };
      contributing_signals.push("heart_rate");
    } else if (packet.heart_rate > this.thresholds.heart_rate_max) {
      breaches.heart_rate = {
        signal: "heart_rate",
        value: packet.heart_rate,
        threshold: this.thresholds.heart_rate_max,
        condition: "high",
        severity: "YELLOW",
      };
      contributing_signals.push("heart_rate");
    }

    // SpO2 evaluation
    // Warning: < 95; Critical: < 92
    if (packet.spo2 < this.thresholds.spo2_min) {
      breaches.spo2 = {
        signal: "spo2",
        value: packet.spo2,
        threshold: this.thresholds.spo2_min,
        condition: "low",
        severity: "RED",
      };
      contributing_signals.push("spo2");
    } else if (packet.spo2 < 95) {
      breaches.spo2 = {
        signal: "spo2",
        value: packet.spo2,
        threshold: 95,
        condition: "low",
        severity: "YELLOW",
      };
      contributing_signals.push("spo2");
    }

    // Systolic BP evaluation
    // Critical: < 80 or > 160; Warning: < 90 or > 140
    if (packet.systolic_bp < 80) {
      breaches.systolic_bp = {
        signal: "systolic_bp",
        value: packet.systolic_bp,
        threshold: 80,
        condition: "low",
        severity: "RED",
      };
      contributing_signals.push("systolic_bp");
    } else if (packet.systolic_bp > 160) {
      breaches.systolic_bp = {
        signal: "systolic_bp",
        value: packet.systolic_bp,
        threshold: 160,
        condition: "high",
        severity: "RED",
      };
      contributing_signals.push("systolic_bp");
    } else if (packet.systolic_bp < this.thresholds.systolic_min) {
      breaches.systolic_bp = {
        signal: "systolic_bp",
        value: packet.systolic_bp,
        threshold: this.thresholds.systolic_min,
        condition: "low",
        severity: "YELLOW",
      };
      contributing_signals.push("systolic_bp");
    } else if (packet.systolic_bp > this.thresholds.systolic_max) {
      breaches.systolic_bp = {
        signal: "systolic_bp",
        value: packet.systolic_bp,
        threshold: this.thresholds.systolic_max,
        condition: "high",
        severity: "YELLOW",
      };
      contributing_signals.push("systolic_bp");
    }

    // Diastolic BP evaluation
    // Critical: < 45 or > 105; Warning: < 50 or > 95
    if (packet.diastolic_bp < 45) {
      breaches.diastolic_bp = {
        signal: "diastolic_bp",
        value: packet.diastolic_bp,
        threshold: 45,
        condition: "low",
        severity: "RED",
      };
      contributing_signals.push("diastolic_bp");
    } else if (packet.diastolic_bp > 105) {
      breaches.diastolic_bp = {
        signal: "diastolic_bp",
        value: packet.diastolic_bp,
        threshold: 105,
        condition: "high",
        severity: "RED",
      };
      contributing_signals.push("diastolic_bp");
    } else if (packet.diastolic_bp < 50) {
      breaches.diastolic_bp = {
        signal: "diastolic_bp",
        value: packet.diastolic_bp,
        threshold: 50,
        condition: "low",
        severity: "YELLOW",
      };
      contributing_signals.push("diastolic_bp");
    } else if (packet.diastolic_bp > 95) {
      breaches.diastolic_bp = {
        signal: "diastolic_bp",
        value: packet.diastolic_bp,
        threshold: 95,
        condition: "high",
        severity: "YELLOW",
      };
      contributing_signals.push("diastolic_bp");
    }

    const hasBreach = contributing_signals.length > 0;
    const hasRedBreach = Object.values(breaches).some((b) => b.severity === "RED");

    let overallSeverity: AlertSeverity = "GREEN";
    if (hasRedBreach) {
      overallSeverity = "RED";
    } else if (hasBreach) {
      overallSeverity = "YELLOW";
    }

    if (hasBreach) {
      state.consecutiveBreaches += 1;
      if (state.firstBreachTimeMs === null) {
        state.firstBreachTimeMs = packetTimeMs;
      }
    } else {
      state.consecutiveBreaches = 0;
      state.firstBreachTimeMs = null;
    }

    const durationSeconds =
      state.firstBreachTimeMs !== null
        ? Math.max(1, Math.round((packetTimeMs - state.firstBreachTimeMs) / 1000))
        : 0;

    const isSustained = state.consecutiveBreaches >= this.confirmViolations;

    const deterioration: VitalsDeterioration = {
      patient_id: patientId,
      timestamp: packet.timestamp,
      has_breach: hasBreach,
      severity: overallSeverity,
      is_sustained: isSustained,
      consecutive_breaches: state.consecutiveBreaches,
      duration_seconds: durationSeconds,
      first_breach_timestamp: state.firstBreachTimeMs
        ? new Date(state.firstBreachTimeMs).toISOString()
        : undefined,
      contributing_signals,
      breaches,
      packet,
    };

    state.lastDeterioration = deterioration;
    return deterioration;
  }

  public getLatestDeterioration(patientId: string): VitalsDeterioration | undefined {
    return this.patientStates.get(patientId)?.lastDeterioration;
  }

  public resetPatient(patientId: string): void {
    this.patientStates.delete(patientId);
  }
}
