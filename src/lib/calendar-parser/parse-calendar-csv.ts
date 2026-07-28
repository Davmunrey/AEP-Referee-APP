import { deduceMacroZone, resolveZoneCode } from "@/lib/aep-zones";
import type { EventType } from "@/lib/types";
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
  sept: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function stripAccents(raw: string): string {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(normalizeText(cell));
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(normalizeText(cell));
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(normalizeText(cell));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectYear(text: string): number {
  const header = text.match(/CALENDARIO\s+de\s+COMPETICIONES\s+(\d{4})/i);
  if (header) return Number(header[1]);
  const any = text.match(/\b(20\d{2})\b/);
  return any ? Number(any[1]) : new Date().getFullYear();
}

function nivelToTipo(nivel: string): EventType | null {
  const n = nivel.toUpperCase().replace(/\s+/g, "");
  if (n === "AEP1") return "AEP-1";
  if (n === "AEP2") return "AEP-2";
  if (n === "AEP3") return "AEP-3";
  return null;
}

function month(raw: string): number | undefined {
  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .slice(0, 4);
  return MONTHS_ES[key] ?? MONTHS_ES[key.slice(0, 3)];
}

function lastDayOfMonth(year: number, monthNumber: number): number {
  return new Date(year, monthNumber, 0).getDate();
}

function iso(year: number, monthNumber: number, day: number): string {
  return `${year}-${pad2(monthNumber)}-${pad2(day)}`;
}

function parseDate(raw: string, year: number) {
  const text = normalizeText(raw).replace(/\*\*/g, "").trim();
  const lower = text.toLowerCase();
  if (!text || /^(pendiente|sin confirmar|variable)$/i.test(text)) {
    return { start: null, end: null, pendiente: true };
  }

  const single = text.match(/^(\d{1,2})\s*[-/]?\s*([a-záéíóú]{3,10})$/i);
  if (single) {
    const m = month(single[2]!);
    if (!m) return { start: null, end: null, pendiente: false };
    const d = Number(single[1]);
    const date = iso(year, m, d);
    return { start: date, end: date, pendiente: false };
  }

  const sameMonth = text.match(/^(\d{1,2})(?:-\d{1,2})*-(\d{1,2})\s+([a-záéíóú]{3,10})$/i);
  if (sameMonth) {
    const m = month(sameMonth[3]!);
    if (!m) return { start: null, end: null, pendiente: false };
    return {
      start: iso(year, m, Number(sameMonth[1])),
      end: iso(year, m, Number(sameMonth[2])),
      pendiente: false,
    };
  }

  const crossCompact = text.match(/^(\d{1,2})-(\d{1,2})\s+([a-záéíóú]{3,10})-([a-záéíóú]{3,10})$/i);
  if (crossCompact) {
    const startMonth = month(crossCompact[3]!);
    const endMonth = month(crossCompact[4]!);
    if (!startMonth || !endMonth) return { start: null, end: null, pendiente: false };
    return {
      start: iso(year, startMonth, Number(crossCompact[1])),
      end: iso(year, endMonth, Number(crossCompact[2])),
      pendiente: false,
    };
  }

  const crossSpaced = text.match(/^(\d{1,2})\s+([a-záéíóú]{3,10})\s*-\s*(\d{1,2})\s+([a-záéíóú]{3,10})$/i);
  if (crossSpaced) {
    const startMonth = month(crossSpaced[2]!);
    const endMonth = month(crossSpaced[4]!);
    if (!startMonth || !endMonth) return { start: null, end: null, pendiente: false };
    return {
      start: iso(year, startMonth, Number(crossSpaced[1])),
      end: iso(year, endMonth, Number(crossSpaced[3])),
      pendiente: false,
    };
  }

  const monthRange = lower.match(/^([a-záéíóú]{3,10})\s*-\s*([a-záéíóú]{3,10})$/i);
  if (monthRange) {
    const startMonth = month(monthRange[1]!);
    const endMonth = month(monthRange[2]!);
    if (!startMonth || !endMonth) return { start: null, end: null, pendiente: true };
    return {
      start: iso(year, startMonth, 1),
      end: iso(year, endMonth, lastDayOfMonth(year, endMonth)),
      pendiente: true,
    };
  }

  return { start: null, end: null, pendiente: true };
}

function extractProvincia(localidad: string): string | undefined {
  return localidad.match(/\(([^)]+)\)/)?.[1]?.trim();
}

function zoneFromEntry(nombre: string, localidad: string): string | undefined {
  const provincia = extractProvincia(localidad);
  const fromPlace = deduceMacroZone(provincia, localidad);
  if (fromPlace) return fromPlace;
  const haystack = stripAccents(`${nombre} ${localidad}`).toUpperCase();
  if (/\bESTE\b|CATALUNA|BALEARES|MURCIA|VALENCIA|CHIVA|TARRAGONA|BARCELONA/.test(haystack)) {
    return "MEDITERRANEO";
  }
  if (/ANDALUC|ALMERIA|MALAGA|HUERCAL/.test(haystack)) return "ANDALUCIA";
  if (/CANARIAS|CANARIA/.test(haystack)) return "CANARIAS";
  if (/NOROESTE|ASTURIAS|GALICIA|VALLADOLID|CANTABRIA|GIJON|VITORIA/.test(haystack)) {
    return "NOROESTE";
  }
  if (/CENTRO|MADRID|TOLEDO|CASTILLA-LA MANCHA|EXTREMADURA/.test(haystack)) {
    return "CENTRO";
  }
  return resolveZoneCode(nombre);
}

function looksForeign(localidad: string, organizador: string): boolean {
  return /\b(Finland|Malta|Czech Republic|Poland|Lithuania|South Africa|Luxembourg|USA|Turkiye|Turkey|Reno|Warsaw|Oulu|Valetta|Pilsen|Istanbul)\b/i.test(
    `${localidad} ${organizador}`,
  );
}

function isCalendarDataRow(row: string[]): boolean {
  const date = row[1] ?? "";
  const name = row[2] ?? "";
  if (!date || !name) return false;
  if (/^COMPETICIONES\s+\d/i.test(name)) return false;
  if (/SIN CAMPEONATOS/i.test(date) || /SIN CAMPEONATOS/i.test(name)) return false;
  return true;
}

export function parseAepCalendarCsv(text: string): ParsedCalendar {
  const year = detectYear(text);
  const warnings: string[] = [];
  const entries: ParsedCalendarEntry[] = [];

  for (const row of parseCsvRows(text)) {
    if (!isCalendarDataRow(row)) continue;

    const rawDate = row[1] ?? "";
    const nombre = row[2] ?? "";
    const localidad = row[3] ?? "";
    const organizador = row[4] ?? "";
    const nivelRaw = (row[5] ?? "").replace(/\s+/g, "");
    const tipo = nivelToTipo(nivelRaw);
    const dates = parseDate(rawDate, year);
    const provincia = extractProvincia(localidad);
    const zona = zoneFromEntry(nombre, localidad);
    const esEspaña = tipo !== null && !looksForeign(localidad, organizador);

    if (esEspaña && !zona) {
      warnings.push(`Zona no deducida: ${nombre} (${localidad || "sede pendiente"})`);
    }
    if (esEspaña && !dates.start) {
      warnings.push(`Fecha pendiente/no exacta: ${nombre} (${rawDate})`);
    }

    entries.push({
      rawDate,
      fechaInicio: dates.start,
      fechaFin: dates.end,
      nombre,
      localidad,
      provincia,
      organizador,
      nivelRaw,
      tipo,
      zona,
      divisiones: row[6] ?? "",
      modalidades: row[7] ?? "",
      equipamiento: row[8] ?? "",
      esEspaña,
      pendiente: dates.pendiente,
    });
  }

  return { year, entries, warnings };
}
