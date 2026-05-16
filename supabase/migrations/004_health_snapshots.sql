-- 004_health_snapshots.sql
-- Bitácora de salud operativa: el panel registra su propio índice a lo largo
-- del tiempo para retroalimentarse (comparar el estado actual con el pasado).

CREATE TABLE IF NOT EXISTS health_snapshots (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score       INTEGER NOT NULL,
  status      TEXT NOT NULL,
  factors     JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS health_snapshots_captured_idx
  ON health_snapshots (captured_at DESC);

ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

-- La app accede con service_role (bypasea RLS); lectura para usuarios autenticados.
DROP POLICY IF EXISTS health_snapshots_select ON health_snapshots;
CREATE POLICY health_snapshots_select ON health_snapshots
  FOR SELECT TO authenticated USING (true);
