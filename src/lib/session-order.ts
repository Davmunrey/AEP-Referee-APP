/** Orden numérico de sesión (S1, S2, SESIÓN 10…). */
export function sessionOrder(session: string): number {
  // Primer grupo de dígitos, no todos concatenados: "Sesión 2 grupo 3" debe
  // ordenar como 2, no 23 (y sessionLabel debe dar "S2", no "S23").
  const match = session.match(/\d+/);
  const number = match ? Number(match[0]) : NaN;
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
