import * as XLSX from "xlsx";
import type { AepMacroZoneId } from "@/lib/aep-zones";
import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";
import {
  aggregateArbitrajeYears,
  type RefereeArbitrajeStats,
  type RefereeArbitrajeStatsByYear,
} from "./arbitraje-stats";
import {
  mapExcelActivo,
  mapExcelEventType,
  mapExcelLevel,
  mapExcelZone,
  refereeIdFromExcelId,
} from "./maps";
import { eventCountFromStats, parseArbitrajes2026Sheet } from "./parse-arbitrajes-2026";
import { excelDateToIso, parseCompetitionDateRange } from "./parse-dates";

export { excelDateToIso, parseCompetitionDateRange } from "./parse-dates";

const DEFAULT_MAX_XLSX_BYTES = 8 * 1024 * 1024;
const MAX_WORKSHEETS = 12;
const MAX_ROWS_PER_SHEET = 2000;
const MAX_COLUMNS_PER_SHEET = 80;
const REQUIRED_SHEET = "Datos";

export interface ParsedRegistryReferee {
  excelId: number;
  id: string;
  nombre: string;
  nivel: RefereeLevel;
  zona: AepMacroZoneId;
  estado: RefereeStatus;
  disp: boolean;
  eventos: number;
  ultimo: string;
  localidad?: string;
  email?: string;
  telefono?: string;
  genero?: string;
  antiguedad?: string;
  ultimoFecha?: string;
  notas?: string;
  excelMacroZone?: string;
  /** Arbitrajes agregados de todos los años (compatibilidad y totales). */
  arbitrajeStats?: RefereeArbitrajeStats;
  /** Arbitrajes desglosados por año natural. */
  arbitrajeStatsByYear?: RefereeArbitrajeStatsByYear;
}

export interface ParsedRegistryCompetition {
  excelId: number;
  nombre: string;
  tipo: EventType;
  fecha: string;
  fechaFin: string;
  sede: string;
  zona: AepMacroZoneId;
}

export interface ParsedJudgesRegistry {
  referees: ParsedRegistryReferee[];
  competitions: ParsedRegistryCompetition[];
  warnings: string[];
}

export interface ParseJudgesRegistryOptions {
  maxBytes?: number;
}

function byteLength(buffer: ArrayBuffer): number {
  return buffer.byteLength;
}

function assertReasonableXlsxInput(buffer: ArrayBuffer, options?: ParseJudgesRegistryOptions) {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_XLSX_BYTES;
  if (byteLength(buffer) > maxBytes) {
    throw new Error(`Excel demasiado grande: máximo ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }

  const head = new Uint8Array(buffer.slice(0, 4));
  const zipSignature = head[0] === 0x50 && head[1] === 0x4b;
  if (!zipSignature) {
    throw new Error("Formato Excel no válido: se esperaba .xlsx");
  }
}

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  if (rows.length > MAX_ROWS_PER_SHEET) {
    throw new Error(`Hoja «${name}» demasiado grande: máximo ${MAX_ROWS_PER_SHEET} filas`);
  }
  if (rows.some((row) => row.length > MAX_COLUMNS_PER_SHEET)) {
    throw new Error(`Hoja «${name}» demasiado ancha: máximo ${MAX_COLUMNS_PER_SHEET} columnas`);
  }
  return rows;
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function asBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === 1 || v === "1" || v === "TRUE" || v === "true") return true;
  if (v === 0 || v === "0" || v === "FALSE" || v === "false") return false;
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function formatUltimoLabel(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  // Celdas vacías en el Excel se leen como serial 0 → epoch de la hoja (1899/1900).
  // Ninguna competición real es anterior a 2000, así que lo tratamos como "sin fecha".
  if (d.getFullYear() < 2000) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function parseDatos(
  rows: unknown[][],
  arbitrajeById: Map<number, RefereeArbitrajeStats>,
  arbitrajeByYearById: Map<number, RefereeArbitrajeStatsByYear>,
  warnings: string[],
): ParsedRegistryReferee[] {
  const out: ParsedRegistryReferee[] = [];
  for (const row of rows.slice(1)) {
    const excelId = asNumber(row[0]);
    const nombre = asString(row[1]);
    if (excelId == null || !nombre) continue;

    const excelMacroZone = asString(row[4]);
    const localidad = asString(row[5]);
    let zona = mapExcelZone(excelMacroZone);
    if (!zona) {
      if (/^ERA\s/i.test(nombre)) {
        zona = "CENTRO";
        warnings.push(
          `Juez ${excelId} (${nombre}): zona provisional CENTRO (ficha ERA sin zona en Excel)`,
        );
      } else {
        warnings.push(
          `Juez ${excelId} (${nombre}): zona no reconocida «${excelMacroZone ?? "—"}» / ${localidad ?? "—"}`,
        );
        continue;
      }
    }

    const stats = arbitrajeById.get(Math.trunc(excelId));
    const eventos = stats ? eventCountFromStats(stats) : 0;

    const { estado, disp } = mapExcelActivo(asBool(row[7]), nombre);
    const ultimoFecha = excelDateToIso(row[6]);
    const antiguedad = excelDateToIso(row[3]);
    // Un teléfono es TEXTO: leerlo como número perdía ceros iniciales, el
    // prefijo +34 (→ NaN → teléfono perdido) y precisión en números largos.
    const telefonoRaw = asString(row[9]);
    const notaExtra = asString(row[12]) ?? asString(row[11]);
    const notas = /^ERA\s/i.test(nombre)
      ? "Pendiente de completar ficha (Excel)"
      : notaExtra;

    out.push({
      excelId: Math.trunc(excelId),
      id: refereeIdFromExcelId(Math.trunc(excelId)),
      nombre,
      nivel: mapExcelLevel(asString(row[2])),
      zona,
      estado,
      disp,
      eventos,
      ultimo: formatUltimoLabel(ultimoFecha),
      localidad,
      email: asString(row[8])?.toLowerCase(),
      telefono: telefonoRaw,
      genero: asString(row[10]),
      antiguedad,
      ultimoFecha,
      notas,
      excelMacroZone,
      arbitrajeStats: stats,
      arbitrajeStatsByYear: arbitrajeByYearById.get(Math.trunc(excelId)),
    });
  }
  return out;
}

export function parseCampeonatos26(
  rows: unknown[][],
  warnings: string[],
): ParsedRegistryCompetition[] {
  const out: ParsedRegistryCompetition[] = [];
  for (const row of rows.slice(1)) {
    const excelId = asNumber(row[0]);
    const nombre = asString(row[1]);
    if (excelId == null || !nombre) continue;

    const tipo = mapExcelEventType(asString(row[5]));
    if (!tipo) {
      warnings.push(`Campeonato ${excelId}: tipo no reconocido «${row[5]}»`);
      continue;
    }

    const localidad = asString(row[2]);
    const provincia = asString(row[3]);
    const excelMacroZone = asString(row[4]);
    const zona = mapExcelZone(excelMacroZone, localidad, provincia);
    if (!zona) {
      warnings.push(
        `Campeonato ${excelId} (${nombre}): zona no reconocida «${excelMacroZone ?? "—"}»`,
      );
      continue;
    }

    const range = parseCompetitionDateRange(row[6], row[7]);
    if (!range) {
      warnings.push(
        `Campeonato ${excelId} (${nombre}): fecha no reconocida «${row[6] ?? "—"}»`,
      );
      continue;
    }
    const sede = [localidad, provincia].filter(Boolean).join(" · ") || nombre;

    out.push({
      excelId: Math.trunc(excelId),
      nombre,
      tipo,
      fecha: range.fecha,
      fechaFin: range.fechaFin,
      sede,
      zona,
    });
  }
  return out;
}

export function parseJudgesRegistryXlsx(
  buffer: ArrayBuffer,
  options?: ParseJudgesRegistryOptions,
): ParsedJudgesRegistry {
  assertReasonableXlsxInput(buffer, options);
  // `sheetRows` corta la lectura por hoja: evita que un .xlsx con un rango
  // declarado gigante (<dimension ref="A1:XFD1048576"/>) o XML muy comprimible
  // materialice millones de filas en memoria antes de los topes de sheetRows().
  // +1 sobre el máximo lógico para que el chequeo explícito siga disparando.
  const wb = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    sheetRows: MAX_ROWS_PER_SHEET + 1,
  });
  const warnings: string[] = [];

  if (wb.SheetNames.length > MAX_WORKSHEETS) {
    throw new Error(`Excel con demasiadas hojas: máximo ${MAX_WORKSHEETS}`);
  }

  if (!wb.SheetNames.includes(REQUIRED_SHEET)) {
    throw new Error(`Falta hoja «${REQUIRED_SHEET}»`);
  }

  // Lee TODAS las hojas de arbitrajes por año natural ("Arbitrajes2024",
  // "Arbitrajes2025", "Arbitrajes2026"…), no solo la del año en curso. Cada hoja
  // se guarda en su bucket de año; el agregado suma todos los años.
  const arbitrajeSheets = wb.SheetNames.filter((n) => /^Arbitrajes\s*\d{4}$/i.test(n));
  const arbitrajeByYearById = new Map<number, RefereeArbitrajeStatsByYear>();
  for (const sheetName of arbitrajeSheets) {
    const year = sheetName.match(/(\d{4})/)?.[1];
    if (!year) continue;
    const perId = parseArbitrajes2026Sheet(sheetRows(wb, sheetName));
    for (const [id, stats] of perId) {
      if ((stats.total ?? 0) <= 0) continue;
      const byYear = arbitrajeByYearById.get(id) ?? {};
      byYear[year] = stats;
      arbitrajeByYearById.set(id, byYear);
    }
  }
  const arbitrajeById = new Map<number, RefereeArbitrajeStats>();
  for (const [id, byYear] of arbitrajeByYearById) {
    arbitrajeById.set(id, aggregateArbitrajeYears(byYear));
  }
  const referees = parseDatos(sheetRows(wb, "Datos"), arbitrajeById, arbitrajeByYearById, warnings);
  const competitions = parseCampeonatos26(sheetRows(wb, "Campeonatos26"), warnings);

  return { referees, competitions, warnings };
}

// Movida a ./maps (módulo ligero, sin dependencia xlsx); se re-exporta aquí
// para no romper a los consumidores existentes.
export { inicialesFromNombre } from "./maps";
