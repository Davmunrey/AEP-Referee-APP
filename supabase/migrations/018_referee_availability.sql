-- Periods when a referee is NOT available (holiday, injury, personal, etc.)
CREATE TABLE IF NOT EXISTS referee_availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id  UUID NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  notas        TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fecha_fin_gte_inicio CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_referee_availability_referee_id
  ON referee_availability (referee_id);

CREATE INDEX IF NOT EXISTS idx_referee_availability_dates
  ON referee_availability (fecha_inicio, fecha_fin);

ALTER TABLE referee_availability ENABLE ROW LEVEL SECURITY;

-- Anonymous: no access
CREATE POLICY "anon_no_access_availability" ON referee_availability
  FOR ALL TO anon USING (false);

-- Authenticated read-all (admins/delegates need full view for roster decisions)
CREATE POLICY "auth_read_availability" ON referee_availability
  FOR SELECT TO authenticated USING (true);

-- Authenticated write (admins and delegates manage availability)
CREATE POLICY "auth_write_availability" ON referee_availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
