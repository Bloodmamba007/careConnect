import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { encryptField, decryptField } from "../crypto.js";
import type { Alert, Medication } from "../types.js";

const { Pool } = pg;

export interface AuditTrailEntry {
  id: number;
  entry_type: "EVENT" | "ACKNOWLEDGMENT" | "NOTIFICATION" | "DATA_ACCESS";
  alert_id?: string | null;
  patient_id?: string | null;
  action: string;
  channel?: string | null;
  recipient?: string | null;
  step?: number | null;
  status?: string | null;
  message_body?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface PatientRecord {
  id: string;
  name: string;
  phone?: string | null;
  dob?: string | null;
  primary_caregiver_name?: string | null;
  primary_caregiver_phone?: string | null;
  secondary_contact_name?: string | null;
  secondary_contact_phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

let pool: pg.Pool | null = null;
let isDbConnected: boolean | null = null;

// In-memory fallback stores when PostgreSQL is unavailable or in mock test mode
const inMemoryAuditTrail: AuditTrailEntry[] = [];
const inMemoryPatients = new Map<string, PatientRecord>();
const inMemoryMedications = new Map<string, Medication[]>();
const inMemoryAlerts = new Map<string, Alert>();
let inMemoryIdCounter = 1;

export function getDbPool(): pg.Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://careconnect:careconnect@localhost:5432/careconnect";
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.warn("[PostgreSQL] Pool error:", err.message);
      isDbConnected = false;
    });
  }
  return pool;
}

export async function checkDbConnection(): Promise<boolean> {
  if (process.env.MOCK_NOTIFICATIONS === "true" && !process.env.FORCE_DB) {
    return false;
  }
  try {
    const client = await getDbPool().connect();
    await client.query("SELECT 1");
    client.release();
    isDbConnected = true;
    return true;
  } catch (err: unknown) {
    isDbConnected = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[PostgreSQL] Connection unavailable (${msg}). Using in-memory store.`);
    return false;
  }
}

/**
 * Runs all SQL migrations in order from migrations/ directory
 */
export async function runMigrations(): Promise<void> {
  const connected = await checkDbConnection();
  if (!connected) {
    console.warn("[PostgreSQL] Skipping migrations: database is unreachable. Using in-memory storage.");
    return;
  }

  const migrationsDir = path.resolve(__dirname, "../../migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await getDbPool().connect();
  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf-8");
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`[PostgreSQL] Migration ${file} applied successfully.`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PostgreSQL] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Records general escalation lifecycle event
 */
export async function recordAuditEvent(event: {
  alert_id: string;
  patient_id: string;
  event_type: string;
  severity?: string;
  alert_type?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  inMemoryAuditTrail.unshift({
    id: inMemoryIdCounter++,
    entry_type: "EVENT",
    alert_id: event.alert_id,
    patient_id: event.patient_id,
    action: event.event_type,
    details: event.details ?? null,
    created_at: timestamp,
  });

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      await p.query(
        `INSERT INTO audit_events (alert_id, patient_id, event_type, severity, alert_type, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.alert_id,
          event.patient_id,
          event.event_type,
          event.severity ?? null,
          event.alert_type ?? null,
          event.details ? JSON.stringify(event.details) : null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

/**
 * Records alert acknowledgment
 */
export async function recordAcknowledgment(ack: {
  alert_id: string;
  patient_id: string;
  acknowledged_by?: string;
  notes?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  inMemoryAuditTrail.unshift({
    id: inMemoryIdCounter++,
    entry_type: "ACKNOWLEDGMENT",
    alert_id: ack.alert_id,
    patient_id: ack.patient_id,
    action: "ALERT_ACKNOWLEDGED",
    recipient: ack.acknowledged_by ?? null,
    message_body: ack.notes ?? null,
    status: "ACKNOWLEDGED",
    details: ack.details ?? null,
    created_at: timestamp,
  });

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      await p.query(
        `INSERT INTO audit_acknowledgments (alert_id, patient_id, acknowledged_by, notes, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ack.alert_id,
          ack.patient_id,
          ack.acknowledged_by ?? "unknown",
          ack.notes ?? null,
          ack.details ? JSON.stringify(ack.details) : null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

/**
 * Records notifications (SMS, Voice, FCM)
 */
export async function recordNotification(notif: {
  alert_id: string;
  patient_id: string;
  step: number;
  channel: "SMS" | "VOICE" | "FCM";
  recipient: string;
  status: "SENT" | "MOCKED" | "FAILED" | "STUBBED";
  message_body?: string;
  sid?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  inMemoryAuditTrail.unshift({
    id: inMemoryIdCounter++,
    entry_type: "NOTIFICATION",
    alert_id: notif.alert_id,
    patient_id: notif.patient_id,
    action: `STEP_${notif.step}_${notif.channel}`,
    step: notif.step,
    channel: notif.channel,
    recipient: notif.recipient,
    status: notif.status,
    message_body: notif.message_body ?? null,
    details: notif.details ?? null,
    created_at: timestamp,
  });

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      await p.query(
        `INSERT INTO audit_notifications (alert_id, patient_id, step, channel, recipient, status, message_body, sid, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          notif.alert_id,
          notif.patient_id,
          notif.step,
          notif.channel,
          notif.recipient,
          notif.status,
          notif.message_body ?? null,
          notif.sid ?? null,
          notif.details ? JSON.stringify(notif.details) : null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

/**
 * Requirement 5: Log every view or edit of patient data and every alert action
 */
export async function recordDataAccessAudit(entry: {
  user_id?: string;
  role?: string;
  action: string;
  resource: string;
  patient_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  inMemoryAuditTrail.unshift({
    id: inMemoryIdCounter++,
    entry_type: "DATA_ACCESS",
    patient_id: entry.patient_id ?? null,
    action: entry.action,
    recipient: `${entry.user_id || "anonymous"} (${entry.role || "guest"})`,
    status: "LOGGED",
    message_body: entry.resource,
    details: entry.details ?? null,
    created_at: timestamp,
  });

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      await p.query(
        `INSERT INTO audit_access_logs (user_id, role, action, resource, patient_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.user_id ?? "anonymous",
          entry.role ?? "guest",
          entry.action,
          entry.resource,
          entry.patient_id ?? null,
          entry.details ? JSON.stringify(entry.details) : null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

/**
 * Patient data store with column-level encryption at rest for PII
 */
export async function savePatient(patient: PatientRecord): Promise<void> {
  // Always update in-memory
  inMemoryPatients.set(patient.id, patient);

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      const encName = encryptField(patient.name);
      const encPhone = encryptField(patient.phone);
      const encPriName = encryptField(patient.primary_caregiver_name);
      const encPriPhone = encryptField(patient.primary_caregiver_phone);
      const encSecName = encryptField(patient.secondary_contact_name);
      const encSecPhone = encryptField(patient.secondary_contact_phone);

      await p.query(
        `INSERT INTO patients (
          id, name_encrypted, phone_encrypted, dob,
          primary_caregiver_name_encrypted, primary_caregiver_phone_encrypted,
          secondary_contact_name_encrypted, secondary_contact_phone_encrypted, notes, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name_encrypted = EXCLUDED.name_encrypted,
          phone_encrypted = EXCLUDED.phone_encrypted,
          dob = EXCLUDED.dob,
          primary_caregiver_name_encrypted = EXCLUDED.primary_caregiver_name_encrypted,
          primary_caregiver_phone_encrypted = EXCLUDED.primary_caregiver_phone_encrypted,
          secondary_contact_name_encrypted = EXCLUDED.secondary_contact_name_encrypted,
          secondary_contact_phone_encrypted = EXCLUDED.secondary_contact_phone_encrypted,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP`,
        [
          patient.id,
          encName,
          encPhone,
          patient.dob ?? null,
          encPriName,
          encPriPhone,
          encSecName,
          encSecPhone,
          patient.notes ?? null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

export async function getPatient(patient_id: string): Promise<PatientRecord | null> {
  if (isDbConnected) {
    try {
      const p = getDbPool();
      const res = await p.query(`SELECT * FROM patients WHERE id = $1`, [patient_id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          name: decryptField(row.name_encrypted) || row.name_encrypted,
          phone: decryptField(row.phone_encrypted) || row.phone_encrypted,
          dob: row.dob,
          primary_caregiver_name: decryptField(row.primary_caregiver_name_encrypted),
          primary_caregiver_phone: decryptField(row.primary_caregiver_phone_encrypted),
          secondary_contact_name: decryptField(row.secondary_contact_name_encrypted),
          secondary_contact_phone: decryptField(row.secondary_contact_phone_encrypted),
          notes: row.notes,
          created_at: row.created_at?.toISOString ? row.created_at.toISOString() : String(row.created_at),
          updated_at: row.updated_at?.toISOString ? row.updated_at.toISOString() : String(row.updated_at),
        };
      }
    } catch {
      isDbConnected = false;
    }
  }
  return inMemoryPatients.get(patient_id) || null;
}

export async function getAllPatients(): Promise<PatientRecord[]> {
  if (isDbConnected) {
    try {
      const p = getDbPool();
      const res = await p.query(`SELECT * FROM patients ORDER BY id ASC`);
      if (res.rows.length > 0) {
        return res.rows.map((row) => ({
          id: row.id,
          name: decryptField(row.name_encrypted) || row.name_encrypted,
          phone: decryptField(row.phone_encrypted) || row.phone_encrypted,
          dob: row.dob,
          primary_caregiver_name: decryptField(row.primary_caregiver_name_encrypted),
          primary_caregiver_phone: decryptField(row.primary_caregiver_phone_encrypted),
          secondary_contact_name: decryptField(row.secondary_contact_name_encrypted),
          secondary_contact_phone: decryptField(row.secondary_contact_phone_encrypted),
          notes: row.notes,
        }));
      }
    } catch {
      isDbConnected = false;
    }
  }
  return Array.from(inMemoryPatients.values());
}

/**
 * Medications store
 */
export async function savePatientMedications(patient_id: string, meds: Medication[]): Promise<void> {
  inMemoryMedications.set(patient_id, meds);

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM medications WHERE patient_id = $1`, [patient_id]);
        for (const m of meds) {
          await client.query(
            `INSERT INTO medications (
              patient_id, drug_name, generic_name, form, strength, frequency,
              timing, duration_days, confidence, rxnorm_id, safety_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              patient_id,
              m.drug_name,
              m.generic_name,
              m.form,
              m.strength,
              m.frequency,
              m.timing,
              m.duration_days ?? 0,
              m.confidence ?? 1.0,
              m.rxnorm_id,
              m.safety_notes ? JSON.stringify(m.safety_notes) : null,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch {
      isDbConnected = false;
    }
  }
}

export async function getPatientMedications(patient_id: string): Promise<Medication[]> {
  if (isDbConnected) {
    try {
      const p = getDbPool();
      const res = await p.query(
        `SELECT * FROM medications WHERE patient_id = $1 ORDER BY id ASC`,
        [patient_id],
      );
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          drug_name: r.drug_name,
          generic_name: r.generic_name,
          form: r.form,
          strength: r.strength,
          frequency: r.frequency,
          timing: r.timing,
          duration_days: Number(r.duration_days),
          confidence: Number(r.confidence),
          rxnorm_id: r.rxnorm_id,
          safety_notes: typeof r.safety_notes === "string" ? JSON.parse(r.safety_notes) : r.safety_notes,
        }));
      }
    } catch {
      isDbConnected = false;
    }
  }
  return inMemoryMedications.get(patient_id) || [];
}

/**
 * Alerts store
 */
export async function saveAlert(alert: Alert): Promise<void> {
  inMemoryAlerts.set(alert.event_id, alert);

  if (isDbConnected !== false) {
    try {
      const p = getDbPool();
      await p.query(
        `INSERT INTO alerts (
          event_id, patient_id, timestamp, severity, type, message,
          instructions, contributing_signals, interaction, acknowledged,
          acknowledged_at, feedback, feedback_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (event_id) DO UPDATE SET
          acknowledged = EXCLUDED.acknowledged,
          acknowledged_at = EXCLUDED.acknowledged_at,
          feedback = EXCLUDED.feedback,
          feedback_at = EXCLUDED.feedback_at`,
        [
          alert.event_id,
          alert.patient_id,
          alert.timestamp,
          alert.severity,
          alert.type,
          alert.message,
          alert.instructions ? JSON.stringify(alert.instructions) : null,
          alert.contributing_signals ? JSON.stringify(alert.contributing_signals) : null,
          alert.interaction ? JSON.stringify(alert.interaction) : null,
          alert.acknowledged ?? false,
          alert.acknowledged_at ?? null,
          alert.feedback ?? null,
          alert.feedback_at ?? null,
        ],
      );
    } catch {
      isDbConnected = false;
    }
  }
}

export async function getAlerts(limit = 100): Promise<Alert[]> {
  if (isDbConnected) {
    try {
      const p = getDbPool();
      const res = await p.query(
        `SELECT * FROM alerts ORDER BY timestamp DESC LIMIT $1`,
        [limit],
      );
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          event_id: r.event_id,
          patient_id: r.patient_id,
          timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : String(r.timestamp),
          severity: r.severity,
          type: r.type,
          message: r.message,
          instructions: typeof r.instructions === "string" ? JSON.parse(r.instructions) : (r.instructions ?? []),
          contributing_signals:
            typeof r.contributing_signals === "string"
              ? JSON.parse(r.contributing_signals)
              : (r.contributing_signals ?? []),
          interaction: typeof r.interaction === "string" ? JSON.parse(r.interaction) : r.interaction,
          acknowledged: r.acknowledged,
          acknowledged_at: r.acknowledged_at,
          feedback: r.feedback,
          feedback_at: r.feedback_at,
        }));
      }
    } catch {
      isDbConnected = false;
    }
  }
  return Array.from(inMemoryAlerts.values()).slice(-limit);
}

/**
 * Retrieves the unified audit trail
 */
export async function getAuditTrail(filter?: {
  alert_id?: string;
  patient_id?: string;
}): Promise<AuditTrailEntry[]> {
  if (isDbConnected) {
    try {
      const p = getDbPool();
      let query = "SELECT * FROM audit_trail";
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (filter?.alert_id) {
        params.push(filter.alert_id);
        conditions.push(`alert_id = $${params.length}`);
      }
      if (filter?.patient_id) {
        params.push(filter.patient_id);
        conditions.push(`patient_id = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY created_at DESC LIMIT 200";

      const res = await p.query(query, params);
      return res.rows.map((r) => ({
        id: r.id,
        entry_type: r.entry_type,
        alert_id: r.alert_id,
        patient_id: r.patient_id,
        action: r.action,
        channel: r.channel,
        recipient: r.recipient,
        step: r.step,
        status: r.status,
        message_body: r.message_body,
        details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
        created_at: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at),
      }));
    } catch {
      isDbConnected = false;
    }
  }

  // Fallback to in-memory
  return inMemoryAuditTrail.filter((item) => {
    if (filter?.alert_id && item.alert_id !== filter.alert_id) return false;
    if (filter?.patient_id && item.patient_id !== filter.patient_id) return false;
    return true;
  });
}

export function clearInMemoryAuditTrail(): void {
  inMemoryAuditTrail.length = 0;
  inMemoryPatients.clear();
  inMemoryMedications.clear();
  inMemoryAlerts.clear();
  inMemoryIdCounter = 1;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isDbConnected = null;
  }
}
