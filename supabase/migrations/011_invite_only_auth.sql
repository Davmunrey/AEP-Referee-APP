-- 011_invite_only_auth.sql
-- Cuentas sin metadata invited=true quedan inactivas (no acceden al panel).
-- Alta oficial: POST /api/v1/admin/users (metadata invited).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_first BOOLEAN;
  is_invited BOOLEAN;
  display_name TEXT;
  initials TEXT;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;
  is_invited := COALESCE((NEW.raw_user_meta_data->>'invited')::boolean, false);

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
    CASE WHEN is_first THEN 'Super Admin' ELSE 'Pendiente de asignación' END,
    initials,
    CASE WHEN is_first THEN 'super_admin'::user_role ELSE 'solo_ver'::user_role END,
    NULL,
    CASE WHEN is_first OR is_invited THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
