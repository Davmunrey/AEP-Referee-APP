-- Soporte para asignaciones cross-zona en tarima.
-- cross_zone = true indica que el juez fue llamado de fuera de la zona del campeonato.

ALTER TABLE roster_assignments
  ADD COLUMN IF NOT EXISTS cross_zone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cross_zone_reason TEXT;

COMMENT ON COLUMN roster_assignments.cross_zone IS 'Juez asignado desde otra zona geográfica';
COMMENT ON COLUMN roster_assignments.cross_zone_reason IS 'Motivo por el que se solicitó juez de fuera de zona';
