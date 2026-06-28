-- Montaje ordenador + rol en líneas de compensación; distance_source osm

ALTER TABLE judge_compensation_claims
  ADD COLUMN IF NOT EXISTS is_computer_setup BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS computer_setup_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE judge_compensation_duty_lines
  ADD COLUMN IF NOT EXISTS role_key TEXT,
  ADD COLUMN IF NOT EXISTS role_label TEXT;

ALTER TABLE judge_compensation_claims
  DROP CONSTRAINT IF EXISTS judge_compensation_claims_distance_source_check;

ALTER TABLE judge_compensation_claims
  ADD CONSTRAINT judge_compensation_claims_distance_source_check
  CHECK (distance_source IS NULL OR distance_source IN ('google_maps', 'manual', 'osm'));
