-- Campos del registro maestro «Control jueces» (hoja Datos).

ALTER TABLE referees ADD COLUMN IF NOT EXISTS localidad TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS genero TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS antiguedad DATE;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS excel_id INTEGER;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS ultimo_fecha DATE;

CREATE UNIQUE INDEX IF NOT EXISTS referees_excel_id_idx ON referees (excel_id)
  WHERE excel_id IS NOT NULL;
