-- Rol responsable financiero de jueces + metadatos de recibo de compensación

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'responsable_financiero_jueces';

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS compensation_organizer TEXT
    CHECK (compensation_organizer IS NULL OR compensation_organizer IN ('club', 'aep')),
  ADD COLUMN IF NOT EXISTS compensation_club_name TEXT,
  ADD COLUMN IF NOT EXISTS compensation_club_email TEXT,
  ADD COLUMN IF NOT EXISTS compensation_volunteer BOOLEAN NOT NULL DEFAULT false;
