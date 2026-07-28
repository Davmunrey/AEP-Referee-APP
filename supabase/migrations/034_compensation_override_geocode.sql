-- 034_compensation_override_geocode.sql
-- Tres cambios ADITIVOS e IDEMPOTENTES:
--   (1) override manual del importe de desplazamiento en los claims,
--   (2) cachear las coordenadas geocodificadas del domicilio del juez,
--   (3) impedir propuestas de aprobación pendientes duplicadas por campeonato.
-- Todo es opcional: el código funciona igual con y sin esta migración aplicada
-- (sondas de columna con caché en el servidor). La aplica el workflow
-- «Migraciones Supabase» al llegar a main; también puede pegarse a mano en el
-- editor SQL de Supabase, porque es idempotente.

-- (1) Override del importe de viaje. Cuando el revisor fija un importe manual y
-- lo aprueba (travel_approved = true), calculate.ts lo prioriza sobre el baremo
-- por km. NUMERIC nullable: sin override, el cálculo sigue el baremo estándar.
-- NOTA: la tabla real es judge_compensation_claims (creada en 024); el código la
-- referencia siempre con ese nombre.
ALTER TABLE judge_compensation_claims
  ADD COLUMN IF NOT EXISTS travel_amount_override NUMERIC;

COMMENT ON COLUMN judge_compensation_claims.travel_amount_override IS
  'Importe manual de desplazamiento (€) que prevalece sobre el baremo por km cuando travel_approved = true.';

-- (2) Coordenadas geocodificadas del domicilio del juez. Se rellenan la primera
-- vez que se calcula la distancia (Nominatim, throttle ~1 req/s) y se reutilizan
-- en recálculos posteriores para NO volver a geocodificar.
-- OJO: la 024 (líneas 5-6) YA las crea, con este mismo tipo. Esto es un no-op en
-- cualquier base que la tenga aplicada; se conserva como red por si alguna la
-- tuviera a medias, que para eso es ADD COLUMN IF NOT EXISTS.
ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS domicilio_lat DOUBLE PRECISION;
ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS domicilio_lng DOUBLE PRECISION;

COMMENT ON COLUMN referees.domicilio_lat IS 'Latitud geocodificada del domicilio (caché de Nominatim).';
COMMENT ON COLUMN referees.domicilio_lng IS 'Longitud geocodificada del domicilio (caché de Nominatim).';

-- (3) Índice único parcial: como MÁXIMO una propuesta pendiente por campeonato.
-- La columna se llama competition_id porque así nace en 001:88; el RENAME de la
-- 016 va guardado por un IF EXISTS sobre 'event_id' que en este repo nunca se
-- cumple, así que aquella migración solo tocó índices. El estado 'pendiente' es
-- el valor del enum approval_status (001).
--
-- Antes de crear el índice hay que resolver duplicados PREEXISTENTES: si hubiera
-- dos o más propuestas pendientes para el mismo campeonato, CREATE UNIQUE INDEX
-- fallaría. Se conserva la MÁS RECIENTE (mayor submitted_at; desempate por id).
--
-- Las que sobran NO se borran sin más: se archivan antes en una tabla de
-- cuarentena. Esta migración la aplica un workflow desatendido, y un DELETE a
-- secas sobre propuestas de aprobación reales sería irreversible y además
-- invisible: nadie sabría qué desapareció ni podría devolverlo. Guardadas como
-- jsonb se conserva la fila entera sea cual sea el esquema del momento, y
-- recuperar una es un INSERT desde el JSON.
CREATE TABLE IF NOT EXISTS approval_proposals_duplicadas_034 (
  archivada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  fila         JSONB       NOT NULL
);

COMMENT ON TABLE approval_proposals_duplicadas_034 IS
  'Propuestas pendientes duplicadas apartadas por la migración 034 al crear el índice único. Conservadas para poder revisarlas o restaurarlas; se puede vaciar cuando se haya comprobado que no hacían falta.';

-- Sin políticas y con RLS activada: solo servidor, como el resto del esquema
-- desde la 033. Sin esta línea la tabla nacería con los privilegios por defecto
-- de Supabase para anon/authenticated y quedaría legible Y escribible con la
-- clave anónima pública — y guarda filas completas de propuestas de aprobación.
ALTER TABLE approval_proposals_duplicadas_034 ENABLE ROW LEVEL SECURITY;

-- Idempotente: tras la primera pasada no quedan duplicados, así que el DELETE no
-- afecta a ninguna fila y no se archiva nada nuevo.
WITH descartadas AS (
  DELETE FROM approval_proposals a
  USING approval_proposals b
  WHERE a.status = 'pendiente'
    AND b.status = 'pendiente'
    AND a.competition_id = b.competition_id
    AND (
      a.submitted_at < b.submitted_at
      OR (a.submitted_at = b.submitted_at AND a.id < b.id)
    )
  RETURNING a.*
)
INSERT INTO approval_proposals_duplicadas_034 (fila)
SELECT to_jsonb(descartadas) FROM descartadas;

-- Deja constancia en el log del workflow de cuántas se apartaron.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM approval_proposals_duplicadas_034;
  IF n > 0 THEN
    RAISE NOTICE 'Migración 034: % propuestas pendientes duplicadas archivadas en approval_proposals_duplicadas_034 (revisar antes de vaciar).', n;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS approval_proposals_one_pending
  ON approval_proposals (competition_id)
  WHERE status = 'pendiente';
