import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptField, decryptField, maskPhone, maskName } from "./crypto.js";
import { hashPassword, verifyPassword, signToken, verifyToken, DEMO_USERS } from "./auth.js";
import { writeVitalsToInflux, queryVitalsHistory, getLatestVitals } from "./influx.js";
import {
  savePatient,
  getPatient,
  recordDataAccessAudit,
  getAuditTrail,
  clearInMemoryAuditTrail,
} from "./db/index.js";
import { DEMO_PATIENTS } from "./db/seed.js";

test("Hardening 1: AES-256-GCM Field Encryption & PII Masking", () => {
  const plainName = "Eleanor Vance";
  const plainPhone = "+1-555-0100";

  // 1. Encryption
  const encName = encryptField(plainName);
  const encPhone = encryptField(plainPhone);

  assert.ok(encName && encName.startsWith("enc:v1:"));
  assert.ok(encPhone && encPhone.startsWith("enc:v1:"));
  assert.notEqual(encName, plainName);
  assert.notEqual(encPhone, plainPhone);

  // 2. Decryption
  const decName = decryptField(encName);
  const decPhone = decryptField(encPhone);
  assert.equal(decName, plainName);
  assert.equal(decPhone, plainPhone);

  // 3. PII Masking (never log raw PII)
  assert.equal(maskPhone("+15551234567"), "***-***-4567");
  assert.equal(maskName("Eleanor Vance"), "E*** V***");
});

test("Hardening 2: InfluxDB Vitals Telemetry & Querying", async () => {
  const packet1 = {
    patient_id: "pt_test_influx",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    heart_rate: 76,
    spo2: 98,
    systolic_bp: 124,
    diastolic_bp: 82,
  };
  const packet2 = {
    patient_id: "pt_test_influx",
    timestamp: new Date().toISOString(),
    heart_rate: 80,
    spo2: 99,
    systolic_bp: 120,
    diastolic_bp: 80,
  };

  await writeVitalsToInflux(packet1);
  await writeVitalsToInflux(packet2);

  const latest = await getLatestVitals("pt_test_influx");
  assert.ok(latest);
  assert.equal(latest.patient_id, "pt_test_influx");
  assert.equal(latest.heart_rate, 80);

  const history = await queryVitalsHistory("pt_test_influx", "-1h", 10);
  assert.ok(history.length >= 2);
  assert.equal(history[0].heart_rate, 80);
});

test("Hardening 3: JWT Auth & RBAC Password Security", () => {
  // 1. Password hashing & verification
  const password = "securePassword123!";
  const hash = hashPassword(password);
  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("wrongPassword", hash), false);

  // 2. JWT signing & verification
  const demoCaregiver = DEMO_USERS.find((u) => u.role === "caregiver")!;
  const token = signToken({
    id: demoCaregiver.id,
    username: demoCaregiver.username,
    role: demoCaregiver.role,
    patient_ids: demoCaregiver.patient_ids,
  });
  assert.ok(token);

  const verified = verifyToken(token);
  assert.ok(verified);
  assert.equal(verified.username, "caregiver");
  assert.equal(verified.role, "caregiver");
  assert.deepEqual(verified.patient_ids, ["pt_001", "pt_002"]);

  // 3. Demo users exist for all 4 roles
  const roles = DEMO_USERS.map((u) => u.role);
  assert.ok(roles.includes("caregiver"));
  assert.ok(roles.includes("secondary_contact"));
  assert.ok(roles.includes("pharmacist"));
  assert.ok(roles.includes("admin"));
});

test("Hardening 4: Patient Persistence & Audit Trail of Data Access", async () => {
  clearInMemoryAuditTrail();

  // 1. Save demo patient
  const p1 = DEMO_PATIENTS[0];
  await savePatient(p1);

  const loaded = await getPatient(p1.id);
  assert.ok(loaded);
  assert.equal(loaded.id, "pt_001");
  assert.equal(loaded.name, "Eleanor Vance");

  // 2. Log data access
  await recordDataAccessAudit({
    user_id: "usr_caregiver",
    role: "caregiver",
    action: "VIEW_PATIENT_DETAILS",
    resource: "/api/patients/pt_001",
    patient_id: "pt_001",
  });

  const trail = await getAuditTrail({ patient_id: "pt_001" });
  assert.ok(trail.length > 0);
  const accessLog = trail.find((t) => t.action === "VIEW_PATIENT_DETAILS");
  assert.ok(accessLog);
  assert.equal(accessLog.entry_type, "DATA_ACCESS");
  assert.equal(accessLog.patient_id, "pt_001");
  assert.equal(accessLog.status, "LOGGED");
});
