-- 007_rls_hardening.sql
-- Endurecimiento de RLS (defensa en profundidad).
--
-- Contexto: la aplicación accede a la base de datos SOLO con la service_role
-- key (server-side), que IGNORA RLS — el control de acceso real (RBAC) se
-- aplica en la capa de API. La migración 003 dejó todas las tablas en
-- "deny-by-default" (RLS activado, sin políticas permisivas).
--
-- Problema corregido aquí:
--   Las migraciones 004 y 005 reintrodujeron políticas permisivas que
--   exponen datos a CUALQUIER cliente plano `authenticated` (token de
--   usuario, no service_role):
--     • 004 health_snapshots_select  → FOR SELECT USING (true)
--     • 005 referee_exams_access     → FOR ALL  USING (true) WITH CHECK (true)
--     • 005 referee_reports_access   → FOR ALL  USING (true) WITH CHECK (true)
--   `referee_exams` y `referee_reports` contienen datos personales de jueces
--   (puntuaciones, informes de desempeño, incidencias). Una política
--   `FOR ALL ... WITH CHECK (true)` permitiría además que un usuario
--   autenticado los modifique o borre directamente saltándose la API.
--
-- Estrategia: eliminar las políticas permisivas. Sin políticas, RLS deniega
-- todo acceso de anon/authenticated; la service_role sigue funcionando
-- (bypasea RLS). Esto restaura el modelo deny-by-default de la migración 003.
--
-- Idempotente. Ejecutar en: Supabase Dashboard -> SQL Editor.

-- ── health_snapshots ────────────────────────────────────────────────
-- Bitácora interna de salud; no debe ser legible por clientes planos.
DROP POLICY IF EXISTS health_snapshots_select ON health_snapshots;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

-- ── referee_exams ───────────────────────────────────────────────────
-- Exámenes arbitrales (datos personales). Sin acceso para clientes planos.
DROP POLICY IF EXISTS referee_exams_access ON referee_exams;
ALTER TABLE referee_exams ENABLE ROW LEVEL SECURITY;

-- ── referee_reports ─────────────────────────────────────────────────
-- Informes de desempeño / incidencias (datos personales sensibles).
DROP POLICY IF EXISTS referee_reports_access ON referee_reports;
ALTER TABLE referee_reports ENABLE ROW LEVEL SECURITY;

-- ── Nota sobre profiles ─────────────────────────────────────────────
-- La migración 003 dejó `profiles_select_self` (cada usuario ve solo su
-- propia fila): es correcto y se mantiene sin cambios.
--
-- Resultado: todas las tablas de datos quedan en deny-by-default para
-- anon/authenticated. El único acceso es vía service_role (capa de API),
-- donde el RBAC por rol/zona se aplica explícitamente.
