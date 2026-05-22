const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}

export function canAttemptLogin(key: string): { allowed: true } | { allowed: false; retryAfter: number } {
  const current = now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= current) {
    buckets.set(key, { count: 0, resetAt: current + WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - current) / 1000) };
  }
  return { allowed: true };
}

export function recordFailedLogin(key: string): void {
  const current = now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= current) {
    buckets.set(key, { count: 1, resetAt: current + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

export function clearLoginAttempts(key: string): void {
  buckets.delete(key);
}
