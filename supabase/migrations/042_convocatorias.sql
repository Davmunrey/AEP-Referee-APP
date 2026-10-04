-- 042 — Convocatorias: los jueces se apuntan, sesión a sesión, a un campeonato.
--
-- Un delegado lanza la convocatoria de un campeonato (qué sesiones, hasta qué
-- día) y los jueces de las zonas convocadas se apuntan desde su portal a cada
-- sesión a la que pueden ir. El delegado monta luego la tarima con los
-- inscritos: la convocatoria no asigna a nadie, solo recoge quién se ofrece.
--
-- Tres tablas:
--   · convocatorias               — una viva por campeonato (abierta o cerrada).
--   · convocatoria_zonas          — a qué zonas llega. La del campeonato entra
--     aceptada al lanzar; otra zona puede quedar pendiente de que su delegado
--     la acepte, y la convocatoria solo la ven sus jueces una vez aceptada.
--   · convocatoria_inscripciones  — juez × sesión. Retirarse es borrar la fila.
--
-- RLS activada y sin políticas: como el resto de tablas desde la 033, todo
-- pasa por el servidor con la clave de servicio, que es quien comprueba que un
-- juez solo se apunta en su nombre y a lo que su zona tiene abierto.
--
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS convocatorias (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  competition_id  TEXT        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  estado          TEXT        NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
  -- Claves de sesión de la plantilla (`S1`, `S2`…) incluidas.
  sesiones        TEXT[]      NOT NULL,
  -- Último día para apuntarse (día natural español, inclusive).
  cierra_el       DATE        NOT NULL,
  mensaje         TEXT,
  -- Días antes del cierre en los que, si quedan sesiones sin inscritos
  -- suficientes, se pide a las demás zonas que se sumen. NULL = no.
  ampliar_dias_antes INT      CHECK (ampliar_dias_antes IS NULL OR ampliar_dias_antes BETWEEN 1 AND 60),
  ampliada_at     TIMESTAMPTZ,
  creada_por      TEXT,
  creada_por_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT convocatorias_sesiones_no_vacias CHECK (cardinality(sesiones) > 0)
);

-- Una convocatoria viva por campeonato: dos abiertas a la vez repartirían las
-- inscripciones entre ellas y la tarima solo vería una. Una cancelada no
-- cuenta, así que se puede volver a lanzar.
CREATE UNIQUE INDEX IF NOT EXISTS convocatorias_una_viva_por_campeonato
  ON convocatorias (competition_id)
  WHERE estado <> 'cancelada';

CREATE INDEX IF NOT EXISTS convocatorias_estado_cierre_idx
  ON convocatorias (estado, cierra_el);

CREATE TABLE IF NOT EXISTS convocatoria_zonas (
  convocatoria_id TEXT        NOT NULL REFERENCES convocatorias(id) ON DELETE CASCADE,
  zona            TEXT        NOT NULL,
  estado          TEXT        NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('aceptada', 'pendiente', 'rechazada')),
  -- `propia`: la zona del campeonato. `delegado`: la añadió quien lanzó la
  -- convocatoria. `automatica`: la ampliación por falta de inscritos.
  origen          TEXT        NOT NULL
                  CHECK (origen IN ('propia', 'delegado', 'automatica')),
  solicitada_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_por    TEXT,
  resuelta_at     TIMESTAMPTZ,
  PRIMARY KEY (convocatoria_id, zona)
);

-- «¿Qué tiene abierto esta zona?» es la consulta del portal de cada juez.
CREATE INDEX IF NOT EXISTS convocatoria_zonas_zona_idx
  ON convocatoria_zonas (zona, estado);

CREATE TABLE IF NOT EXISTS convocatoria_inscripciones (
  convocatoria_id TEXT        NOT NULL REFERENCES convocatorias(id) ON DELETE CASCADE,
  referee_id      TEXT        NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  sesion          TEXT        NOT NULL,
  nota            TEXT        CHECK (nota IS NULL OR char_length(nota) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Apuntarse dos veces a la misma sesión (dos pestañas, doble toque) choca
  -- aquí y no duplica nada.
  PRIMARY KEY (convocatoria_id, referee_id, sesion)
);

CREATE INDEX IF NOT EXISTS convocatoria_inscripciones_referee_idx
  ON convocatoria_inscripciones (referee_id);

ALTER TABLE convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocatoria_zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocatoria_inscripciones ENABLE ROW LEVEL SECURITY;

-- Tiempo real (029): una inscripción nueva aparece en la tarima del delegado
-- sin recargar.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['convocatorias', 'convocatoria_zonas', 'convocatoria_inscripciones']
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
