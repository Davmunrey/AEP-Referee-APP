-- 034_compensation_override_geocode.sql
-- Tres cambios ADITIVOS e IDEMPOTENTES:
--   (1) override manual del importe de desplazamiento en los claims,
--   (2) cachear las coordenadas geocodificadas del domicilio del juez,
--   (3) impedir propuestas de aprobación pendientes duplicadas por campeonato.
-- Todo es opcional: el código funciona igual con y sin esta migración aplicada
-- (sondas de columna con caché en el servidor). Como el resto del proyecto, se
-- ejecuta A MANO en: Supabase Dashboard -> SQL Editor.

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
-- en recálculos posteriores para NO volver a geocodificar. double precision para
-- ser consistente con competitions.sede_lat / sede_lng (024).
ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS domicilio_lat DOUBLE PRECISION;
ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS domicilio_lng DOUBLE PRECISION;

COMMENT ON COLUMN referees.domicilio_lat IS 'Latitud geocodificada del domicilio (caché de Nominatim).';
COMMENT ON COLUMN referees.domicilio_lng IS 'Longitud geocodificada del domicilio (caché de Nominatim).';

-- (3) Índice único parcial: como MÁXIMO una propuesta pendiente por campeonato.
-- En instalaciones modernas la columna es competition_id (creada así en 001 y
-- renombrada desde event_id en 016, que ya corre antes que esta). El estado
-- 'pendiente' es el valor del enum approval_status (001).
--
-- Antes de crear el índice se limpian posibles duplicados PREEXISTENTES: si hubiera
-- dos o más propuestas pendientes para el mismo campeonato, CREATE UNIQUE INDEX
-- fallaría. Se conserva la MÁS RECIENTE (mayor submitted_at; desempate por id) y se
-- borran las demás. El borrado es idempotente: tras la primera pasada no quedan
-- duplicados y el DELETE no afecta a ninguna fila en ejecuciones posteriores.
DELETE FROM approval_proposals a
USING approval_proposals b
WHERE a.status = 'pendiente'
  AND b.status = 'pendiente'
  AND a.competition_id = b.competition_id
  AND (
    a.submitted_at < b.submitted_at
    OR (a.submitted_at = b.submitted_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS approval_proposals_one_pending
  ON approval_proposals (competition_id)
  WHERE status = 'pendiente';
