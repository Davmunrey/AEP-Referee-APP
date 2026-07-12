/** Normaliza km a entero no negativo; devuelve null si no es válido. */
export function parseIntegerKm(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" && String(value).trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
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
