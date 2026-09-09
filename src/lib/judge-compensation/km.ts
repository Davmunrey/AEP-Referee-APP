/**
 * Texto tecleado → número, leído a la española.
 *
 * El campo de km es de texto (`inputMode="numeric"`), así que se puede
 * escribir «1.234». `Number("1.234")` es 1,234 y se redondeaba a 1 km: mil
 * doscientos treinta y cuatro kilómetros de ida y vuelta —Galicia y Andalucía,
 * pongamos— cobrados como uno, sin que nada lo dijera. Un punto seguido de
 * exactamente tres cifras, sin coma, es el separador de millares; un km con
 * tres decimales no significa nada aquí, que pide kilómetros enteros.
 */
function numeroALaEspanola(raw: string): number {
  let texto = raw.trim();
  if (texto.includes(",")) {
    // Con coma decimal, cualquier punto es de millares: «1.234,5».
    texto = texto.replace(/\./g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    // Sin coma, solo si los grupos son exactamente de tres: «1.234».
    texto = texto.replace(/\./g, "");
  }
  return Number(texto.replace(",", "."));
}

/** Normaliza km a entero no negativo; devuelve null si no es válido. */
export function parseIntegerKm(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" && String(value).trim() === "") return null;
  const n = typeof value === "number" ? value : numeroALaEspanola(String(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function isPositiveIntegerKm(km: number | null | undefined): boolean {
  return km != null && Number.isInteger(km) && km > 0;
}

/** Km introducido manualmente (incluye 0 = sin desplazamiento facturable). */
export function isResolvedIntegerKm(km: number | null | undefined): boolean {
  return km != null && Number.isInteger(km) && km >= 0;
}

/** Ida → vuelta en km enteros (×2). */
export function roundTripKmFromOneWay(oneWayKm: number): number {
  const oneWay = parseIntegerKm(oneWayKm);
  if (oneWay == null || oneWay <= 0) return 0;
  return oneWay * 2;
}

export function oneWayKmFromRoundTrip(roundTripKm: number): number {
  const rt = parseIntegerKm(roundTripKm);
  if (rt == null || rt <= 0) return 0;
  return Math.round(rt / 2);
}
