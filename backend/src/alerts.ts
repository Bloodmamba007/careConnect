import { randomUUID } from "node:crypto";
import type { Alert, VitalsPacket } from "./types.js";

export function evaluateVitals(packet: VitalsPacket): Alert {
  const contributing_signals: string[] = [];

  if (packet.heart_rate < 50 || packet.heart_rate > 110) {
    contributing_signals.push("heart_rate");
  }
  if (packet.spo2 < 94) {
    contributing_signals.push("spo2");
  }
  if (packet.systolic_bp < 90 || packet.systolic_bp > 160) {
    contributing_signals.push("systolic_bp");
  }
  if (packet.diastolic_bp < 50 || packet.diastolic_bp > 100) {
    contributing_signals.push("diastolic_bp");
  }

  let severity: Alert["severity"] = "GREEN";
  let message = "Vitals within expected range.";
  const instructions: string[] = ["Continue routine monitoring."];

  if (contributing_signals.includes("spo2") || packet.heart_rate > 130 || packet.systolic_bp < 80) {
    severity = "RED";
    message = "Critical vital sign deviation detected.";
    instructions.splice(
      0,
      instructions.length,
      "Stay with the patient.",
      "Recheck vitals immediately.",
      "Escalate to a clinician.",
    );
  } else if (contributing_signals.length > 0) {
    severity = "YELLOW";
    message = "One or more vital signs are outside the resting range.";
    instructions.splice(
      0,
      instructions.length,
      "Have the patient rest for 5 minutes.",
      "Recheck heart rate, SpO2, and blood pressure.",
    );
  }

  return {
    event_id: randomUUID(),
    patient_id: packet.patient_id,
    timestamp: new Date().toISOString(),
    severity,
    type: "VITALS",
    message,
    instructions,
    contributing_signals,
  };
}

export function isVitalsPacket(value: unknown): value is VitalsPacket {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.patient_id === "string" &&
    typeof v.timestamp === "string" &&
    typeof v.heart_rate === "number" &&
    typeof v.spo2 === "number" &&
    typeof v.systolic_bp === "number" &&
    typeof v.diastolic_bp === "number"
  );
}
