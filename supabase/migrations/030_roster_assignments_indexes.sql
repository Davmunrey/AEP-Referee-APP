-- 030_roster_assignments_indexes.sql
-- Acelera consultas por campeonato y por juez en roster_assignments.

CREATE INDEX IF NOT EXISTS roster_assignments_competition_id_idx
  ON roster_assignments(competition_id);

CREATE INDEX IF NOT EXISTS roster_assignments_referee_id_idx
  ON roster_assignments(referee_id);

-- Filtros frecuentes en el directorio de jueces.
CREATE INDEX IF NOT EXISTS referees_nivel_idx ON referees(nivel);
CREATE INDEX IF NOT EXISTS referees_estado_idx ON referees(estado);
