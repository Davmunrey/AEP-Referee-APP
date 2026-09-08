import type { RefereeLevel } from "@/lib/types";

/**
 * El escalafón de niveles de juez, de menor a mayor. Fuente única.
 *
 * Estaba copiado a mano en nueve sitios —los dos servicios de ascensos, el
 * censo en memoria, dos diálogos de la interfaz, la normativa de tarima, la
 * analítica, el store y la página de documentación—, todos escribiendo el
 * mismo literal. Mientras las nueve copias coincidan no pasa nada; el día que
 * una se quede atrás, el fallo no es visible: un ascenso se aprueba y el nivel
 * no sube, o peor, un cambio de nivel se toma por ascenso y DEGRADA al juez.
 *
 * Y había una trampa preparada: `REFEREE_LEVELS`, la lista de validación de la
 * API, tiene los mismos cuatro valores en otro orden («IPF Cat. 1» antes que
 * «IPF Cat. 2»). Como conjunto da igual, pero se llama casi igual y parece la
 * lista canónica: quien la reutilizara para ordenar invertiría la cima del
 * escalafón sin que ningún tipo se quejara.
 */
export const REFEREE_LEVEL_ORDER = [
  "Regional",
  "Nacional",
  "IPF Cat. 2",
  "IPF Cat. 1",
] as const satisfies readonly RefereeLevel[];

/** Posición en el escalafón; `-1` si el nivel no es reconocible. */
export function refereeLevelRank(nivel: string): number {
  return (REFEREE_LEVEL_ORDER as readonly string[]).indexOf(nivel);
}

/** ¿Llega `actual` al mínimo exigido? Un nivel no reconocible nunca llega. */
export function meetsRefereeLevel(actual: string, minimo: string): boolean {
  const a = refereeLevelRank(actual);
  const m = refereeLevelRank(minimo);
  if (a < 0 || m < 0) return false;
  return a >= m;
}

/** ¿Pasar de `from` a `to` es subir? Con niveles no reconocibles, no. */
export function isRefereeLevelUpgrade(from: string, to: string): boolean {
  const f = refereeLevelRank(from);
  const t = refereeLevelRank(to);
  if (f < 0 || t < 0) return false;
  return t > f;
}

/** Niveles por encima del actual, en orden. Vacío si no es reconocible. */
export function higherRefereeLevels(actual: string): RefereeLevel[] {
  const idx = refereeLevelRank(actual);
  return idx >= 0 ? REFEREE_LEVEL_ORDER.slice(idx + 1) : [];
}
