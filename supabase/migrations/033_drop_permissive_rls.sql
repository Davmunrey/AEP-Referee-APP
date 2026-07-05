-- Endurecimiento RLS: elimina las dos políticas permisivas `USING (true)` /
-- `WITH CHECK (true)` para el rol `authenticated`, que dejaban `referee_sanctions`
-- (datos disciplinarios) y `competition_availability` abiertas a lectura/escritura
-- de CUALQUIER usuario autenticado a través de la clave anónima pública.
--
-- Toda la app accede a estas tablas SOLO desde el servidor con `service_role`
-- (que ignora RLS), así que al quitar las políticas las tablas quedan bloqueadas
-- igual que el resto del esquema: solo servidor. No afecta a la funcionalidad.

DROP POLICY IF EXISTS referee_sanctions_access ON public.referee_sanctions;
DROP POLICY IF EXISTS auth_all_comp_avail ON public.competition_availability;
