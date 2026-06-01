-- 021_referee_user_link.sql
-- Enlaza una ficha de juez (referees) con su cuenta de usuario (profiles),
-- para poder dirigirle notificaciones push (asignación a tarima).
--
-- Nullable: un juez puede no tener cuenta de usuario (p. ej. aún sin invitar).
-- Idempotente. Ejecutar en: Supabase Dashboard -> SQL Editor.

ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referees_user_id
  ON referees(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN referees.user_id IS
  'Cuenta de usuario del juez (profiles.id); NULL si no está registrado como usuario.';
