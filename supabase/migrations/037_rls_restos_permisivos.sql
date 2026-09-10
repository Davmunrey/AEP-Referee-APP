-- 037_rls_restos_permisivos.sql
--
-- Endurecimiento RLS: quedaban políticas permisivas `USING (true)` para el rol
-- `authenticated` que las migraciones 007 y 033 no llegaron a cubrir. Con la
-- clave anónima —que es pública, va en el navegador— cualquier usuario con
-- sesión podía saltarse la API y hablar con estas tablas directamente:
--
--   • activity_log (SELECT)          el registro de actividad nombra sanciones,
--                                    cambios de rol y restablecimientos de
--                                    contraseña, con nombre y apellidos.
--   • roster_history (FOR ALL)       el historial de la tarima, además,
--                                    ESCRIBIBLE: quien quisiera podía borrar o
--                                    falsear el rastro de quién designó a quién.
--   • referee_availability (SELECT   disponibilidad por juez, también
--     + FOR ALL)                     escribible por cualquiera.
--   • app_config (SELECT)            configuración de la aplicación.
--
-- Toda la aplicación accede a estas tablas SOLO desde el servidor con
-- `service_role`, que ignora RLS: al quitar las políticas quedan cerradas como
-- el resto del esquema y no cambia ningún comportamiento. Lo único que el
-- navegador consulta con la clave anónima es `app_sync_state` (029), que
-- conserva su política de lectura.
--
-- Se mantienen a propósito las lecturas de `zones` y `regulation_rules`: son
-- datos de referencia sin nada personal (códigos de zona y el articulado de la
-- normativa), y cerrarlas no aporta nada.
--
-- Idempotente.
--
-- Dos cosas que la primera redacción daba por sentadas y no lo son:
--
--   · Que las políticas se llamen como en el repositorio. Producción se creó
--     con versiones anteriores de estas migraciones —lo mismo que dejó
--     approval_proposals con event_id en vez de competition_id—, así que un
--     DROP POLICY por nombre puede no encontrar nada y dejar la tabla abierta
--     mientras la migración informa de éxito. Un agujero que se presenta como
--     arreglado es peor que uno conocido, así que se quitan TODAS las políticas
--     de estas cuatro tablas, se llamen como se llamen.
--
--   · Que las cuatro tablas existan. Un ALTER TABLE sobre una que falte aborta
--     el fichero entero y se lleva por delante a la 038, que cierra el alta de
--     cuentas. Cada tabla se trata por separado y las ausentes se anotan en el
--     log del workflow.

DO $migracion037$
DECLARE
  tabla    TEXT;
  politica TEXT;
  ausentes TEXT[] := ARRAY[]::TEXT[];
  tocadas  INT := 0;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'activity_log', 'roster_history', 'referee_availability', 'app_config'
  ] LOOP
    IF to_regclass('public.' || quote_ident(tabla)) IS NULL THEN
      ausentes := ausentes || tabla;
      CONTINUE;
    END IF;

    FOR politica IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tabla
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', politica, tabla);
      tocadas := tocadas + 1;
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
  END LOOP;

  RAISE NOTICE 'Migración 037: % políticas retiradas.', tocadas;

  IF cardinality(ausentes) > 0 THEN
    RAISE NOTICE
      'Migración 037: estas tablas no existen en esta base y no se han tocado: %. Si deberían existir, falta alguna migración anterior.',
      array_to_string(ausentes, ', ');
  END IF;
END $migracion037$;
