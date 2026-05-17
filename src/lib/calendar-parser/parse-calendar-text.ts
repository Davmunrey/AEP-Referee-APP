import type { EventType } from "@/lib/types";
import { normalizeAepCalendarPdfText } from "./normalize-calendar-pdf-text";
import type { ParsedCalendar, ParsedCalendarEntry } from "./types";

const MONTHS_ES: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

const NIVEL_VALID = new Set([
  "AEP1",
  "AEP2",
  "AEP3",
  "EPF",
  "IPF",
  "ESP.",
  "ESP",
  "Especial",
]);

import { deduceGeographicZone } from "@/lib/aep-zones";

const DATE_SINGLE_RE = /^(\d{1,2})-([a-záéíóú]{3})$/i;
const DATE_RANGE_SAME_RE = /^(\d{1,2})-(\d{1,2})\s+([a-záéíóú]{3})$/i;
const DATE_RANGE_CROSS_RE =
  /^(\d{1,2})-(\d{1,2})\s+([a-záéíóú]{3})-([a-záéíóú]{3})$/i;

const HEADER_LINE_RE = /^(FECHA|LOCALIDAD|ORGANIZADOR|NIVEL|DIVISIONES|COMPETICIONES.*TRIMESTRE.*\d{4}|FINAL DE A[ÑN]O|EVENTO PATROCINADO|ASOCIACI[ÓO]N\s+ESPA[ÑN]OLA.*POWERLIFTING|CALENDARIO\s+de\s+COMPETICIONES\s+\d{4}|\*\s+Actualizado.*$)/i;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isHeaderLine(line: string): boolean {
  if (HEADER_LINE_RE.test(line)) return true;
  if (/^P[áa]gina\s+\d+/i.test(line)) return true;
  if (/^P\.\s+/.test(line) && line.length < 25) return true;
  return false;
}

function isDateLine(line: string): boolean {
  return (
    /^pendiente$/i.test(line) ||
    DATE_SINGLE_RE.test(line) ||
    DATE_RANGE_SAME_RE.test(line) ||
    DATE_RANGE_CROSS_RE.test(line)
  );
}

function parseDate(
  raw: string,
  year: number,
): { start: string | null; end: string | null; pendiente: boolean } {
  const trimmed = raw.trim();
  if (/^pendiente$/i.test(trimmed))
    return { start: null, end: null, pendiente: true };

  const single = trimmed.match(DATE_SINGLE_RE);
  if (single) {
    const day = Number(single[1]);
    const month = MONTHS_ES[single[2].toLowerCase()];
    if (!month) return { start: null, end: null, pendiente: false };
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    return { start: date, end: date, pendiente: false };
  }

  const sameMonth = trimmed.match(DATE_RANGE_SAME_RE);
  if (sameMonth) {
    const startDay = Number(sameMonth[1]);
    const endDay = Number(sameMonth[2]);
    const month = MONTHS_ES[sameMonth[3].toLowerCase()];
    if (!month) return { start: null, end: null, pendiente: false };
    return {
      start: `${year}-${pad2(month)}-${pad2(startDay)}`,
      end: `${year}-${pad2(month)}-${pad2(endDay)}`,
      pendiente: false,
    };
  }

  const cross = trimmed.match(DATE_RANGE_CROSS_RE);
  if (cross) {
    const startDay = Number(cross[1]);
    const endDay = Number(cross[2]);
    const startMonth = MONTHS_ES[cross[3].toLowerCase()];
    const endMonth = MONTHS_ES[cross[4].toLowerCase()];
    if (!startMonth || !endMonth)
      return { start: null, end: null, pendiente: false };
    return {
      start: `${year}-${pad2(startMonth)}-${pad2(startDay)}`,
      end: `${year}-${pad2(endMonth)}-${pad2(endDay)}`,
      pendiente: false,
    };
  }

  return { start: null, end: null, pendiente: false };
}

function nivelToTipo(nivel: string): EventType | null {
  const n = nivel.toUpperCase().replace(/\s+/g, "");
  if (n === "AEP1") return "AEP-1";
  if (n === "AEP2") return "AEP-2";
  if (n === "AEP3") return "AEP-3";
  return null;
}

function deducirZona(
  provincia: string | undefined,
  localidad: string,
): string | undefined {
  return deduceGeographicZone(provincia, localidad);
}

function looksForeign(localidad: string): boolean {
  return /\b(Finland|Malta|Slovenia|France|Italy|Norway|Sweden|Germany|Portugal|Switzerland|UK|USA|Israel)\b/i.test(
    localidad,
  );
}

function detectYear(text: string): number {
  const m = text.match(/CALENDARIO\s+de\s+COMPETICIONES\s+(\d{4})/i);
  if (m) return Number(m[1]);
  const fallback = text.match(/\b(20\d{2})\b/);
  return fallback ? Number(fallback[1]) : new Date().getFullYear();
}

/**
 * Convierte el texto del PDF de calendario AEP en una lista de entradas.
 * Solo marca `esEspaña === true` si nivel es AEP1/AEP2/AEP3 (no EPF/IPF) y la localidad
 * no parece extranjera.
 */
export function parseAepCalendarText(input: string): ParsedCalendar {
  const normalized = normalizeAepCalendarPdfText(input);
  const year = detectYear(normalized);
  const warnings: string[] = [];

  // Limpia headers tabla y agrupa líneas en bloques separados por líneas vacías.
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim());
  const cleanLines = rawLines.filter((l) => !isHeaderLine(l));

  // Bloques no vacíos.
  const blocks: string[] = [];
  let buffer: string[] = [];
  for (const line of cleanLines) {
    if (line === "") {
      if (buffer.length > 0) {
        blocks.push(buffer.join(" ").trim());
        buffer = [];
      }
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) blocks.push(buffer.join(" ").trim());

  const entries: ParsedCalendarEntry[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!isDateLine(block)) {
      i++;
      continue;
    }

    // Campos hasta la siguiente fecha (la misma fecha puede repetirse como separador).
    let next = i + 1;
    while (next < blocks.length) {
      const candidate = blocks[next];
      if (isDateLine(candidate)) break;
      next++;
    }
    const slice = blocks.slice(i + 1, next);

    const nivelIdx = slice.findIndex((part) =>
      NIVEL_VALID.has(part.replace(/\s+/g, "")),
    );
    if (nivelIdx < 0 || slice.length < nivelIdx + 2) {
      warnings.push(`Entrada incompleta tras fecha "${block}"`);
      i = next;
      continue;
    }

    const prefix = slice.slice(0, nivelIdx);
    const nombre = prefix[0] ?? "";
    const localidad = prefix[1] ?? prefix[0] ?? "";
    const organizador = prefix[2] ?? prefix[1] ?? prefix[0] ?? "";
    const nivelRaw = slice[nivelIdx];
    const divisiones = slice[nivelIdx + 1] ?? "";
    const modalidades = slice[nivelIdx + 2] ?? "";
    const equipamiento = slice[nivelIdx + 3] ?? "";

    if (!NIVEL_VALID.has(nivelRaw.replace(/\s+/g, ""))) {
      warnings.push(`Nivel desconocido «${nivelRaw}» — fila ignorada`);
      i = next;
      continue;
    }

    const dates = parseDate(block, year);
    const provinciaMatch = localidad.match(/\(([^)]+)\)/);
    const provincia = provinciaMatch?.[1];
    const tipo = nivelToTipo(nivelRaw);
    const zona = deducirZona(provincia, localidad);
    const esEspaña =
      tipo !== null &&
      !looksForeign(localidad) &&
      !looksForeign(organizador);

    entries.push({
      rawDate: block,
      fechaInicio: dates.start,
      fechaFin: dates.end,
      nombre: nombre.replace(/\s{2,}/g, " ").trim(),
      localidad: localidad.replace(/\s{2,}/g, " ").trim(),
      provincia,
      organizador: organizador.trim(),
      nivelRaw: nivelRaw.replace(/\s+/g, ""),
      tipo,
      zona,
      divisiones: divisiones.trim(),
      modalidades: modalidades.trim(),
      equipamiento: equipamiento.trim(),
      esEspaña,
      pendiente: dates.pendiente,
    });

    i = next;
  }

  return { year, entries, warnings };
}
