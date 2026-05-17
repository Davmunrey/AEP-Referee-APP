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
UPDATE approval_requests SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE approval_requests SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE approval_requests SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE approval_requests SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');

UPDATE promotion_requests SET zona = 'SUR' WHERE zona IN ('AND');
UPDATE promotion_requests SET zona = 'LEV' WHERE zona IN ('VAL');
UPDATE promotion_requests SET zona = 'N1' WHERE zona IN ('GAL', 'AST', 'CYL');
UPDATE promotion_requests SET zona = 'N2' WHERE zona IN ('PVA', 'ARA');

DELETE FROM zones
WHERE code NOT IN ('N1', 'N2', 'CENTRO', 'MAD', 'CAT', 'LEV', 'SUR', 'CAN');
