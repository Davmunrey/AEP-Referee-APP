-- 044 — El tiempo real solo se dispara cuando de verdad cambia algo.
--
-- La 042 y la 043 colgaron de `bump_app_sync_version` (029) tres tablas que
-- puede escribir un JUEZ desde su portal, con disparadores FOR EACH STATEMENT:
-- saltan aunque la sentencia no toque ninguna fila. Un juez que repitiera
-- «marcar avisos como leídos» o se apuntara dos veces a la misma sesión
-- (inserción ignorada) hacía refrescar todas las pantallas abiertas de la
-- aplicación cada pocos segundos.
--
--   · notificaciones: fuera. Son de cada usuario; no hay nada que los demás
--     tengan que ver al momento.
--   · convocatoria_inscripciones y designacion_respuestas: FOR EACH ROW, así
--     que una sentencia que no cambia filas no avisa a nadie.
--
-- Aditiva e idempotente.

DROP TRIGGER IF EXISTS notificaciones_sync_bump ON public.notificaciones;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['convocatoria_inscripciones', 'designacion_respuestas']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_sync_bump', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.bump_app_sync_version()',
      tbl || '_sync_bump',
      tbl
    );
  END LOOP;
END;
$$;
