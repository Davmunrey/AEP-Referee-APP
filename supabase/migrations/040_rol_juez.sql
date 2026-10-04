-- 040 — Rol `juez` para las cuentas del portal del juez.
--
-- Solo esto, en su propio fichero: `ALTER TYPE … ADD VALUE` no puede convivir
-- en la misma transacción con un uso del valor nuevo, y el workflow de
-- migraciones ejecuta cada fichero en una transacción. Las demás piezas de las
-- cuentas de juez van en la 041.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'juez';
