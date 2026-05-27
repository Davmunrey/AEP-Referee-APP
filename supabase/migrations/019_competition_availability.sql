-- Drop old general unavailability table (replaced by per-competition availability)
DROP TABLE IF EXISTS referee_availability;

-- Per-competition availability: judges who confirmed via WhatsApp
CREATE TABLE IF NOT EXISTS competition_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  referee_id      UUID        NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competition_availability_unique UNIQUE (competition_id, referee_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_availability_comp ON competition_availability(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_availability_ref  ON competition_availability(referee_id);

ALTER TABLE competition_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_comp_avail" ON competition_availability
  FOR ALL TO anon USING (false);

CREATE POLICY "auth_all_comp_avail" ON competition_availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
