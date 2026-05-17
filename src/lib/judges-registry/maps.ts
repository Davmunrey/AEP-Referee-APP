import type { AepGeographicZoneId } from "@/lib/aep-zones";
import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";

/** Códigos de zona en «Control jueces.xlsx» → zona geográfica AEP 2026. */
export const EXCEL_ZONE_TO_GEOGRAPHIC: Record<string, AepGeographicZoneId> = {
  "1-NOROESTE": "N1",
  "1- NOROESTE": "N1",
  "2- CENTRO": "CENTRO",
  "2-CENTRO": "CENTRO",
  "2- CENTRO ": "CENTRO",
  "3- MEDITERRANEO": "LEV",
  "3-MEDITERRANEO": "LEV",
  "4- ANDALUCIA": "SUR",
  "4-ANDALUCIA": "SUR",
  "5- CANARIAS": "CAN",
  "5-CANARIAS": "CAN",
};

export function mapExcelZone(
  excelZone: string | null | undefined,
  localidad?: string | null,
  provincia?: string | null,
): AepGeographicZoneId | undefined {
  const loc = `${localidad ?? ""} ${provincia ?? ""}`.toLowerCase();
  if (/\bmadrid\b/.test(loc)) return "MAD";
  if (/\bbarcelona\b|\btarragona\b|\bgirona\b|\blleida\b/.test(loc)) return "CAT";
  if (/\bcanarias\b|\blas palmas\b|\btenerife\b/.test(loc)) return "CAN";

  if (!excelZone) return undefined;
  const key = excelZone.trim().replace(/\s+/g, " ");
  return EXCEL_ZONE_TO_GEOGRAPHIC[key] ?? EXCEL_ZONE_TO_GEOGRAPHIC[key.toUpperCase()];
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
  return LEVEL_MAP[trimmed] ?? LEVEL_MAP[trimmed.replace(/\s+/g, " ")] ?? "Regional";
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
  const u = raw.toUpperCase();
  if (u.includes("AEP1")) return "AEP-1";
  if (u.includes("AEP2")) return "AEP-2";
  if (u.includes("AEP3")) return "AEP-3";
  return null;
}

export function refereeIdFromExcelId(excelId: number): string {
  return `j-${excelId}`;
}
