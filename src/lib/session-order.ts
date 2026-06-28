/** Orden numérico de sesión (S1, S2, SESIÓN 10…). */
export function sessionOrder(session: string): number {
  const number = Number(session.replace(/\D/g, ""));
  return Number.isFinite(number) && number > 0 ? number : Number.MAX_SAFE_INTEGER;
}

/** Etiqueta compacta Sx cuando hay número; si no, el id original. */
export function sessionLabel(session: string): string {
  const n = sessionOrder(session);
  return n < Number.MAX_SAFE_INTEGER ? `S${n}` : session;
}

export function compareSessions(a: string, b: string): number {
  const diff = sessionOrder(a) - sessionOrder(b);
  if (diff !== 0) return diff;
  return a.localeCompare(b, "es");
}
