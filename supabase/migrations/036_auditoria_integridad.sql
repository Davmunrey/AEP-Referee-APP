-- 036_auditoria_integridad.sql
--
-- Correcciones salidas de la auditoría del esquema. Todo ADITIVO e IDEMPOTENTE:
-- no borra ni una fila. La aplica el workflow «Migraciones Supabase» al llegar
-- a main; también puede pegarse a mano en el editor SQL.
--
-- Nota sobre bloqueos: el workflow ejecuta cada migración en UNA transacción,
-- así que separar el ADD CONSTRAINT en NOT VALID + VALIDATE no aportaría nada
-- (el ACCESS EXCLUSIVE se retiene igual hasta el COMMIT). Con el volumen de
-- esta base —cientos de campeonatos, no millones— la validación es inmediata.

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) INTEGRIDAD · Borrar un campeonato ya no destruye sus liquidaciones
-- ─────────────────────────────────────────────────────────────────────────────
-- La clave ajena nació con ON DELETE CASCADE (024:16), de modo que eliminar un
-- campeonato se llevaba por delante todas sus liquidaciones de dietas, incluidas
-- las que ya estaban en «pagado», y sin dejar rastro en el registro de actividad.
--
-- Lo grave no era el borrado deliberado sino el automático: la importación de
-- calendario llama a `removeDuplicateCompetitions`, que elige qué copia conservar
-- mirando solo la tarima (`pickCompetitionToKeep`). La copia marcada para borrar
-- podía ser justamente la que tenía el dinero liquidado.
--
-- El código ya lo impide (deleteCompetition se niega y la ruta responde 409),
-- pero la base no debe depender de que el código acierte.
ALTER TABLE judge_compensation_claims
  DROP CONSTRAINT IF EXISTS judge_compensation_claims_competition_id_fkey;

ALTER TABLE judge_compensation_claims
  ADD CONSTRAINT judge_compensation_claims_competition_id_fkey
  FOREIGN KEY (competition_id) REFERENCES competitions(id)
  ON DELETE RESTRICT;

-- Red de seguridad independiente de la clave ajena: una liquidación aprobada o
-- pagada no se borra por ninguna vía, ni siquiera borrándola directamente.
CREATE OR REPLACE FUNCTION public.block_delete_settled_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.status IN ('aprobado', 'pagado') THEN
    RAISE EXCEPTION
      'La liquidación % (juez %, campeonato %) está en estado "%" y no se puede borrar',
      OLD.id, OLD.referee_id, OLD.competition_id, OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION public.block_delete_settled_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS judge_compensation_claims_no_delete_settled
  ON judge_compensation_claims;
CREATE TRIGGER judge_compensation_claims_no_delete_settled
  BEFORE DELETE ON judge_compensation_claims
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_settled_claim();

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) RENDIMIENTO · activity_log no tenía ningún índice
-- ─────────────────────────────────────────────────────────────────────────────
-- El panel «Actividad reciente» del inicio ordena por fecha descendente y la
-- tabla solo crece: sin índice, cada carga del panel escanea la tabla entera.
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
  ON public.activity_log (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) TIEMPO REAL · La zona de Soporte no refrescaba sola
-- ─────────────────────────────────────────────────────────────────────────────
-- La 029 sincroniza la app en vivo mediante un trigger `_sync_bump` por tabla,
-- pero las tres tablas de soporte se crearon después (035) y se quedaron fuera:
-- un ticket nuevo o un comentario no llegaban a las demás pestañas abiertas
-- hasta recargar. El bloque tolera que la 035 no esté aplicada todavía.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'support_tickets', 'support_ticket_comments', 'support_ticket_attachments'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_sync_bump', tbl);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH STATEMENT EXECUTE FUNCTION public.bump_app_sync_version()',
        tbl || '_sync_bump', tbl);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (4) SEGURIDAD · La tabla de cuarentena de la 034, por si venía sin RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- La 034 ya la crea con RLS activada, pero quien la hubiera aplicado antes de
-- esa corrección la tendría abierta con la clave anónima pública. Sin políticas
-- y con RLS: solo servidor, como el resto del esquema desde la 033.
DO $$
BEGIN
  IF to_regclass('public.approval_proposals_duplicadas_034') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.approval_proposals_duplicadas_034 ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
