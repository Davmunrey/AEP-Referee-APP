/**
 * Lo que de verdad ha cambiado en un formulario respecto al registro que se
 * abrió. Los formularios de edición mandaban el registro entero: si otro
 * delegado cambiaba entretanto un campo distinto (la disponibilidad de un juez
 * desde el directorio, por ejemplo), al guardar la ficha se le devolvía a su
 * valor antiguo sin que nadie lo viera. Enviando solo lo modificado, dos
 * personas pueden editar campos distintos del mismo registro sin pisarse.
 *
 * `""`, `null` y `undefined` cuentan como el mismo «vacío»; así un campo
 * opcional que el formulario normaliza a `undefined` no se envía por error.
 */
function vacio(v: unknown): unknown {
  return v === "" || v === null || v === undefined ? undefined : v;
}

export function changedFields<T extends Record<string, unknown>>(
  original: Partial<Record<keyof T, unknown>>,
  next: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    const a = vacio(original[key]);
    const b = vacio(next[key]);
    const igual =
      typeof a === "object" || typeof b === "object"
        ? JSON.stringify(a) === JSON.stringify(b)
        : Object.is(a, b);
    if (!igual) out[key] = next[key];
  }
  return out;
}
