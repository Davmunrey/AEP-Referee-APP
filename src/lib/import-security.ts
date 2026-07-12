const MAX_SELECTED_KEYS = 500;
const MAX_SELECTED_KEY_LENGTH = 160;

export function parseSelectedImportKeys(raw: FormDataEntryValue | null): Set<string> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  // Holgura por el overhead de JSON (comillas, comas, corchetes): el máximo
  // válido (500 claves de 160 chars) serializa por encima de keys*length.
  if (raw.length > MAX_SELECTED_KEYS * (MAX_SELECTED_KEY_LENGTH + 4) + 2) {
    throw new Error("Selección demasiado grande");
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Selección inválida");
  if (parsed.length > MAX_SELECTED_KEYS) throw new Error("Demasiadas filas seleccionadas");
  if (
    parsed.some(
      (item) => typeof item !== "string" || item.length === 0 || item.length > MAX_SELECTED_KEY_LENGTH,
    )
  ) {
    throw new Error("Selección inválida");
  }
  return new Set(parsed);
}

export function hasPdfSignature(buffer: Buffer | Uint8Array): boolean {
  if (buffer.byteLength < 5) return false;
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}
