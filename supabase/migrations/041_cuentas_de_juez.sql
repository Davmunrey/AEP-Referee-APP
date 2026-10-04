-- 041 — Cuenta propia para cada juez (portal del juez).
--
-- Un juez del censo puede tener una cuenta con el rol `juez`, enlazada a su
-- ficha por `referees.user_id` (columna de la 021, sin uso hasta ahora). Con
-- ese rol solo se entra al portal: la aplicación lo deja fuera de la gestión
-- en el servidor (`getSession` / `requireApiUser`), no solo en el menú.
--
-- La cuenta la crea la aplicación con la clave de servicio —por invitación de
-- un delegado o porque el juez la pide con el e-mail que figura en el censo—,
-- así que el trigger `handle_new_user` no cambia: el perfil nace inactivo y la
-- aplicación lo pone como `juez`/activo en la misma petición.
--
-- Aditiva e idempotente.

-- El valor `juez` del tipo `user_role` lo añade la 040, sola en su fichero.

-- Una cuenta por juez y un juez por cuenta. El índice de la 021 no era único:
-- dos fichas enlazadas a la misma cuenta harían que el portal enseñara las
-- designaciones de una u otra según el plan de la consulta. Hoy la columna está
-- vacía en todas las filas, así que crear el índice único no puede fallar.
DROP INDEX IF EXISTS idx_referees_user_id;
CREATE UNIQUE INDEX IF NOT EXISTS referees_user_id_unique
  ON referees (user_id)
  WHERE user_id IS NOT NULL;

-- El juez pide acceso escribiendo su e-mail, y se busca sin distinguir
-- mayúsculas: en el censo hay correos escritos de las dos maneras.
CREATE INDEX IF NOT EXISTS referees_email_lower_idx
  ON referees (lower(email))
  WHERE email IS NOT NULL;
