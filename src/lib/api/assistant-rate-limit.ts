/**
 * Limitador en memoria para el asistente IA: acota el número de preguntas por
 * usuario y ventana, para contener el coste/cuota del proveedor (Gemini).
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function canAskAssistant(
  key: string,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true };
}

/** Solo para tests. */
export function __resetAssistantLimiter(): void {
  buckets.clear();
}
