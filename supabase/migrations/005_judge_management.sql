-- 005_judge_management.sql
-- Gestión avanzada de jueces: exámenes arbitrales e informes de desempeño.

-- Exámenes de árbitros (teórico, práctico, reglamento IPF, recertificación).
CREATE TABLE IF NOT EXISTS referee_exams (
  id                 TEXT PRIMARY KEY,
  referee_id         TEXT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  referee_name       TEXT NOT NULL,
  tipo               TEXT NOT NULL,
  nivel_objetivo     TEXT NOT NULL,
  fecha              DATE NOT NULL,
  examinador         TEXT NOT NULL,
  puntuacion         INTEGER,
  puntuacion_maxima  INTEGER NOT NULL DEFAULT 100,
  resultado          TEXT NOT NULL DEFAULT 'Pendiente',
  notas              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referee_exams_referee_idx ON referee_exams (referee_id);

-- Informes de desempeño / incidencias por juez (sandbox de informes).
CREATE TABLE IF NOT EXISTS referee_reports (
  id            TEXT PRIMARY KEY,
  referee_id    TEXT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  referee_name  TEXT NOT NULL,
  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  evento        TEXT,
  contenido     TEXT NOT NULL,
  adjunto_url   TEXT,
  autor         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referee_reports_referee_idx ON referee_reports (referee_id);

ALTER TABLE referee_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_reports ENABLE ROW LEVEL SECURITY;

-- La app accede con service_role (bypasea RLS); acceso para autenticados.
DROP POLICY IF EXISTS referee_exams_access ON referee_exams;
CREATE POLICY referee_exams_access ON referee_exams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS referee_reports_access ON referee_reports;
CREATE POLICY referee_reports_access ON referee_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
