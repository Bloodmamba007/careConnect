import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("End-to-end prescription ingestion flow: upload image -> parse -> confirm -> interaction check", async () => {
  // 1. Locate a sample prescription image from the prescription/samples directory
  const samplesDir = path.resolve(process.cwd(), "../prescription/samples");
  const sampleImagePath = path.join(samplesDir, "printed.png");
  assert.ok(fs.existsSync(sampleImagePath), "Sample printed.png should exist");

  const imageBuffer = fs.readFileSync(sampleImagePath);

  // Build multipart form-data payload using standard FormData
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  formData.append("file", blob, "printed.png");
  formData.append("patient_id", "pt_e2e_flow");

  // 2. Call POST /api/prescriptions/parse via backend proxy
  const parseRes = await fetch("http://localhost:4000/api/prescriptions/parse", {
    method: "POST",
    body: formData,
  });

  assert.equal(parseRes.status, 201, "Prescription parsing endpoint should return 201");
  const parseData = (await parseRes.json()) as any;

  assert.ok(parseData.prescription_id, "Response must include prescription_id");
  assert.ok(
    ["auto_approved", "needs_review"].includes(parseData.status),
    `Status should be auto_approved or needs_review, got ${parseData.status}`,
  );
  assert.ok(Array.isArray(parseData.medications), "Should return parsed medications array");

  // 3. Confirm medications: POST /api/patients/:id/medications
  // Include warfarin + ibuprofen to verify the DDI engine triggers a critical interaction
  const confirmedMeds = [
    {
      drug_name: "Coumadin",
      generic_name: "warfarin",
      form: "tablet",
      strength: "5 mg",
      frequency: "once daily",
      timing: "evening",
      duration_days: 90,
      confidence: 0.95,
      rxnorm_id: "11289",
    },
    {
      drug_name: "Advil",
      generic_name: "ibuprofen",
      form: "tablet",
      strength: "400 mg",
      frequency: "twice daily",
      timing: "after meals",
      duration_days: 14,
      confidence: 0.95,
      rxnorm_id: "5640",
    },
  ];

  const confirmRes = await fetch("http://localhost:4000/api/patients/pt_e2e_flow/medications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medications: confirmedMeds }),
  });

  assert.equal(confirmRes.status, 201, "Confirming medications should return 201");
  const ddiResult = (await confirmRes.json()) as any;

  // 4. Verify Phase 6 interaction engine result
  assert.ok(ddiResult.interactions, "Result should contain interactions");
  assert.ok(
    ddiResult.critical_interactions.length >= 1,
    "Should detect critical interaction for warfarin + ibuprofen",
  );

  const warfarinIbuprofen = ddiResult.critical_interactions.find(
    (ci: any) =>
      (ci.rule?.drug_a === "warfarin" && ci.rule?.drug_b === "ibuprofen") ||
      (ci.rule?.drug_a === "ibuprofen" && ci.rule?.drug_b === "warfarin"),
  );
  assert.ok(warfarinIbuprofen, "Warfarin + Ibuprofen critical pair detected");
  assert.equal(warfarinIbuprofen.severity, "CRITICAL");
  assert.ok(
    warfarinIbuprofen.caregiver_warning.toLowerCase().includes("bleeding"),
    "Warning should mention bleeding risk",
  );

  // 5. Query GET /api/patients/:id/interactions to ensure persistence and store consistency
  const queryRes = await fetch("http://localhost:4000/api/patients/pt_e2e_flow/interactions");
  assert.equal(queryRes.status, 200);
  const queryData = (await queryRes.json()) as any;
  assert.equal(queryData.patient_id, "pt_e2e_flow");
  assert.ok(queryData.critical_interactions.length >= 1);
});
