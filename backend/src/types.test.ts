import assert from "node:assert/strict";
import { test } from "node:test";
import type { Alert, Medication, VitalsPacket } from "./types.js";

test("VitalsPacket required keys", () => {
  const packet: VitalsPacket = {
    patient_id: "pt_001",
    timestamp: "2026-10-18T02:46:00.000Z",
    heart_rate: 78,
    spo2: 98,
    systolic_bp: 122,
    diastolic_bp: 78,
  };
  assert.deepEqual(Object.keys(packet).sort(), [
    "diastolic_bp",
    "heart_rate",
    "patient_id",
    "spo2",
    "systolic_bp",
    "timestamp",
  ]);
});

test("Medication required keys", () => {
  const med: Medication = {
    drug_name: "Lipitor",
    generic_name: "atorvastatin",
    form: "tablet",
    strength: "20 mg",
    frequency: "once daily",
    timing: "evening",
    duration_days: 90,
    confidence: 0.92,
    rxnorm_id: "617314",
  };
  assert.equal(med.confidence <= 1, true);
});

test("Alert severity and type enums", () => {
  const alert: Alert = {
    event_id: "evt_1",
    patient_id: "pt_001",
    timestamp: "2026-10-18T02:46:05.000Z",
    severity: "GREEN",
    type: "VITALS",
    message: "ok",
    instructions: [],
    contributing_signals: [],
  };
  const severities: Alert["severity"][] = ["GREEN", "YELLOW", "RED"];
  const types: Alert["type"][] = ["VITALS", "COMPOUND"];
  assert.ok(severities.includes(alert.severity));
  assert.ok(types.includes(alert.type));
});
