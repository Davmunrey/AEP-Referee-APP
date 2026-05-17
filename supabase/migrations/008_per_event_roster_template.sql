-- 008_per_event_roster_template.sql
-- Plantilla de tarima por competición + flags por slot.
-- RLS: deny-by-default (sin políticas nuevas; acceso vía service_role + API RBAC).

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS template JSONB;

ALTER TABLE roster_assignments
  ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN competitions.template IS 'RosterSession[] per evento; NULL → preset por tipo en app';
COMMENT ON COLUMN roster_assignments.flags IS 'SlotFlags: compartido (*), intercambio (↑↓)';
