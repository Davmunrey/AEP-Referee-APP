-- AEP Tarima — migración 003: Supabase Auth nativo + limpieza de warnings
--
-- Modelo de seguridad:
--   La aplicación accede a la base de datos SOLO con la service_role key
--   (server-side, vía API REST propia). La service_role IGNORA RLS.
--   Por tanto las tablas mantienen RLS ACTIVADO pero SIN políticas
--   permisivas: cualquier acceso directo con anon/authenticated queda
--   denegado por defecto. Es la postura más segura y elimina los avisos.
--
-- Qué corrige (Security Advisor de Supabase):
--   • function_search_path_mutable  → elimina current_clerk_id
--   • rls_policy_always_true         → elimina políticas WITH CHECK (true)
--   • anon/authenticated_security_definer_function_executable
--                                    → elimina current_profile y rls_auto_enable
--
-- Ejecutar en: Supabase Dashboard → SQL Editor. Idempotente.

-- ── 1. Limpiar perfiles con IDs no-UUID (formato Clerk user_xxx) ─────
DELETE FROM profiles
WHERE id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- ── 2. Eliminar funciones SECURITY DEFINER y de Clerk (+ políticas) ──
--    CASCADE elimina cualquier política RLS que dependa de ellas.
DROP FUNCTION IF EXISTS public.current_clerk_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_profile() CASCADE;
DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;

-- ── 3. Eliminar el resto de políticas permisivas ─────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ── 4. RLS activado en todas las tablas (deny-by-default) ────────────
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE referees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config          ENABLE ROW LEVEL SECURITY;

-- ── 5. Revertir profiles.id a UUID con FK a auth.users ───────────────
ALTER TABLE profiles ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 6. Perfil propio legible por el usuario autenticado ──────────────
--    Única política necesaria: sin funciones, sin warnings.
DROP POLICY IF EXISTS profiles_select_self ON profiles;
CREATE POLICY profiles_select_self ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- ── 7. Auto-creación de perfil al registrarse ────────────────────────
--    El primer usuario registrado obtiene rol 'nacional' (admin).
--    El resto obtiene 'lectura'; el nacional los promociona en /admin/users.
--    search_path fijo → sin warning function_search_path_mutable.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_first BOOLEAN;
  display_name TEXT;
  initials TEXT;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;

  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  initials := UPPER(LEFT(regexp_replace(display_name, '[^a-zA-Z]', '', 'g'), 2));
  IF initials = '' THEN
    initials := UPPER(LEFT(NEW.email, 2));
  END IF;

  INSERT INTO public.profiles (id, email, nombre, rol_label, iniciales, role, zona, activo)
  VALUES (
    NEW.id,
    NEW.email,
    display_name,
    CASE WHEN is_first THEN 'AEP Nacional' ELSE 'Pendiente de asignación' END,
    initials,
    CASE WHEN is_first THEN 'nacional'::user_role ELSE 'lectura'::user_role END,
    NULL,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Solo el propietario ejecuta el trigger; revocar acceso público.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
