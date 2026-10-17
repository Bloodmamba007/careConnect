import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

export interface AuditTrailEntry {
  id: number;
  entry_type: "EVENT" | "ACKNOWLEDGMENT" | "NOTIFICATION";
  alert_id: string;
  patient_id: string;
  action: string;
  channel?: string | null;
  recipient?: string | null;
  step?: number | null;
  status?: string | null;
  message_body?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

let pool: pg.Pool | null = null;
let isDbConnected: boolean | null = null;

// In-memory fallback buffer when PostgreSQL is unavailable or in mock test mode
const inMemoryAuditTrail: AuditTrailEntry[] = [];
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
    console.warn(`[PostgreSQL] Connection unavailable (${msg}). Using in-memory audit trail fallback.`);
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  const connected = await checkDbConnection();
  if (!connected) {
    console.warn("[PostgreSQL] Skipping migrations: database is unreachable. Using in-memory storage.");
    return;
  }

  const migrationPath = path.resolve(__dirname, "../../migrations/001_create_audit_trail.sql");
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");
  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[PostgreSQL] Migration 001_create_audit_trail applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PostgreSQL] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function recordAuditEvent(event: {
  alert_id: string;
  patient_id: string;
  event_type: string;
  severity?: string;
  alert_type?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  // Always log to in-memory store for fast lookup and fallback
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
  inMemoryIdCounter = 1;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isDbConnected = null;
  }
}
