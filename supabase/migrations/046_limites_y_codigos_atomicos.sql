-- 046 — Límites de intentos compartidos y códigos de acceso atómicos.
--
-- 1. Límites de intentos en la base.
--    Los límites del login, del canje de códigos y de la petición de acceso
--    vivían solo en la memoria de cada instancia de Vercel: un arranque en frío
--    los ponía a cero y dos instancias no se veían entre sí. Esta tabla los
--    comparte. La clave llega ya resumida (SHA-256) desde el servidor, así que
--    aquí no se guardan e-mails ni IPs en claro.
--
-- 2. Contador de intentos fallidos de un código de acceso, en una sola
--    sentencia. Antes se leía `attempts`, se sumaba uno en el servidor y se
--    escribía: varias peticiones a la vez contaban como un solo fallo.
--
-- 3. Cerrar todas las sesiones de una cuenta. Canjear un código nuevo pone
--    contraseña nueva, pero quien ya estuviera dentro con la anterior seguía
--    dentro; el cambio de contraseña normal sí las cerraba.
--
-- Solo las ejecuta el servidor con la clave de servicio: se retira el permiso
-- a anon y authenticated, como en el resto de funciones de la aplicación.
--
-- Aditiva e idempotente.

-- ── 1. Límites de intentos ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key      TEXT        PRIMARY KEY CHECK (char_length(key) <= 128),
  hits     INTEGER     NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.rate_limit_hits IS
  'Contadores de intentos (login, códigos de acceso) compartidos entre instancias. Clave resumida con SHA-256.';

CREATE INDEX IF NOT EXISTS rate_limit_hits_reset_at_idx ON public.rate_limit_hits (reset_at);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;

-- Suma un intento y devuelve cuántos lleva la clave en su ventana. Si la
-- ventana ya venció, empieza otra con este intento.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_window_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  INSERT INTO public.rate_limit_hits AS r (key, hits, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.hits + 1 END,
        reset_at = CASE
          WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_seconds)
          ELSE r.reset_at
        END
  RETURNING hits INTO v_hits;

  -- Limpieza oportunista: sin ella la tabla solo crece.
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limit_hits WHERE reset_at < now() - interval '1 day';
  END IF;

  RETURN v_hits;
END;
$$;

-- Intentos que lleva la clave en su ventana vigente, sin sumar ninguno.
CREATE OR REPLACE FUNCTION public.rate_limit_peek(p_key TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT hits FROM public.rate_limit_hits WHERE key = p_key AND reset_at > now()),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_clear(p_key TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.rate_limit_hits WHERE key = p_key;
$$;

-- ── 2. Intento fallido de un código de acceso ──────────────────────────────

-- Suma el fallo en una sola sentencia y anula el código al llegar al máximo.
-- Devuelve los intentos acumulados, o 0 si el código ya no existía.
CREATE OR REPLACE FUNCTION public.judge_code_fail(p_referee_id TEXT, p_max INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE public.judge_access_codes
     SET attempts = attempts + 1
   WHERE referee_id = p_referee_id
  RETURNING attempts INTO v_attempts;

  IF v_attempts IS NULL THEN
    RETURN 0;
  END IF;

  IF v_attempts >= p_max THEN
    DELETE FROM public.judge_access_codes WHERE referee_id = p_referee_id;
  END IF;

  RETURN v_attempts;
END;
$$;

-- ── 3. Cerrar todas las sesiones de una cuenta ─────────────────────────────

-- SECURITY DEFINER porque las tablas de sesiones están en el esquema `auth`,
-- que la API no expone. Borrar la sesión invalida su token de refresco; el
-- token de acceso que ya tenga el navegador caduca solo, en menos de una hora.
CREATE OR REPLACE FUNCTION public.cerrar_sesiones_de_usuario(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_peek(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_clear(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.judge_code_fail(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cerrar_sesiones_de_usuario(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_peek(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_clear(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.judge_code_fail(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cerrar_sesiones_de_usuario(UUID) TO service_role;
