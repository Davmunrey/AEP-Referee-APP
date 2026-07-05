-- Arbitrajes desglosados por año natural: { "2024": {…}, "2025": {…}, … }.
-- El agregado histórico sigue en arbitraje_stats (suma de todos los años); esta
-- columna permite separar censo vigente vs histórico y analítica por año.

ALTER TABLE referees ADD COLUMN IF NOT EXISTS arbitraje_stats_by_year JSONB;
