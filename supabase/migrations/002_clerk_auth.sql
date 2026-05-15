-- Clerk como proveedor de auth (IDs tipo user_xxx en profiles)
-- Ejecutar tras activar Clerk en Supabase Dashboard → Auth → Third-party → Clerk

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles ALTER COLUMN id TYPE TEXT USING id::text;

CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt()->>'sub', '');
$$;

CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles
  WHERE id = public.current_clerk_id() AND activo = true;
$$;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT TO authenticated
  USING (
    id = public.current_clerk_id()
    OR (SELECT role FROM public.current_profile()) = 'nacional'
  );
