-- CareConnect PostgreSQL Hardened Schema Migration
-- Migration: 002_harden_schema.sql

-- 1. Patients Table (with AES-256-GCM encrypted PII fields at rest)
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    name_encrypted TEXT NOT NULL,
    phone_encrypted TEXT,
    dob VARCHAR(32),
    primary_caregiver_name_encrypted TEXT,
    primary_caregiver_phone_encrypted TEXT,
    secondary_contact_name_encrypted TEXT,
    secondary_contact_phone_encrypted TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);

-- 2. Medications Table
CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    drug_name VARCHAR(128) NOT NULL,
    generic_name VARCHAR(128) NOT NULL,
    form VARCHAR(64),
    strength VARCHAR(64),
    frequency VARCHAR(64),
    timing VARCHAR(128),
    duration_days INT DEFAULT 0,
    confidence NUMERIC(4,2) DEFAULT 1.0,
    rxnorm_id VARCHAR(64),
    safety_notes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_rxnorm ON medications(rxnorm_id);

-- 3. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    event_id VARCHAR(128) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    severity VARCHAR(16) NOT NULL,
    type VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    instructions JSONB,
    contributing_signals JSONB,
    interaction JSONB,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    feedback VARCHAR(32),
    feedback_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);

-- 4. Users Table (RBAC credentials)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(32) NOT NULL,
    patient_ids JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 5. Audit Access Logs Table (logs every view or edit of patient data)
CREATE TABLE IF NOT EXISTS audit_access_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64),
    role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(128) NOT NULL,
    patient_id VARCHAR(64),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_access_patient_id ON audit_access_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_access_action ON audit_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_access_created_at ON audit_access_logs(created_at DESC);

-- 6. Comprehensive Unified Audit Trail View
DROP VIEW IF EXISTS audit_trail CASCADE;
CREATE OR REPLACE VIEW audit_trail AS
SELECT 
    'EVENT' AS entry_type,
    id,
    alert_id,
    patient_id,
    event_type AS action,
    NULL::VARCHAR(32) AS channel,
    NULL::VARCHAR(128) AS recipient,
    NULL::INT AS step,
    NULL::VARCHAR(32) AS status,
    NULL::TEXT AS message_body,
    details,
    created_at
FROM audit_events
UNION ALL
SELECT 
    'ACKNOWLEDGMENT' AS entry_type,
    id,
    alert_id,
    patient_id,
    'ALERT_ACKNOWLEDGED' AS action,
    NULL::VARCHAR(32) AS channel,
    acknowledged_by AS recipient,
    NULL::INT AS step,
    'ACKNOWLEDGED' AS status,
    notes AS message_body,
    details,
    created_at
FROM audit_acknowledgments
UNION ALL
SELECT 
    'NOTIFICATION' AS entry_type,
    id,
    alert_id,
    patient_id,
    ('STEP_' || step || '_' || channel) AS action,
    channel,
    recipient,
    step,
    status,
    message_body,
    details,
    created_at
FROM audit_notifications
UNION ALL
SELECT
    'DATA_ACCESS' AS entry_type,
    id,
    NULL::VARCHAR(128) AS alert_id,
    patient_id,
    action,
    NULL::VARCHAR(32) AS channel,
    (user_id || ' (' || role || ')') AS recipient,
    NULL::INT AS step,
    'LOGGED' AS status,
    resource AS message_body,
    details,
    created_at
FROM audit_access_logs
ORDER BY created_at DESC;
