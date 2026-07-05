-- Permite un tercer tipo de organizador del recibo: 'custom' (personalizable),
-- que reutiliza compensation_clubs (JSONB nombres+correos) para cabecera y
-- correos de devolución. Cambio aditivo: no afecta a filas 'club'/'aep'.

ALTER TABLE competitions
  DROP CONSTRAINT IF EXISTS competitions_compensation_organizer_check;

ALTER TABLE competitions
  ADD CONSTRAINT competitions_compensation_organizer_check
  CHECK (
    compensation_organizer IS NULL
    OR compensation_organizer IN ('club', 'aep', 'custom')
  );
