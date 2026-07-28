import {
  deduceMacroZone,
  resolveZoneCode,
  type AepMacroZoneId,
} from "@/lib/aep-zones";
import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";

/**
 * Zona del juez/campeonato desde columna Excel «Zona».
 * No se sobreescribe por localidad: el Excel manda (5 macrozonas).
 */
export function mapExcelZone(
  excelZone: string | null | undefined,
  localidad?: string | null,
  provincia?: string | null,
): AepMacroZoneId | undefined {
  const fromExcel = resolveZoneCode(excelZone ?? undefined);
  if (fromExcel) return fromExcel;

  if (!excelZone?.trim()) {
    return deduceMacroZone(provincia ?? undefined, localidad ?? "");
  }

  return undefined;
}

const LEVEL_MAP: Record<string, RefereeLevel> = {
  "IPF 2": "IPF Cat. 2",
  "IPF 1": "IPF Cat. 1",
  Nacional: "Nacional",
  Regional: "Regional",
};

export function mapExcelLevel(raw: string | null | undefined): RefereeLevel {
  if (!raw) return "Regional";
  const trimmed = raw.trim();
  const direct = LEVEL_MAP[trimmed] ?? LEVEL_MAP[trimmed.replace(/\s+/g, " ")];
  if (direct) return direct;
  // Variantes reales del Excel ("IPF Cat. 2", "IPF-1", "IPF2"…): sin esta
  // normalización, un juez IPF quedaba degradado a Regional en silencio.
  const compact = trimmed.toUpperCase().replace(/[\s.\-]|CAT/g, "");
  if (compact === "IPF2") return "IPF Cat. 2";
  if (compact === "IPF1") return "IPF Cat. 1";
  if (compact === "NACIONAL") return "Nacional";
  return "Regional";
}

export function mapExcelActivo(
  activo: boolean | null | undefined,
  nombre: string,
): { estado: RefereeStatus; disp: boolean } {
  if (/^ERA\s/i.test(nombre.trim())) {
    return { estado: "Inactivo", disp: false };
  }
  if (activo === true) return { estado: "Activo", disp: true };
  if (activo === false) return { estado: "Inactivo", disp: false };
  return { estado: "Inactivo", disp: false };
}

export function mapExcelEventType(raw: string | null | undefined): EventType | null {
  if (!raw) return null;
  const u = raw.toUpperCase().replace(/\s+/g, "");
  const has1 = u.includes("AEP1");
  const has2 = u.includes("AEP2");
  const has3 = u.includes("AEP3");
  if (has3) return "AEP-3";
  if (has2 && has1) return "AEP-2";
  if (has2) return "AEP-2";
  if (has1) return "AEP-1";
  return null;
}

export function refereeIdFromExcelId(excelId: number): string {
  return `j-${excelId}`;
}

/**
 * Vive aquí (módulo ligero) y no en parse-xlsx para que los consumidores del
 * servidor no arrastren la dependencia xlsx solo por unas iniciales.
 */
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
