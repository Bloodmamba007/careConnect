-- Supabase Realtime Notifications Table
-- This table stores push notifications for offline/polling support
-- Realtime broadcasts are the primary method; this is for backup/audit

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast patient-specific queries
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;

-- Policy: Service role can do anything
CREATE POLICY "Service role full access" ON notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read notifications for their patients
CREATE POLICY "Read patient notifications" ON notifications
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT patient_id FROM patient_assignments
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can mark as read
CREATE POLICY "Mark as read" ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (
      SELECT patient_id FROM patient_assignments
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Enable Realtime for this table (run in Supabase dashboard or via SQL)
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
