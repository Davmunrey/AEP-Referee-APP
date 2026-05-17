import * as XLSX from "xlsx";
import type { AepGeographicZoneId } from "@/lib/aep-zones";
import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";
import {
  mapExcelActivo,
  mapExcelEventType,
  mapExcelLevel,
  mapExcelZone,
  refereeIdFromExcelId,
} from "./maps";

export interface ParsedRegistryReferee {
  excelId: number;
  id: string;
  nombre: string;
  nivel: RefereeLevel;
  zona: AepGeographicZoneId;
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
}

export interface ParsedRegistryCompetition {
  excelId: number;
  nombre: string;
  tipo: EventType;
  fecha: string;
  fechaFin: string;
  sede: string;
  zona: AepGeographicZoneId;
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
  return undefined;
}

/** Excel serial o Date → YYYY-MM-DD. */
export function excelDateToIso(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && v > 30000) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${m}-${d}`;
    }
  }
  const s = asString(v);
  if (!s) return undefined;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  return undefined;
}

function formatUltimoLabel(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function parseArbitrajes2026(rows: unknown[][]): Map<number, number> {
  const counts = new Map<number, number>();
  if (rows.length < 2) return counts;
  for (const row of rows.slice(1)) {
    const id = asNumber(row[0]);
    if (id == null) continue;
    const aep3 = asNumber(row[2]) ?? 0;
    const aep2 = asNumber(row[11]) ?? 0;
    const aep1 = asNumber(row[20]) ?? 0;
    counts.set(Math.trunc(id), aep3 + aep2 + aep1);
  }
  return counts;
}

function parseDatos(
  rows: unknown[][],
  eventosById: Map<number, number>,
  warnings: string[],
): ParsedRegistryReferee[] {
  const out: ParsedRegistryReferee[] = [];
  for (const row of rows.slice(1)) {
    const excelId = asNumber(row[0]);
    const nombre = asString(row[1]);
    if (excelId == null || !nombre) continue;

    let zona = mapExcelZone(asString(row[4]), asString(row[5]));
    if (!zona) {
      if (/^ERA\s/i.test(nombre)) {
        zona = "CENTRO";
        warnings.push(
          `Juez ${excelId} (${nombre}): zona provisional CENTRO (ficha ERA sin zona en Excel)`,
        );
      } else {
        warnings.push(`Juez ${excelId} (${nombre}): zona no reconocida «${row[4]}»`);
        continue;
      }
    }

    const { estado, disp } = mapExcelActivo(asBool(row[7]), nombre);
    const ultimoFecha = excelDateToIso(row[6]);
    const antiguedad = excelDateToIso(row[3]);
    const telefonoRaw = asNumber(row[9]);
    const notas =
      /^ERA\s/i.test(nombre) ? "Pendiente de completar ficha (Excel)" : undefined;

    out.push({
      excelId: Math.trunc(excelId),
      id: refereeIdFromExcelId(Math.trunc(excelId)),
      nombre,
      nivel: mapExcelLevel(asString(row[2])),
      zona,
      estado,
      disp,
      eventos: eventosById.get(Math.trunc(excelId)) ?? 0,
      ultimo: formatUltimoLabel(ultimoFecha),
      localidad: asString(row[5]),
      email: asString(row[8])?.toLowerCase(),
      telefono: telefonoRaw != null ? String(Math.trunc(telefonoRaw)) : undefined,
      genero: asString(row[10]),
      antiguedad,
      ultimoFecha,
      notas,
    });
  }
  return out;
}

function parseCampeonatos26(
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

    const zona = mapExcelZone(asString(row[4]), asString(row[2]), asString(row[3]));
    if (!zona) {
      warnings.push(`Campeonato ${excelId}: zona no reconocida`);
      continue;
    }

    const fecha =
      excelDateToIso(row[6]) ?? excelDateToIso(row[7]) ?? "2026-06-01";
    const fechaFin = excelDateToIso(row[7]) ?? fecha;
    const localidad = asString(row[2]);
    const provincia = asString(row[3]);
    const sede = [localidad, provincia].filter(Boolean).join(" · ") || nombre;

    out.push({
      excelId: Math.trunc(excelId),
      nombre,
      tipo,
      fecha,
      fechaFin: fechaFin < fecha ? fecha : fechaFin,
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

  const eventosById = parseArbitrajes2026(sheetRows(wb, "Arbitrajes2026"));
  const referees = parseDatos(sheetRows(wb, "Datos"), eventosById, warnings);
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
