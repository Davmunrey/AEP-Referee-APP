-- Zonas geográficas oficiales AEP 2026 (§4.1 Guía). Reemplaza códigos CCAA históricos.

INSERT INTO zones (code, name) VALUES
  ('N1', 'Zona norte 1'),
  ('N2', 'Zona norte 2'),
  ('CENTRO', 'Zona centro'),
  ('MAD', 'Zona Madrid'),
  ('CAT', 'Zona Cataluña'),
  ('LEV', 'Zona levante e islas'),
  ('SUR', 'Zona sur'),
  ('CAN', 'Zona Canarias')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Perfiles
UPDATE profiles SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE profiles SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE profiles SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE profiles SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');
UPDATE profiles SET zona = 'CENTRO' WHERE zona IN ('Centro', 'CENTRO');
UPDATE profiles SET zona = 'N1' WHERE zona IN ('Norte', 'NORTE');

-- Jueces
UPDATE referees SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE referees SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE referees SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE referees SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');

-- Campeonatos
UPDATE competitions SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE competitions SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE competitions SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE competitions SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');

-- Aprobaciones y ascensos (texto libre con FK implícita vía app)
--
-- La tabla de aprobaciones se llamó `approval_requests` en la base sobre la que
-- corrió esta migración, y `approval_proposals` en la 001 tal y como está hoy
-- en el repositorio. Escrito a pelo, este bloque hace que reproducir las
-- migraciones desde cero muera aquí, que es justo la comprobación que habría
-- cazado el fallo de la 034 antes de llegar a producción. Se usa el nombre que
-- exista y, si no existe ninguno, no se toca nada.
DO $migracion009$
DECLARE
  tabla TEXT := COALESCE(
    to_regclass('public.approval_requests')::TEXT,
    to_regclass('public.approval_proposals')::TEXT
  );
BEGIN
  IF tabla IS NULL THEN
    RAISE NOTICE 'Migración 009: no hay tabla de aprobaciones que remapear.';
    RETURN;
  END IF;
  EXECUTE format('UPDATE %s SET zona = ''SUR'' WHERE zona IN (''AND'')', tabla);
  EXECUTE format('UPDATE %s SET zona = ''LEV'' WHERE zona IN (''VAL'')', tabla);
  EXECUTE format('UPDATE %s SET zona = ''N1'' WHERE zona IN (''GAL'', ''AST'', ''CYL'')', tabla);
  EXECUTE format('UPDATE %s SET zona = ''N2'' WHERE zona IN (''PVA'', ''ARA'')', tabla);
END $migracion009$;

UPDATE promotion_requests SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE promotion_requests SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE promotion_requests SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE promotion_requests SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');

DELETE FROM zones
WHERE code NOT IN ('N1', 'N2', 'CENTRO', 'MAD', 'CAT', 'LEV', 'SUR', 'CAN');
