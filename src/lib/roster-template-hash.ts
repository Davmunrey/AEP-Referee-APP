import type { RosterSession } from "@/lib/types";

/**
 * Huella de una plantilla de tarima para detectar ediciones simultáneas.
 *
 * Guardar la plantilla reescribe el JSON entero: si dos personas la editan a
 * la vez, la segunda en guardar borraba sin aviso lo que la primera había
 * añadido (y, con ello, las asignaciones de esas sesiones). El cliente manda
 * la huella de la versión sobre la que editó y el servidor la compara con la
 * guardada; si no coinciden, responde 409 en lugar de sobrescribir.
 *
 * El orden de las claves no cuenta (Postgres reordena las de jsonb), por eso
 * se serializa ordenándolas. FNV-1a de 32 bits: basta para distinguir
 * versiones, no es una firma de seguridad.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function rosterTemplateHash(template: RosterSession[] | null | undefined): string {
  const text = stableStringify(template ?? []);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
