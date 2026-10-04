/**
 * Límite de frecuencia genérico por clave (usuario, IP…), en memoria y por
 * instancia, como el del login. No es una cuota exacta entre instancias: es
 * el freno que impide que una sola sesión machaque una ruta en bucle.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 20_000;

export function allowAction(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/** Para las pruebas. */
export function resetActionLimits(): void {
  buckets.clear();
}
