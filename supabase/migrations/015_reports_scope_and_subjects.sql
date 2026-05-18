-- 015_reports_scope_and_subjects.sql
-- Informes por juez o competición, con scoping por zona.

ALTER TABLE referee_reports
  ALTER COLUMN referee_id DROP NOT NULL,
  ALTER COLUMN referee_name DROP NOT NULL;

ALTER TABLE referee_reports
  ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'juez',
  ADD COLUMN IF NOT EXISTS competition_id TEXT REFERENCES competitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competition_name TEXT,
  ADD COLUMN IF NOT EXISTS zona TEXT;

UPDATE referee_reports rr
SET
  subject_type = COALESCE(rr.subject_type, 'juez'),
  zona = COALESCE(rr.zona, r.zona)
FROM referees r
WHERE rr.referee_id = r.id;

CREATE INDEX IF NOT EXISTS referee_reports_subject_idx
  ON referee_reports (subject_type);

CREATE INDEX IF NOT EXISTS referee_reports_competition_idx
  ON referee_reports (competition_id);

CREATE INDEX IF NOT EXISTS referee_reports_zone_idx
  ON referee_reports (zona);
