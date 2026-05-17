import * as XLSX from "xlsx";
import type { AepMacroZoneId } from "@/lib/aep-zones";
import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";
import type { RefereeArbitrajeStats } from "./arbitraje-stats";
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
  arbitrajeStats?: RefereeArbitrajeStats;
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

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
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
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function parseDatos(
  rows: unknown[][],
  arbitrajeById: Map<number, RefereeArbitrajeStats>,
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
    const telefonoRaw = asNumber(row[9]);
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
      telefono: telefonoRaw != null ? String(Math.trunc(telefonoRaw)) : undefined,
      genero: asString(row[10]),
      antiguedad,
      ultimoFecha,
      notas,
      excelMacroZone,
      arbitrajeStats: stats,
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

    const range =
      parseCompetitionDateRange(row[6], row[7]) ??
      ({
        fecha: "2026-06-01",
        fechaFin: "2026-06-01",
      } as const);
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

export function parseJudgesRegistryXlsx(buffer: ArrayBuffer): ParsedJudgesRegistry {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const warnings: string[] = [];

  if (!wb.SheetNames.includes("Datos")) {
    warnings.push("Falta hoja «Datos»");
  }

  const arbitrajeById = parseArbitrajes2026Sheet(sheetRows(wb, "Arbitrajes2026"));
  const referees = parseDatos(sheetRows(wb, "Datos"), arbitrajeById, warnings);
  const competitions = parseCampeonatos26(sheetRows(wb, "Campeonatos26"), warnings);

  return { referees, competitions, warnings };
}

export function inicialesFromNombre(nombre: string): string {
  return nombre
    .replace(/[^a-zA-ZÀ-ÿ ]/g, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";
}
