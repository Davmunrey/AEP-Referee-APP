import type { EventType } from "@/lib/types";

export interface FilenameMeta {
  /** Tipo deducido del nombre (AEP1/AEP2/AEP3). */
  tipo?: EventType;
  /** Fecha ISO YYYY-MM-DD. */
  fechaSugerida?: string;
  /** Subtítulo (ej. "Junior", "Absoluto") deducido del slug. */
  subtitulo?: string;
}

// AEP([123]): con `\d` un fichero "…_AEP7_…" producía el tipo inexistente
// "AEP-7", que llegaba hasta la creación del campeonato para morir en un 400.
const FILE_RE = /^(\d{4})(\d{2})(\d{2})_AEP([123])_(.+?)(?:_rev\d+)?\.(?:pdf|PDF)$/;

/**
 * Extrae metadatos de nombres como `20260517_AEP1_Horario-Junior_rev3.pdf`.
 * Devuelve campos vacíos si el nombre no coincide.
 */
export function parseScheduleFilename(filename: string): FilenameMeta {
  const m = filename.match(FILE_RE);
  if (!m) return {};
  const [, y, mo, d, type, slug] = m;
  const sub = slug
    .replace(/^Horario[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return {
    tipo: `AEP-${type}` as EventType,
    fechaSugerida: `${y}-${mo}-${d}`,
    subtitulo: sub || undefined,
  };
}
