-- 038_alta_sin_bandera_invited.sql
--
-- Quita `invited` de la decisión de activar una cuenta nueva.
--
-- El trigger de 011 leía `NEW.raw_user_meta_data->>'invited'`, y ese campo lo
-- escribe EL PROPIO USUARIO: se fija al registrarse (`signUp` con
-- `options.data`) o después con `updateUser({ data })`, contra la API pública y
-- con la clave anónima, que viaja en el navegador. Es decir, quien se daba de
-- alta decidía si su cuenta nacía activa.
--
-- No hacía falta para nada: el alta oficial desde «Gestión de cuentas»
-- (POST /api/v1/admin/users) crea el perfil con `activo = true` en la misma
-- petición, después de este trigger, así que un invitado de verdad nunca
-- dependió de esta rama. Solo servía de puerta.
--
-- Si alguna vez hace falta marcar una invitación en metadata, el sitio es
-- `raw_app_meta_data`, que solo se escribe con la clave de servicio.
--
-- Espejo en la aplicación: `ensureProfile` en src/lib/auth/session.ts.

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
    -- Antes: `CASE WHEN is_first OR is_invited THEN true ELSE false END`.
    CASE WHEN is_first THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Esta migración cierra la puerta hacia delante; no toca las cuentas que ya
-- entraron por ella, porque desactivar en bloque dejaría fuera también a las
-- legítimas. Para revisarlas a mano:
--
--   SELECT p.id, p.email, p.role, p.activo, u.created_at,
--          u.raw_user_meta_data->>'invited' AS invited
--     FROM public.profiles p
--     JOIN auth.users u ON u.id = p.id
--    WHERE p.activo
--      AND u.raw_user_meta_data->>'invited' IS NOT NULL
--    ORDER BY u.created_at DESC;
--
-- y desactivar las que no se reconozcan con
-- `UPDATE public.profiles SET activo = false WHERE id = '...';`
