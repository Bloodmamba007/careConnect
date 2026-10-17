import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AnomalyEngine } from "./anomalyEngine.js";
import { DDIEngine } from "./ddiEngine.js";
import { FusionEngine } from "./fusionEngine.js";
import type { Medication, VitalsPacket } from "./types.js";

const lisinoprilAndMetoprolol: Medication[] = [
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

const singleMed: Medication[] = [
  {
    drug_name: "Lipitor",
    generic_name: "atorvastatin",
    form: "tablet",
    strength: "20 mg",
    frequency: "once daily",
    timing: "bedtime",
    duration_days: 90,
    confidence: 0.95,
    rxnorm_id: "617314",
  },
];

describe("Phase 7: Fusion and Risk Scoring Engine", () => {
  it("Branch 1: Vitals breach only yields standard RED alert with explanation payload", () => {
    const fusion = new FusionEngine();
    const patientId = "pt_branch1";

    // Patient with only non-interacting medication (Atorvastatin)
    fusion.updateMedications(patientId, singleMed);

    // Crisis vitals: Low BP and low SpO2
    const breachPacket: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date().toISOString(),
      heart_rate: 76,
      spo2: 84, // Critical SpO2 breach
      systolic_bp: 75, // Critical systolic BP breach
      diastolic_bp: 45,
    };

    const result = fusion.processVitals(breachPacket);

    assert.equal(result.decision_branch, "VITALS_BREACH_ONLY");
    assert.equal(result.is_silent, false);
    assert.ok(result.alert);
    assert.equal(result.alert.severity, "RED");
    assert.equal(result.alert.type, "VITALS");
    assert.equal(result.alert.interaction, undefined);

    // Check contributing signals
    assert.ok(result.alert.contributing_signals.includes("spo2"));
    assert.ok(result.alert.contributing_signals.includes("systolic_bp"));

    // Check explanation payload for "Why this alert?" panel
    assert.ok(result.alert.explanation);
    assert.ok(result.alert.explanation.signals.length >= 2);
    assert.ok(result.alert.explanation.duration);
    assert.ok(result.alert.explanation.thresholds.spo2);
    assert.ok(result.alert.explanation.thresholds.systolic_bp);
    assert.ok(result.alert.explanation.matched_rule.includes("Vitals Crisis Rule"));
  });

  it("Branch 1 (unmatched DDI): Vitals breach that does not match interaction affected_vitals remains standard RED alert", () => {
    const fusion = new FusionEngine();
    const patientId = "pt_branch1_unmatched";

    // Active Lisinopril + Metoprolol (affects BP and HR, NOT SpO2)
    fusion.updateMedications(patientId, lisinoprilAndMetoprolol);

    // Only SpO2 is breached; BP and HR are totally normal
    const spo2BreachPacket: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date().toISOString(),
      heart_rate: 75,
      spo2: 83, // Breach
      systolic_bp: 120, // Normal
      diastolic_bp: 80, // Normal
    };

    const result = fusion.processVitals(spo2BreachPacket);

    // Must be VITALS_BREACH_ONLY because SpO2 does NOT match the cardiac/BP DDI
    assert.equal(result.decision_branch, "VITALS_BREACH_ONLY");
    assert.equal(result.alert?.type, "VITALS");
    assert.equal(result.alert?.severity, "RED");
    assert.equal(result.alert?.interaction, undefined);
  });

  it("Branch 2: Vitals breach AND matching critical interaction yields HIGH-PRIORITY COMPOUND ALERT", () => {
    const fusion = new FusionEngine();
    const patientId = "pt_branch2";

    // Patient taking Lisinopril + Metoprolol
    fusion.updateMedications(patientId, lisinoprilAndMetoprolol);

    // Hypotension & bradycardia breach matching affected_vitals
    const compoundPacket: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date().toISOString(),
      heart_rate: 46, // Bradycardia breach
      spo2: 96,
      systolic_bp: 74, // Severe hypotension breach
      diastolic_bp: 42,
    };

    const result = fusion.processVitals(compoundPacket);

    assert.equal(result.decision_branch, "COMPOUND_BREACH");
    assert.equal(result.is_silent, false);
    assert.ok(result.alert);

    const alert = result.alert;
    assert.equal(alert.severity, "RED");
    assert.equal(alert.type, "COMPOUND");

    // Rule: Never claim causation; use "possibly related to"
    assert.ok(
      alert.message.includes("possibly related to"),
      `Message must use "possibly related to", got: "${alert.message}"`,
    );
    assert.equal(
      alert.message.includes("caused by"),
      false,
      "Message must not claim causation with 'caused by'",
    );
    assert.equal(
      alert.message.includes("due to"),
      false,
      "Message must not claim causation with 'due to'",
    );

    // Rule: Line such as "Low blood pressure while taking X and Y... Show this medication list to the emergency team."
    assert.ok(
      alert.message.includes("while taking"),
      `Message must state drugs while taking, got: "${alert.message}"`,
    );
    assert.ok(
      alert.message.includes("Show this medication list to the emergency team."),
      `Message must prompt to show med list, got: "${alert.message}"`,
    );

    // Rule: Attach contributing_signals[] and interaction object
    assert.ok(Array.isArray(alert.contributing_signals));
    assert.ok(alert.contributing_signals.includes("systolic_bp"));
    assert.ok(alert.contributing_signals.includes("heart_rate"));

    assert.ok(alert.interaction);
    assert.ok(alert.interaction.drugs?.includes("Lisinopril"));
    assert.ok(alert.interaction.mechanism);
    assert.ok(alert.interaction.clinical_effect);

    // Rule: Add explanation payload for "Why this alert?" panel
    assert.ok(alert.explanation);
    assert.ok(alert.explanation.signals.length >= 2);
    assert.ok(alert.explanation.duration);
    assert.ok(alert.explanation.thresholds.systolic_bp);
    assert.ok(alert.explanation.thresholds.heart_rate);
    assert.ok(alert.explanation.matched_rule.includes("Compound Risk Rule"));
    assert.ok(alert.explanation.clinical_rationale);
  });

  it("Branch 3: Critical interaction with normal vitals stays silent and produces low-key dashboard card", () => {
    const fusion = new FusionEngine();
    const patientId = "pt_branch3";

    // Patient prescribed Lisinopril + Metoprolol (active critical interaction)
    fusion.updateMedications(patientId, lisinoprilAndMetoprolol);

    // Completely normal vitals
    const normalPacket: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date().toISOString(),
      heart_rate: 74,
      spo2: 98,
      systolic_bp: 120,
      diastolic_bp: 78,
    };

    const result = fusion.processVitals(normalPacket);

    assert.equal(result.decision_branch, "CRITICAL_INTERACTION_NORMAL_VITALS");
    assert.equal(result.is_silent, true);

    // Alert must NOT be critical RED
    assert.ok(result.alert);
    assert.equal(result.alert.severity, "GREEN");
    assert.equal(result.alert.silent, true);
    assert.equal(result.alert.dashboard_card_only, true);

    // Low-key card on the dashboard
    assert.ok(result.dashboard_card);
    assert.equal(result.dashboard_card.severity, "GREEN");
    assert.equal(result.dashboard_card.title, "Monitored Medication Interaction");
    assert.ok(result.dashboard_card.description.includes("Lisinopril"));
    assert.equal(result.dashboard_card.vitals_status, "Normal");
  });

  it("Done when: Sustained crisis plus a critical interaction yields one compound alert with a clear explanation", () => {
    const anomalyEngine = new AnomalyEngine({ confirmViolations: 2 });
    const ddiEngine = new DDIEngine();
    const fusion = new FusionEngine(anomalyEngine, ddiEngine);

    const patientId = "pt_sustained_crisis";
    fusion.updateMedications(patientId, lisinoprilAndMetoprolol);

    const baseTime = Date.now();

    // Reading 1: Initial breach
    const packet1: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date(baseTime).toISOString(),
      heart_rate: 48,
      spo2: 94,
      systolic_bp: 76,
      diastolic_bp: 44,
    };
    const res1 = fusion.processVitals(packet1, baseTime);
    assert.equal(res1.decision_branch, "COMPOUND_BREACH");
    assert.equal(res1.anomaly.consecutive_breaches, 1);

    // Reading 2: Sustained breach 30 seconds later
    const packet2: VitalsPacket = {
      patient_id: patientId,
      timestamp: new Date(baseTime + 30000).toISOString(),
      heart_rate: 45,
      spo2: 93,
      systolic_bp: 72,
      diastolic_bp: 40,
    };
    const res2 = fusion.processVitals(packet2, baseTime + 30000);

    assert.equal(res2.decision_branch, "COMPOUND_BREACH");
    assert.equal(res2.anomaly.is_sustained, true);
    assert.equal(res2.anomaly.consecutive_breaches, 2);
    assert.equal(res2.anomaly.duration_seconds, 30);

    // Verify clear explanation on sustained compound alert
    const alert = res2.alert!;
    assert.equal(alert.type, "COMPOUND");
    assert.equal(alert.severity, "RED");
    assert.ok(alert.explanation);
    assert.ok(alert.explanation.duration.includes("30s"));
    assert.ok(alert.explanation.duration.includes("2 consecutive readings"));
    assert.equal(alert.explanation.duration_seconds, 30);
    assert.ok(alert.explanation.thresholds.systolic_bp);
    assert.equal(alert.explanation.thresholds.systolic_bp.value, 72);
    assert.equal(alert.explanation.thresholds.systolic_bp.condition, "low");
    assert.ok(alert.explanation.matched_rule.includes("Compound Risk Rule"));
    assert.ok(alert.message.includes("possibly related to"));
    assert.ok(alert.message.includes("Show this medication list to the emergency team."));
  });
});
