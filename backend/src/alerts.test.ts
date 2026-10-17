import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateVitals, isVitalsPacket } from "./alerts.js";

test("GREEN vitals produce a VITALS alert", () => {
  const alert = evaluateVitals({
    patient_id: "pt_001",
    timestamp: "2026-10-18T02:46:00.000Z",
    heart_rate: 72,
    spo2: 98,
    systolic_bp: 118,
    diastolic_bp: 76,
  });
  assert.equal(alert.severity, "GREEN");
  assert.equal(alert.type, "VITALS");
  assert.equal(alert.patient_id, "pt_001");
  assert.ok(Array.isArray(alert.instructions));
  assert.ok(Array.isArray(alert.contributing_signals));
});

test("low SpO2 is RED", () => {
  const alert = evaluateVitals({
    patient_id: "pt_001",
    timestamp: "2026-10-18T02:46:00.000Z",
    heart_rate: 72,
    spo2: 88,
    systolic_bp: 118,
    diastolic_bp: 76,
  });
  assert.equal(alert.severity, "RED");
  assert.ok(alert.contributing_signals.includes("spo2"));
});

test("isVitalsPacket rejects incomplete bodies", () => {
  assert.equal(isVitalsPacket({ patient_id: "x" }), false);
  assert.equal(
    isVitalsPacket({
      patient_id: "pt",
      timestamp: "2026-10-18T02:46:00.000Z",
      heart_rate: 1,
      spo2: 1,
      systolic_bp: 1,
      diastolic_bp: 1,
    }),
    true,
  );
});
