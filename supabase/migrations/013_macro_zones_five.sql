-- Cinco zonas operativas del Excel «Control jueces» (reemplaza 8 subdivisiones geográficas).

INSERT INTO zones (code, name) VALUES
  ('NOROESTE', '1- NOROESTE'),
  ('CENTRO', '2- CENTRO'),
  ('MEDITERRANEO', '3- MEDITERRANEO'),
  ('ANDALUCIA', '4- ANDALUCIA'),
  ('CANARIAS', '5- CANARIAS')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Jueces
UPDATE referees SET zona = 'NOROESTE' WHERE zona IN ('N1', 'N2', 'GAL', 'AST', 'CYL', 'PVA', 'ARA', 'Norte', 'NORTE');
UPDATE referees SET zona = 'CENTRO' WHERE zona IN ('MAD', 'Centro');
UPDATE referees SET zona = 'MEDITERRANEO' WHERE zona IN ('CAT', 'LEV', 'VAL');
UPDATE referees SET zona = 'ANDALUCIA' WHERE zona IN ('SUR', 'AND');
UPDATE referees SET zona = 'CANARIAS' WHERE zona = 'CAN';

-- Campeonatos
UPDATE competitions SET zona = 'NOROESTE' WHERE zona IN ('N1', 'N2', 'GAL', 'AST', 'CYL', 'PVA', 'ARA', 'Norte', 'NORTE');
UPDATE competitions SET zona = 'CENTRO' WHERE zona IN ('MAD', 'Centro');
UPDATE competitions SET zona = 'MEDITERRANEO' WHERE zona IN ('CAT', 'LEV', 'VAL');
UPDATE competitions SET zona = 'ANDALUCIA' WHERE zona IN ('SUR', 'AND');
UPDATE competitions SET zona = 'CANARIAS' WHERE zona = 'CAN';

-- Perfiles y solicitudes
UPDATE profiles SET zona = 'NOROESTE' WHERE zona IN ('N1', 'N2', 'GAL', 'AST', 'CYL', 'PVA', 'ARA', 'Norte', 'NORTE');
UPDATE profiles SET zona = 'CENTRO' WHERE zona IN ('MAD', 'Centro');
UPDATE profiles SET zona = 'MEDITERRANEO' WHERE zona IN ('CAT', 'LEV', 'VAL');
UPDATE profiles SET zona = 'ANDALUCIA' WHERE zona IN ('SUR', 'AND');
UPDATE profiles SET zona = 'CANARIAS' WHERE zona = 'CAN';

DELETE FROM zones
WHERE code NOT IN ('NOROESTE', 'CENTRO', 'MEDITERRANEO', 'ANDALUCIA', 'CANARIAS');
