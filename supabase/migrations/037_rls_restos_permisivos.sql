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

DROP POLICY IF EXISTS activity_select ON public.activity_log;
DROP POLICY IF EXISTS history_access ON public.roster_history;
DROP POLICY IF EXISTS auth_read_availability ON public.referee_availability;
DROP POLICY IF EXISTS auth_write_availability ON public.referee_availability;
DROP POLICY IF EXISTS app_config_select ON public.app_config;

-- RLS sigue activada en las cuatro (001/018); sin políticas, deny-by-default.
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
