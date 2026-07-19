const WINDOW_MS = 15 * 60 * 1000;
// Tope estricto por combinación IP+email.
const MAX_ATTEMPTS_PER_IP_EMAIL = 5;
// Tope por email (independiente de la IP): frena el bypass por rotación de la
// cabecera X-Forwarded-For, que en un endpoint público es controlable por el
// cliente. Más alto que el de IP+email para no facilitar un DoS de bloqueo de
// cuenta (un tercero saturando intentos sobre el email de la víctima).
const MAX_ATTEMPTS_PER_EMAIL = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

// Nota: los buckets viven en memoria del proceso. En serverless esto es
// per-instancia y se reinicia en cold start; es una defensa en profundidad
// sobre el rate-limit propio de Supabase Auth, no la única barrera.
const ipEmailBuckets = new Map<string, Bucket>();
const emailBuckets = new Map<string, Bucket>();

// Purga periódica: las entradas expiradas (resetAt <= now) nunca se borraban,
// así que los mapas crecían sin límite con cada IP/email nuevo. Cada
// SWEEP_EVERY registros de fallo se barren ambos mapas (coste O(n) amortizado
// y acotado; no hace falta un timer).
const SWEEP_EVERY = 500;
let opsSinceSweep = 0;

function sweepExpired(current: number): void {
  for (const [key, bucket] of ipEmailBuckets) {
    if (bucket.resetAt <= current) ipEmailBuckets.delete(key);
  }
  for (const [key, bucket] of emailBuckets) {
    if (bucket.resetAt <= current) emailBuckets.delete(key);
  }
}

function maybeSweep(current: number): void {
  opsSinceSweep += 1;
  if (opsSinceSweep >= SWEEP_EVERY) {
    opsSinceSweep = 0;
    sweepExpired(current);
  }
}

function now() {
  return Date.now();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** IP del cliente a partir de las cabeceras de proxy. */
export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}:${normalizeEmail(email)}`;
}

function isBlocked(
  map: Map<string, Bucket>,
  key: string,
  max: number,
  current: number,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= current) return { allowed: true };
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - current) / 1000) };
  }
  return { allowed: true };
}

function bump(map: Map<string, Bucket>, key: string, current: number): void {
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= current) {
    map.set(key, { count: 1, resetAt: current + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/** Permite el intento solo si NINGÚN bucket (IP+email o email) está saturado. */
export function canAttemptLogin(
  ip: string,
  email: string,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const current = now();
  const normalizedEmail = normalizeEmail(email);
  const perIpEmail = isBlocked(ipEmailBuckets, loginRateLimitKey(ip, email), MAX_ATTEMPTS_PER_IP_EMAIL, current);
  if (!perIpEmail.allowed) return perIpEmail;
  return isBlocked(emailBuckets, normalizedEmail, MAX_ATTEMPTS_PER_EMAIL, current);
}

export function recordFailedLogin(ip: string, email: string): void {
  const current = now();
  maybeSweep(current);
  bump(ipEmailBuckets, loginRateLimitKey(ip, email), current);
  bump(emailBuckets, normalizeEmail(email), current);
}

export function clearLoginAttempts(ip: string, email: string): void {
  ipEmailBuckets.delete(loginRateLimitKey(ip, email));
  emailBuckets.delete(normalizeEmail(email));
}
