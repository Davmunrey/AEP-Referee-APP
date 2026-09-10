-- Deja el esquema con la forma que tiene la base de PRODUCCIÓN, que no es la
-- que sale de aplicar este repositorio desde la 001.
--
-- Producción se creó con versiones anteriores de estas migraciones y arrastra
-- esa historia. Aplicar las pendientes sobre un esquema recién construido a
-- partir del repositorio demuestra que el SQL compila, pero no que vaya a
-- funcionar allí: la 034 pasaba esa prueba y murió contra producción con
-- «column a.competition_id does not exist».
--
-- Cada diferencia de aquí está CONFIRMADA por una ejecución real del workflow
-- «Migraciones Supabase», no supuesta:
--
--   · approval_proposals conserva event_id / event_name. El RENAME de la 016
--     nunca corrió allí. Lo dijo el error de la 034 el 2026-09-10.
--
-- roster_history se deja como está: la aplicación sondea también ese nombre
-- (hasHistoryCompetitionColumn), pero no hay ninguna ejecución que confirme en
-- qué forma está, y este fichero solo recoge lo comprobado.
--
-- Que referee_availability no exista en producción NO es deriva: la 019 la
-- borra a propósito. El aviso de la 037 que lo dijo describe el esquema normal,
-- no una migración que falte.
--
-- Cuando aparezca una diferencia nueva, se añade aquí y la reproducción pasa a
-- cubrirla.

DO $deriva$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_proposals'
      AND column_name = 'competition_id'
  ) THEN
    ALTER TABLE approval_proposals RENAME COLUMN competition_id TO event_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_proposals'
      AND column_name = 'competition_name'
  ) THEN
    ALTER TABLE approval_proposals RENAME COLUMN competition_name TO event_name;
  END IF;
END $deriva$;
