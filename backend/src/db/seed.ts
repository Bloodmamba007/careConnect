import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();

import {
  runMigrations,
  savePatient,
  savePatientMedications,
  saveAlert,
  recordDataAccessAudit,
  getDbPool,
  checkDbConnection,
  closeDbPool,
  type PatientRecord,
} from "./index.js";
import { DEMO_USERS } from "../auth.js";
import { writeVitalsToInflux } from "../influx.js";
import type { Alert, Medication } from "../types.js";

/**
 * CareConnect Database Seeder
 * Populates PostgreSQL with 2 demo patients (encrypted PII at rest),
 * active medications, initial alerts, RBAC users, and baseline InfluxDB telemetry.
 */

export const DEMO_PATIENTS: PatientRecord[] = [
  {
    id: "pt_001",
    name: "Eleanor Vance",
    phone: "+1-555-0100",
    dob: "1942-03-15",
    primary_caregiver_name: "Sarah Vance",
    primary_caregiver_phone: "+1-555-0101",
    secondary_contact_name: "Dr. Marcus Vance",
    secondary_contact_phone: "+1-555-0102",
    notes: "Stage 2 Hypertension, Hyperlipidemia, mild CAD. History of orthostatic dizziness.",
  },
  {
    id: "pt_002",
    name: "Arthur Pendelton",
    phone: "+1-555-0200",
    dob: "1946-08-22",
    primary_caregiver_name: "Robert Pendelton",
    primary_caregiver_phone: "+1-555-0201",
    secondary_contact_name: "Emily Pendelton",
    secondary_contact_phone: "+1-555-0202",
    notes: "Persistent Atrial Fibrillation, Osteoarthritis. Anticoagulated with high bleeding risk.",
  },
];

export const DEMO_MEDICATIONS_PT001: Medication[] = [
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
    safety_notes: [
      "Take with or without food at the same time each day.",
      "Monitor for orthostatic dizziness when standing quickly.",
    ],
  },
  {
    drug_name: "Metoprolol Tartrate",
    generic_name: "metoprolol",
    form: "tablet",
    strength: "25 mg",
    frequency: "twice daily",
    timing: "morning & evening with meals",
    duration_days: 60,
    confidence: 0.96,
    rxnorm_id: "866416",
    safety_notes: [
      "Take with or immediately after food.",
      "Check pulse prior to taking; hold if HR < 55 bpm without clinician approval.",
    ],
  },
  {
    drug_name: "Lipitor",
    generic_name: "atorvastatin",
    form: "tablet",
    strength: "20 mg",
    frequency: "once daily",
    timing: "bedtime",
    duration_days: 90,
    confidence: 0.99,
    rxnorm_id: "617314",
    safety_notes: [
      "Avoid large amounts of grapefruit juice.",
      "Report unexplained muscle stiffness or weakness.",
    ],
  },
];

export const DEMO_MEDICATIONS_PT002: Medication[] = [
  {
    drug_name: "Coumadin",
    generic_name: "warfarin",
    form: "tablet",
    strength: "5 mg",
    frequency: "once daily",
    timing: "evening at 6 PM",
    duration_days: 180,
    confidence: 0.97,
    rxnorm_id: "855332",
    safety_notes: [
      "CRITICAL: Consistent dietary vitamin K intake required.",
      "Monitor for bruising, hematuria, or dark stools.",
      "Do NOT take NSAIDs (ibuprofen, aspirin) without hematology consult.",
    ],
  },
  {
    drug_name: "Crocin",
    generic_name: "paracetamol",
    form: "tablet",
    strength: "500 mg",
    frequency: "as needed",
    timing: "with water, max 2000mg/day",
    duration_days: 30,
    confidence: 0.95,
    rxnorm_id: "161",
    safety_notes: [
      "Safe analgesic choice with anticoagulants.",
      "Do not exceed 4 tablets in 24 hours.",
    ],
  },
  {
    drug_name: "Prilosec",
    generic_name: "omeprazole",
    form: "delayed-release capsule",
    strength: "20 mg",
    frequency: "once daily",
    timing: "morning 30 min before breakfast",
    duration_days: 60,
    confidence: 0.96,
    rxnorm_id: "7646",
    safety_notes: ["Swallow whole; do not chew or crush."],
  },
];

export async function seedDatabase(): Promise<void> {
  console.log("🌱 [CareConnect Seed] Initializing database seeding...");

  // 1. Run migrations if DB is available
  try {
    await runMigrations();
  } catch (err) {
    console.warn("⚠️ [CareConnect Seed] Migration check skipped (using fallback):", err instanceof Error ? err.message : err);
  }

  // 2. Seed Patients (Names & Phones encrypted at rest)
  for (const patient of DEMO_PATIENTS) {
    await savePatient(patient);
    console.log(`✅ Seeded Patient ${patient.id} (PII encrypted at rest)`);
  }

  // 3. Seed Medications
  await savePatientMedications("pt_001", DEMO_MEDICATIONS_PT001);
  await savePatientMedications("pt_002", DEMO_MEDICATIONS_PT002);
  console.log("✅ Seeded Active Medication Regimens for pt_001 and pt_002");

  // 4. Seed Initial Baseline Alert
  const baselineAlert: Alert = {
    event_id: "alert_demo_init_001",
    patient_id: "pt_001",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    severity: "GREEN",
    type: "VITALS",
    message: "Baseline vitals established: Normal hemodynamics and oxygenation.",
    instructions: ["Continue scheduled monitoring", "Keep routine follow-up"],
    contributing_signals: ["heart_rate", "spo2", "systolic_bp"],
    acknowledged: true,
    acknowledged_at: new Date(Date.now() - 3500000).toISOString(),
  };
  await saveAlert(baselineAlert);

  // 5. Seed Users in PostgreSQL if connected
  const isConnected = await checkDbConnection();
  if (isConnected) {
    const pool = getDbPool();
    for (const u of DEMO_USERS) {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, role, patient_ids)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          patient_ids = EXCLUDED.patient_ids`,
        [u.id, u.username, u.password_hash, u.role, JSON.stringify(u.patient_ids)],
      );
    }
    console.log(`✅ Seeded ${DEMO_USERS.length} RBAC Users (admin, caregiver, secondary, pharmacist)`);
  }

  // 6. Write Baseline Vitals to InfluxDB
  await writeVitalsToInflux({
    patient_id: "pt_001",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    heart_rate: 72,
    spo2: 98,
    systolic_bp: 122,
    diastolic_bp: 78,
  });

  await writeVitalsToInflux({
    patient_id: "pt_002",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    heart_rate: 68,
    spo2: 97,
    systolic_bp: 126,
    diastolic_bp: 80,
  });
  console.log("✅ Seeded InfluxDB Baseline Telemetry for pt_001 and pt_002");

  // 7. Audit log of seed operation
  await recordDataAccessAudit({
    user_id: "system_seeder",
    role: "admin",
    action: "DATABASE_SEEDED",
    resource: "/api/system/seed",
    details: { patients_seeded: ["pt_001", "pt_002"] },
  });

  console.log("✨ [CareConnect Seed] Database successfully seeded with 2 demo patients!");
}

// Execute directly if run as CLI script
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDatabase()
    .then(async () => {
      await closeDbPool();
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
