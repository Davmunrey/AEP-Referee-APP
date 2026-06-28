-- Varios clubes organizadores y e-mails múltiples por campeonato

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS compensation_clubs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN competitions.compensation_clubs IS
  'Array JSON [{ "name": "Club X", "emails": ["a@b.com"] }] — varios organizadores.';
