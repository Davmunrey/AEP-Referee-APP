-- 022_approval_submitter_id.sql
-- Guarda el UUID de quién presenta y quién revisa una propuesta de tarima,
-- además del nombre ya existente (submitted_by / reviewed_by, que se mantienen).
-- Así se puede notificar por push al remitente cuando su propuesta se resuelve.
--
-- Nullable + idempotente. Ejecutar en: Supabase Dashboard -> SQL Editor.

ALTER TABLE approval_proposals
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_id  UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_approval_proposals_submitter
  ON approval_proposals(submitted_by_id) WHERE submitted_by_id IS NOT NULL;

COMMENT ON COLUMN approval_proposals.submitted_by_id IS 'UUID (profiles.id) del remitente de la propuesta.';
COMMENT ON COLUMN approval_proposals.reviewed_by_id  IS 'UUID (profiles.id) del revisor de la propuesta.';
