-- Recuento de posiciones (hoja Arbitrajes2026) y subzona Excel.

ALTER TABLE referees ADD COLUMN IF NOT EXISTS excel_macro_zone TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS arbitraje_stats JSONB;
