-- 043 — Respuesta del juez a su designación y avisos dentro de la aplicación.
--
--   · designacion_respuestas — el juez confirma que va o dice que no puede,
--     por campeonato. Una fila por juez y campeonato: cambiar de idea pisa la
--     respuesta anterior.
--   · notificaciones         — la campana: avisos por usuario (una
--     convocatoria nueva para tu zona, una zona que pide sumarse, una
--     designación, un juez que no puede ir…). `clave` evita repetir el mismo
--     aviso cuando lo genera una revisión que puede correr varias veces.
--
-- RLS activada y sin políticas, como el resto (todo pasa por el servidor).
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS designacion_respuestas (
  competition_id TEXT        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  referee_id     TEXT        NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  estado         TEXT        NOT NULL CHECK (estado IN ('confirmada', 'rechazada')),
  motivo         TEXT        CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, referee_id)
);

CREATE INDEX IF NOT EXISTS designacion_respuestas_referee_idx
  ON designacion_respuestas (referee_id);

CREATE TABLE IF NOT EXISTS notificaciones (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL,
  titulo     TEXT        NOT NULL CHECK (char_length(titulo) <= 200),
  cuerpo     TEXT        CHECK (cuerpo IS NULL OR char_length(cuerpo) <= 1000),
  href       TEXT,
  clave      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  leida_at   TIMESTAMPTZ
);

-- La campana pide «las últimas de este usuario» y «cuántas sin leer».
CREATE INDEX IF NOT EXISTS notificaciones_user_idx
  ON notificaciones (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notificaciones_sin_leer_idx
  ON notificaciones (user_id)
  WHERE leida_at IS NULL;
-- El mismo aviso (misma clave) no se manda dos veces a la misma persona.
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_clave_unica
  ON notificaciones (user_id, clave)
  WHERE clave IS NOT NULL;

ALTER TABLE designacion_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['designacion_respuestas', 'notificaciones']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_sync_bump', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH STATEMENT EXECUTE FUNCTION public.bump_app_sync_version()',
      tbl || '_sync_bump',
      tbl
    );
  END LOOP;
END;
$$;
