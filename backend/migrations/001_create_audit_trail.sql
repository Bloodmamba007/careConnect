-- CareConnect PostgreSQL Audit Trail Migration
-- Migration: 001_create_audit_trail.sql

-- 1. Table for escalation & alert lifecycle events
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(128) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32),
    alert_type VARCHAR(32),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_alert_id ON audit_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_patient_id ON audit_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- 2. Table for alert acknowledgments
CREATE TABLE IF NOT EXISTS audit_acknowledgments (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(128) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    acknowledged_by VARCHAR(128),
    notes TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_ack_alert_id ON audit_acknowledgments(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_ack_patient_id ON audit_acknowledgments(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_ack_created_at ON audit_acknowledgments(created_at);

-- 3. Table for notifications (SMS, Voice, FCM Push)
CREATE TABLE IF NOT EXISTS audit_notifications (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(128) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    step INT NOT NULL,
    channel VARCHAR(32) NOT NULL,
    recipient VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    message_body TEXT,
    sid VARCHAR(128),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_notif_alert_id ON audit_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_notif_patient_id ON audit_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_notif_created_at ON audit_notifications(created_at);

-- 4. Unified Audit Trail View
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
ORDER BY created_at DESC;
