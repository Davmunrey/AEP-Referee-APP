-- 006_roles_rebrand.sql
-- Renombra los roles de usuario y añade el rol Delegado de Jueces.
-- ALTER TYPE ... RENAME VALUE no requiere migración de datos: las filas
-- existentes en `profiles.role` se actualizan automáticamente.
--
--   nacional -> super_admin
--   regional -> delegado_zona
--   lectura  -> solo_ver
--   (nuevo)  -> delegado_jueces

ALTER TYPE user_role RENAME VALUE 'nacional' TO 'super_admin';
ALTER TYPE user_role RENAME VALUE 'regional' TO 'delegado_zona';
ALTER TYPE user_role RENAME VALUE 'lectura'  TO 'solo_ver';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delegado_jueces';

-- Trigger de creación de perfil: usa los nuevos valores de enum.
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
    CASE WHEN is_first THEN 'Super Admin' ELSE 'Pendiente de asignación' END,
    initials,
    CASE WHEN is_first THEN 'super_admin'::user_role ELSE 'solo_ver'::user_role END,
    NULL,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
