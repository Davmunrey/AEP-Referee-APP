-- 029_app_sync_realtime.sql
-- Versión global para sincronización en tiempo real (Supabase Realtime).
-- Los triggers incrementan `version` en cada mutación relevante; el cliente
-- escucha cambios en `app_sync_state` y refresca la UI.

CREATE TABLE IF NOT EXISTS app_sync_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_sync_state (id, version)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_sync_state_select ON app_sync_state;
CREATE POLICY app_sync_state_select ON app_sync_state
  FOR SELECT TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON app_sync_state FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.bump_app_sync_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE app_sync_state
  SET version = version + 1,
      updated_at = now()
  WHERE id = 1;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_app_sync_version() FROM PUBLIC, anon, authenticated;

-- Tablas operativas que deben propagar cambios a todos los clientes conectados.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'competitions',
    'roster_assignments',
    'approval_proposals',
    'promotion_requests',
    'referees',
    'referee_sanctions',
    'referee_exams',
    'referee_reports',
    'judge_compensation_claims',
    'judge_compensation_duty_lines',
    'competition_availability',
    'activity_log',
    'profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_sync_bump ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I_sync_bump
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH STATEMENT
       EXECUTE FUNCTION public.bump_app_sync_version()',
      tbl,
      tbl
    );
  END LOOP;
END;
$$;

-- Realtime: el cliente autenticado solo necesita SELECT en app_sync_state.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_sync_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_sync_state;
  END IF;
END;
$$;
