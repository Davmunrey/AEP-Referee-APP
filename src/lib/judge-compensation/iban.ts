/** Normaliza IBAN español: sin espacios, mayúsculas. No se persiste en la app. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Formato legible en grupos de 4 (solo presentación al exportar). */
export function formatIbanDisplay(iban: string): string {
  const normalized = normalizeIban(iban);
  return normalized.replace(/(.{4})/g, "$1 ").trim();
}

/** Formatea la entrada del usuario mientras escribe (máx. 24 caracteres ES + 22 dígitos). */
export function formatIbanInput(raw: string): string {
  const normalized = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 24);
  return formatIbanDisplay(normalized);
}

/** Mensaje de ayuda o error para mostrar bajo el campo; null si el IBAN es válido o está vacío. */
export function getSpanishIbanValidationHint(raw: string): string | null {
  const iban = normalizeIban(raw);
  if (!iban) return null;
  if (iban.length < 24) {
    const missing = 24 - iban.length;
    return `Faltan ${missing} carácter${missing === 1 ? "" : "es"} (ES + 22 dígitos, 24 en total).`;
  }
  if (!/^ES\d{22}$/.test(iban)) {
    return "Debe empezar por ES seguido de 22 dígitos.";
  }
  if (!isValidSpanishIban(iban)) {
    return "Los dígitos de control no cuadran; revisa que el IBAN sea correcto.";
  }
  return null;
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
