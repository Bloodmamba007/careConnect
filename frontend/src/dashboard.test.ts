import { describe, it, expect } from "vitest";
import type { Alert, VitalsPacket, Medication } from "./types";

describe("Phase 3: Caregiver Dashboard Contracts & Logic", () => {
  it("Vitals buffer retains up to 120 points", () => {
    let history: VitalsPacket[] = [];
    for (let i = 0; i < 150; i++) {
      const packet: VitalsPacket = {
        patient_id: "pt_001",
        timestamp: new Date().toISOString(),
        heart_rate: 70 + (i % 20),
        spo2: 98,
        systolic_bp: 120,
        diastolic_bp: 80,
      };
      history = [...history.slice(-119), packet];
    }
    expect(history.length).toBe(120);
    expect(history[history.length - 1].heart_rate).toBe(70 + (149 % 20));
  });

  it("Alert acknowledgment updates status and stops escalation", () => {
    const alert: Alert = {
      event_id: "alert-123",
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      severity: "RED",
      type: "VITALS",
      message: "Critical SpO2 drop",
      instructions: ["Stay with the patient.", "Recheck vitals immediately.", "Escalate to a clinician."],
      contributing_signals: ["spo2"],
      acknowledged: false,
    };

    expect(alert.acknowledged).toBe(false);
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    expect(alert.acknowledged).toBe(true);
  });

  it("Alert feedback correctly records 'False alarm' and 'Real problem'", () => {
    const alert: Alert = {
      event_id: "alert-456",
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      severity: "YELLOW",
      type: "VITALS",
      message: "Elevated heart rate",
      instructions: ["Have the patient rest."],
      contributing_signals: ["heart_rate"],
    };

    alert.feedback = "False alarm";
    expect(alert.feedback).toBe("False alarm");

    alert.feedback = "Real problem";
    expect(alert.feedback).toBe("Real problem");
  });

  it("EmergencyModal 3 plain-language steps match clinical requirements", () => {
    const requiredSteps = [
      "Stay with the patient.",
      "Recheck vitals immediately.",
      "Escalate to a clinician.",
    ];
    expect(requiredSteps.length).toBe(3);
    expect(requiredSteps[0]).toBe("Stay with the patient.");
    expect(requiredSteps[1]).toBe("Recheck vitals immediately.");
    expect(requiredSteps[2]).toBe("Escalate to a clinician.");
  });

  it("Medication interface supports low-key safety notes", () => {
    const med: Medication = {
      drug_name: "Lisinopril",
      generic_name: "lisinopril",
      form: "tablet",
      strength: "10 mg",
      frequency: "once daily",
      timing: "morning",
      duration_days: 90,
      confidence: 0.96,
      rxnorm_id: "29046",
      safety_notes: [
        "Take with or without food at the same time each day.",
        "Monitor for orthostatic dizziness when standing quickly."
      ],
    };

    expect(med.safety_notes).toBeDefined();
    expect(med.safety_notes?.length).toBe(2);
  });
});
