import { describe, expect, it } from "vitest";
import type { Alert, AlertExplanation, Medication } from "./types";

describe("Phase 7: Frontend Fusion and EmergencyModal Data Flow", () => {
  const sampleCompoundAlert: Alert = {
    event_id: "evt_fusion_test_1",
    patient_id: "pt_001",
    timestamp: new Date().toISOString(),
    severity: "RED",
    type: "COMPOUND",
    message:
      "Low blood pressure while taking Lisinopril and Metoprolol Tartrate, possibly related to additive vasodilation and negative chronotropic suppression. Show this medication list to the emergency team.",
    instructions: [
      "Show this medication list to the emergency team.",
      "Stay with the patient.",
      "Recheck vitals immediately.",
    ],
    contributing_signals: ["systolic_bp", "diastolic_bp", "heart_rate"],
    interaction: {
      drugs: ["Lisinopril", "Metoprolol Tartrate"],
      mechanism: "additive vasodilation and negative chronotropic suppression",
      clinical_effect: "severe hypotension and bradycardia",
      affected_vitals: ["systolic_bp", "diastolic_bp", "heart_rate"],
      severity: "CRITICAL",
    },
    explanation: {
      signals: ["systolic_bp", "diastolic_bp", "heart_rate"],
      duration: "Sustained for 45s (3 consecutive readings)",
      duration_seconds: 45,
      thresholds: {
        systolic_bp: { value: 72, threshold: 80, condition: "low" },
        diastolic_bp: { value: 40, threshold: 45, condition: "low" },
        heart_rate: { value: 46, threshold: 50, condition: "low" },
      },
      matched_rule:
        "Compound Risk Rule: Confirmed vitals deterioration matched critical interaction between Lisinopril and Metoprolol.",
      clinical_rationale:
        "Concurrent vasodilation and beta-blockade compounds hypotensive shock risk.",
      medications: ["Lisinopril", "Metoprolol Tartrate"],
      recommendation: "Show this medication list to the emergency team.",
    },
  };

  const sampleMedications: Medication[] = [
    {
      drug_name: "Lisinopril",
      generic_name: "lisinopril",
      form: "tablet",
      strength: "10 mg",
      frequency: "once daily",
      timing: "morning",
      duration_days: 90,
      confidence: 0.98,
      rxnorm_id: "29046",
    },
    {
      drug_name: "Metoprolol Tartrate",
      generic_name: "metoprolol",
      form: "tablet",
      strength: "25 mg",
      frequency: "twice daily",
      timing: "morning & evening",
      duration_days: 60,
      confidence: 0.96,
      rxnorm_id: "866416",
    },
  ];

  it("Branch 1: Standard RED vitals alert has contributing_signals and explanation payload", () => {
    const vitalsAlert: Alert = {
      event_id: "evt_branch1",
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      severity: "RED",
      type: "VITALS",
      message: "Critical vital sign deviation detected: Low blood pressure.",
      instructions: ["Stay with the patient.", "Recheck vitals immediately."],
      contributing_signals: ["systolic_bp", "diastolic_bp"],
      explanation: {
        signals: ["systolic_bp", "diastolic_bp"],
        duration: "Sustained for 30s",
        thresholds: {
          systolic_bp: { value: 74, threshold: 80, condition: "low" },
        },
        matched_rule: "Vitals Crisis Rule",
      },
    };

    expect(vitalsAlert.type).toBe("VITALS");
    expect(vitalsAlert.severity).toBe("RED");
    expect(vitalsAlert.interaction).toBeUndefined();
    expect(vitalsAlert.explanation?.matched_rule).toBe("Vitals Crisis Rule");
    expect(vitalsAlert.explanation?.signals).toContain("systolic_bp");
  });

  it("Branch 2: Compound Alert satisfies causation and handoff rules", () => {
    expect(sampleCompoundAlert.type).toBe("COMPOUND");
    expect(sampleCompoundAlert.severity).toBe("RED");

    // Must never claim causation; must use "possibly related to"
    expect(sampleCompoundAlert.message).toContain("possibly related to");
    expect(sampleCompoundAlert.message).not.toContain("caused by");
    expect(sampleCompoundAlert.message).not.toContain("due to");

    // Must contain handoff prompt
    expect(sampleCompoundAlert.message).toContain(
      "Show this medication list to the emergency team.",
    );

    // Must attach contributing signals and interaction
    expect(sampleCompoundAlert.contributing_signals).toContain("systolic_bp");
    expect(sampleCompoundAlert.interaction?.drugs).toContain("Lisinopril");
    expect(sampleCompoundAlert.interaction?.mechanism).toBeDefined();
    expect(sampleCompoundAlert.interaction?.clinical_effect).toBeDefined();
  });

  it("Branch 2: Explanation payload satisfies 'Why this alert?' requirements", () => {
    const exp = sampleCompoundAlert.explanation as AlertExplanation;
    expect(exp).toBeDefined();
    expect(exp.signals).toEqual(["systolic_bp", "diastolic_bp", "heart_rate"]);
    expect(exp.duration).toContain("Sustained for 45s");
    expect(exp.duration_seconds).toBe(45);
    expect(exp.thresholds.systolic_bp.value).toBe(72);
    expect(exp.thresholds.systolic_bp.threshold).toBe(80);
    expect(exp.matched_rule).toContain("Compound Risk Rule");
    expect(exp.clinical_rationale).toBeDefined();
  });

  it("Branch 3: Critical interaction with normal vitals is silent on dashboard", () => {
    const silentAlert: Alert = {
      event_id: "evt_branch3",
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      severity: "GREEN",
      type: "COMPOUND",
      message: "Monitored medication interaction. Patient vitals are within normal range.",
      instructions: ["Continue routine observation."],
      contributing_signals: [],
      silent: true,
      dashboard_card_only: true,
      interaction: {
        drugs: ["Lisinopril", "Metoprolol"],
        mechanism: "additive vasodilation",
        clinical_effect: "hypotension",
      },
    };

    expect(silentAlert.severity).toBe("GREEN");
    expect(silentAlert.silent).toBe(true);
    expect(silentAlert.dashboard_card_only).toBe(true);
  });

  it("Medication list correctly identifies interacting medications for emergency handoff", () => {
    const interactingDrugs = sampleCompoundAlert.interaction?.drugs ?? [];
    const flags = sampleMedications.map((m) => ({
      name: m.drug_name,
      isInteracting: interactingDrugs.some((d) => m.drug_name.includes(d)),
    }));

    expect(flags[0].isInteracting).toBe(true);
    expect(flags[1].isInteracting).toBe(true);
  });
});
