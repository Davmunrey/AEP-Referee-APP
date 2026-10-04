-- 045 — Códigos de acceso de los jueces al portal.
--
-- La aplicación no envía correos (no hay SMTP propio y el de Supabase solo
-- entrega a los miembros del proyecto). El delegado genera un código para
-- cada juez y se lo pasa por su cuenta; el juez entra con su e-mail del censo
-- y el código, y crea su contraseña.
--
--   · Uno vivo por juez (clave primaria = ficha): generar otro sustituye al
--     anterior.
--   · Se guarda el resumen (SHA-256), nunca el código: quien lea la tabla no
--     puede entrar como nadie.
--   · Caduca (`expires_at`) y se anula tras varios intentos fallidos
--     (`attempts`). Al usarse se borra.
--
-- RLS activada sin políticas: solo la toca el servidor con la clave de
-- servicio, como el resto de tablas de la aplicación.
--
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS public.judge_access_codes (
  referee_id TEXT        PRIMARY KEY REFERENCES public.referees(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.judge_access_codes ENABLE ROW LEVEL SECURITY;
