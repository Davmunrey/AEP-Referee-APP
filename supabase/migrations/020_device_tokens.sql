-- 020_device_tokens.sql
-- Tokens APNs para notificaciones push de la app móvil nativa (iOS).
--
-- Deny-by-default, coherente con 007_rls_hardening: RLS activado, SIN políticas
-- permisivas. El servidor accede con la service_role key (bypasea RLS) y el
-- control de acceso real (un usuario solo gestiona SUS tokens) se aplica en la
-- capa de API (/api/v1/devices), que filtra por el usuario autenticado.
--
-- profiles.id es UUID (ref. auth.users). Idempotente.
-- Ejecutar en: Supabase Dashboard -> SQL Editor.

CREATE TABLE IF NOT EXISTS device_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  apns_token   TEXT        NOT NULL,
  environment  TEXT        NOT NULL DEFAULT 'production'
                 CHECK (environment IN ('sandbox', 'production')),
  device_model TEXT,
  app_version  TEXT,
  locale       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_user_token_unique UNIQUE (user_id, apns_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Sin políticas permisivas: solo la service_role (servidor) accede.
