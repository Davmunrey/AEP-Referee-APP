-- Sanciones disciplinarias a jueces (duración, historial, aviso delegado zona).

CREATE TYPE sanction_status AS ENUM ('activa', 'cumplida', 'revocada');

CREATE TABLE IF NOT EXISTS referee_sanctions (
  id TEXT PRIMARY KEY,
  referee_id TEXT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  referee_name TEXT NOT NULL,
  zona TEXT NOT NULL REFERENCES zones(code),
  motivo TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  status sanction_status NOT NULL DEFAULT 'activa',
  impuesta_por_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  impuesta_por_nombre TEXT NOT NULL,
  revocada_por_nombre TEXT,
  revocada_at TIMESTAMPTZ,
  notas TEXT,
  delegate_notify JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referee_sanctions_dates CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS referee_sanctions_referee_idx ON referee_sanctions (referee_id);
CREATE INDEX IF NOT EXISTS referee_sanctions_zona_idx ON referee_sanctions (zona);
CREATE INDEX IF NOT EXISTS referee_sanctions_status_idx ON referee_sanctions (status);
CREATE INDEX IF NOT EXISTS referee_sanctions_fin_idx ON referee_sanctions (fecha_fin)
  WHERE status = 'activa';

ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS active_sanction_id TEXT REFERENCES referee_sanctions(id) ON DELETE SET NULL;

ALTER TABLE referee_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referee_sanctions_access ON referee_sanctions;
CREATE POLICY referee_sanctions_access ON referee_sanctions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
