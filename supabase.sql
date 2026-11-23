-- Jalankan di SQL Editor Supabase

CREATE TABLE IF NOT EXISTS device_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  device_status TEXT NOT NULL DEFAULT 'OFFLINE',
  avg_temp NUMERIC,
  avg_rh NUMERIC,
  active_count INTEGER DEFAULT 0,
  pump_status BOOLEAN DEFAULT false,
  mode_auto BOOLEAN DEFAULT true,
  phase TEXT DEFAULT 'VEGETATIF',
  active_lower_rh NUMERIC DEFAULT 70.0,
  active_upper_rh NUMERIC DEFAULT 80.0,
  config JSONB DEFAULT '{"vegetatif":{"bawah":70,"atas":80},"generatif":{"bawah":85,"atas":92}}'::jsonb,
  sensors JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO device_status (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  avg_temp NUMERIC,
  avg_rh NUMERIC,
  pump_status BOOLEAN,
  phase TEXT,
  sensors JSONB
);

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_created_at
ON telemetry_logs (created_at DESC);

ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'device_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE device_status;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated read device_status'
  ) THEN
    CREATE POLICY "Authenticated read device_status" ON device_status
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated read telemetry_logs'
  ) THEN
    CREATE POLICY "Authenticated read telemetry_logs" ON telemetry_logs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
