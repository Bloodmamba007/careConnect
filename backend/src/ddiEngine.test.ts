import assert from "node:assert/strict";
import { test } from "node:test";
import type { Medication } from "./types.js";
import {
  generateMedicationPairs,
  normalizeDrugName,
  analyzeDrugInteractions,
  DISCLAIMER,
  DdiRule,
} from "./ddiEngine.js";

function makeMed(drug_name: string, generic_name: string = "", confidence: number = 0.95): Medication {
  return {
    drug_name,
    generic_name,
    form: "tablet",
    strength: "10 mg",
    frequency: "once daily",
    timing: "morning",
    duration_days: 30,
    confidence,
    rxnorm_id: "12345",
  };
}

test("Pair generation produces exactly n(n-1)/2 unique pairs", () => {
  const meds4 = [
    makeMed("DrugA"),
    makeMed("DrugB"),
    makeMed("DrugC"),
    makeMed("DrugD"),
  ];
  const pairs4 = generateMedicationPairs(meds4);
  assert.equal(pairs4.length, (4 * 3) / 2); // 6 pairs

  // Ensure all pairs are unique unordered combinations
  const pairKeys = new Set(
    pairs4.map(([a, b]) => `${a.drug_name}_${b.drug_name}`),
  );
  assert.equal(pairKeys.size, 6);

  // Single medication produces 0 pairs
  assert.equal(generateMedicationPairs([makeMed("Solo")]).length, 0);

  // Empty list produces 0 pairs
  assert.equal(generateMedicationPairs([]).length, 0);
});

test("Brand to generic mapping resolves correctly", () => {
  assert.equal(normalizeDrugName(makeMed("Advil")), "ibuprofen");
  assert.equal(normalizeDrugName(makeMed("Motrin")), "ibuprofen");
  assert.equal(normalizeDrugName(makeMed("Crocin")), "paracetamol");
  assert.equal(normalizeDrugName(makeMed("Tylenol")), "paracetamol");
  assert.equal(normalizeDrugName(makeMed("Coumadin")), "warfarin");
  assert.equal(normalizeDrugName(makeMed("Viagra")), "sildenafil");
  assert.equal(normalizeDrugName(makeMed("Lipitor")), "atorvastatin");
});

test("CRITICAL interaction generates a RED COMPOUND alert", () => {
  const meds = [
    makeMed("Warfarin", "warfarin"),
    makeMed("Advil", "ibuprofen"),
  ];

  const result = analyzeDrugInteractions("pt_100", meds);

  assert.equal(result.patient_id, "pt_100");
  assert.equal(result.pairs_evaluated, 1);
  assert.equal(result.critical_interactions.length, 1);
  assert.ok(result.critical_alert !== null, "Must generate critical alert");
  assert.equal(result.critical_alert?.severity, "RED");
  assert.equal(result.critical_alert?.type, "COMPOUND");
  assert.ok(result.critical_alert?.message.includes("CRITICAL"));
  assert.ok(result.critical_alert?.contributing_signals.includes("bleeding risk"));
  assert.deepEqual(result.critical_alert?.interaction?.drugs, ["Warfarin", "Advil"]);
  assert.equal(result.disclaimer, DISCLAIMER);
});

test("MINOR and MODERATE interactions do NOT generate an alert", () => {
  const meds = [
    makeMed("Clopidogrel", "clopidogrel"),
    makeMed("Omeprazole", "omeprazole"),
  ];

  const result = analyzeDrugInteractions("pt_200", meds);

  assert.equal(result.moderate_interactions.length, 1);
  assert.equal(result.critical_interactions.length, 0);
  assert.equal(result.critical_alert, null, "Moderate interactions must NOT emit RED alert");
  assert.equal(result.disclaimer, DISCLAIMER);
});

test("Unknown drugs flag 'Unverified Medication - Manual Review Required' without breaking", () => {
  const meds = [
    makeMed("Warfarin", "warfarin"),
    makeMed("??? illegible scribble", "", 0.15),
    makeMed("Unknown", "", 0.2),
  ];

  const result = analyzeDrugInteractions("pt_300", meds);

  assert.equal(result.unverified_medications.length, 2);
  for (const unv of result.unverified_medications) {
    assert.equal(unv.warning, "Unverified Medication - Manual Review Required");
    assert.equal(unv.patient_id, "pt_300");
  }

  // Only valid medications evaluated in pairs
  assert.equal(result.pairs_evaluated, 0); // Only 1 valid med, so 0 pairs
  assert.equal(result.disclaimer, DISCLAIMER);
});

test("Well-known critical pairs from interactions.json trigger correctly", () => {
  // Test Sildenafil + Nitroglycerin
  const res1 = analyzeDrugInteractions("pt_400", [
    makeMed("Viagra", "sildenafil"),
    makeMed("Nitrostat", "nitroglycerin"),
  ]);
  assert.equal(res1.critical_interactions.length, 1);
  assert.equal(res1.critical_alert?.severity, "RED");

  // Test SSRI + Tramadol
  const res2 = analyzeDrugInteractions("pt_401", [
    makeMed("Zoloft", "sertraline"),
    makeMed("Ultram", "tramadol"),
  ]);
  assert.equal(res2.critical_interactions.length, 1);
  assert.ok(res2.critical_alert?.message.includes("Serotonin"));

  // Test ACE inhibitor + Potassium-sparing diuretic
  const res3 = analyzeDrugInteractions("pt_402", [
    makeMed("Zestril", "lisinopril"),
    makeMed("Aldactone", "spironolactone"),
  ]);
  assert.equal(res3.critical_interactions.length, 1);
  assert.ok(res3.critical_alert?.contributing_signals.includes("hyperkalemia"));
});
