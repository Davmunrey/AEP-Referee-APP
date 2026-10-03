-- 039_indices_claves_ajenas.sql
--
-- Índices sobre claves ajenas que no tenían ninguno. Postgres NO indexa por su
-- cuenta la columna que referencia: sin índice, cada borrado en la tabla
-- referenciada recorre entera la tabla que la referencia para comprobar la
-- restricción (o para propagar el ON DELETE), y cada consulta por esa columna
-- es un recorrido secuencial.
--
--   · promotion_requests.referee_id  — se consulta al pedir un ascenso
--     («¿ya hay uno pendiente para este juez?») y al borrar un juez.
--   · support_ticket_attachments.comment_id — ON DELETE CASCADE desde los
--     comentarios.
--   · referee_sanctions.impuesta_por_id — referencia a profiles: borrar una
--     cuenta recorría todas las sanciones.
--   · referees.active_sanction_id — referencia a referee_sanctions.
--
-- Hallado cruzando las claves ajenas de todas las migraciones con los índices
-- declarados. Todas las tablas son pequeñas hoy, así que el CREATE INDEX dentro
-- de la transacción del workflow bloquea escrituras solo un instante.
--
-- Aditiva e idempotente.

CREATE INDEX IF NOT EXISTS promotion_requests_referee_idx
  ON promotion_requests (referee_id);

CREATE INDEX IF NOT EXISTS support_ticket_attachments_comment_idx
  ON support_ticket_attachments (comment_id)
  WHERE comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referee_sanctions_impuesta_por_idx
  ON referee_sanctions (impuesta_por_id)
  WHERE impuesta_por_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referees_active_sanction_idx
  ON referees (active_sanction_id)
  WHERE active_sanction_id IS NOT NULL;
