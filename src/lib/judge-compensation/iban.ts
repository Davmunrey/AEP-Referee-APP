/** Normaliza IBAN español: sin espacios, mayúsculas. No se persiste en la app. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Formato legible en grupos de 4 (solo presentación al exportar). */
export function formatIbanDisplay(iban: string): string {
  const normalized = normalizeIban(iban);
  return normalized.replace(/(.{4})/g, "$1 ").trim();
}

/** Validación mínima ES + dígitos de control (no almacenar el valor). */
export function isValidSpanishIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^ES\d{22}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
