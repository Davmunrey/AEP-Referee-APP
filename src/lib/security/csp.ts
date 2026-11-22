/**
 * Content-Security-Policy de las páginas, con un nonce nuevo en cada petición.
 *
 * Antes la política era fija y llevaba `'unsafe-inline'` y `'unsafe-eval'` en
 * `script-src`: cualquier script inyectado (un XSS) se ejecutaba igual que los
 * nuestros. Con el nonce solo corren los scripts que el servidor marca en esa
 * respuesta: los de Next (los marca él solo al leer esta cabecera) y el de
 * arranque del tema (`app/layout.tsx`). `'strict-dynamic'` deja que esos
 * scripts carguen los trozos de la aplicación sin enumerar sus URLs.
 *
 * `'unsafe-eval'` solo en desarrollo: lo necesita React Refresh.
 *
 * Las rutas de la API no pasan por el middleware y conservan la política fija
 * de `next.config.ts` (el cuadrante imprimible se sirve desde ahí).
 */

export const NONCE_HEADER = "x-nonce";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildPageCsp(nonce: string, dev = process.env.NODE_ENV !== "production"): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (dev) script.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
