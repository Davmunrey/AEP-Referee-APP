import type { Zone } from "@/lib/types";

/**
 * Cinco zonas operativas del Excel «Control jueces» (único modelo para jueces, RBAC y campeonatos).
 */
export const AEP_MACRO_ZONES = [
  { id: "NOROESTE", name: "1- NOROESTE", excelLabels: ["1-NOROESTE", "1- NOROESTE"] },
  { id: "CENTRO", name: "2- CENTRO", excelLabels: ["2- CENTRO", "2-CENTRO"] },
  {
    id: "MEDITERRANEO",
    name: "3- MEDITERRANEO",
    excelLabels: ["3- MEDITERRANEO", "3-MEDITERRANEO"],
  },
  { id: "ANDALUCIA", name: "4- ANDALUCIA", excelLabels: ["4- ANDALUCIA", "4-ANDALUCIA"] },
  { id: "CANARIAS", name: "5- CANARIAS", excelLabels: ["5- CANARIAS", "5-CANARIAS"] },
] as const;

export type AepMacroZoneId = (typeof AEP_MACRO_ZONES)[number]["id"];

/** @deprecated Usar `AepMacroZoneId`. */
export type AepGeographicZoneId = AepMacroZoneId;

/** Listado para selects, seed y API meta. */
export const AEP_ZONES: Zone[] = AEP_MACRO_ZONES.map((z) => ({
  code: z.id,
  name: z.name,
}));

/** @deprecated Usar `AEP_MACRO_ZONES`. */
export const AEP_GEOGRAPHIC_ZONES = AEP_MACRO_ZONES;

const MACRO_NAME_BY_ID = Object.fromEntries(
  AEP_MACRO_ZONES.map((z) => [z.id, z.name]),
) as Record<AepMacroZoneId, string>;

function normalizeZoneKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Etiquetas Excel y códigos históricos → id macro canónico. */
export const LEGACY_ZONE_CODE_MAP: Record<string, AepMacroZoneId> = {
  NOROESTE: "NOROESTE",
  "1-NOROESTE": "NOROESTE",
  "1- NOROESTE": "NOROESTE",
  CENTRO: "CENTRO",
  "2- CENTRO": "CENTRO",
  "2-CENTRO": "CENTRO",
  MEDITERRANEO: "MEDITERRANEO",
  "3- MEDITERRANEO": "MEDITERRANEO",
  "3-MEDITERRANEO": "MEDITERRANEO",
  ANDALUCIA: "ANDALUCIA",
  "4- ANDALUCIA": "ANDALUCIA",
  "4-ANDALUCIA": "ANDALUCIA",
  CANARIAS: "CANARIAS",
  "5- CANARIAS": "CANARIAS",
  "5-CANARIAS": "CANARIAS",
  // Subdivisiones geográficas antiguas (migración 009) → macro
  N1: "NOROESTE",
  N2: "NOROESTE",
  Norte: "NOROESTE",
  NORTE: "NOROESTE",
  GAL: "NOROESTE",
  AST: "NOROESTE",
  CYL: "NOROESTE",
  PVA: "NOROESTE",
  ARA: "NOROESTE",
  MAD: "CENTRO",
  CAT: "MEDITERRANEO",
  LEV: "MEDITERRANEO",
  VAL: "MEDITERRANEO",
  SUR: "ANDALUCIA",
  AND: "ANDALUCIA",
  CAN: "CANARIAS",
  Centro: "CENTRO",
};

/** Provincia/localidad → zona macro (calendario PDF, sedes sin columna Zona). */
export const PROVINCE_TO_MACRO_ZONE: Record<string, AepMacroZoneId> = {
  Madrid: "CENTRO",
  Barcelona: "MEDITERRANEO",
  Tarragona: "MEDITERRANEO",
  Lleida: "MEDITERRANEO",
  Girona: "MEDITERRANEO",
  Cataluña: "MEDITERRANEO",
  Valencia: "MEDITERRANEO",
  Castellón: "MEDITERRANEO",
  Alicante: "MEDITERRANEO",
  Murcia: "MEDITERRANEO",
  Baleares: "MEDITERRANEO",
  Mallorca: "MEDITERRANEO",
  Sevilla: "ANDALUCIA",
  Málaga: "ANDALUCIA",
  Granada: "ANDALUCIA",
  Cádiz: "ANDALUCIA",
  Córdoba: "ANDALUCIA",
  Huelva: "ANDALUCIA",
  Almería: "ANDALUCIA",
  Jaén: "ANDALUCIA",
  Andalucía: "ANDALUCIA",
  Ceuta: "ANDALUCIA",
  Melilla: "ANDALUCIA",
  "A Coruña": "NOROESTE",
  "La Coruña": "NOROESTE",
  Pontevedra: "NOROESTE",
  Lugo: "NOROESTE",
  Ourense: "NOROESTE",
  Galicia: "NOROESTE",
  Asturias: "NOROESTE",
  Valladolid: "NOROESTE",
  León: "NOROESTE",
  Salamanca: "NOROESTE",
  Burgos: "NOROESTE",
  Zamora: "NOROESTE",
  Palencia: "NOROESTE",
  Segovia: "NOROESTE",
  Ávila: "NOROESTE",
  Soria: "NOROESTE",
  "Castilla y León": "NOROESTE",
  Vizcaya: "NOROESTE",
  Bizkaia: "NOROESTE",
  Guipúzcoa: "NOROESTE",
  Gipuzkoa: "NOROESTE",
  Álava: "NOROESTE",
  Araba: "NOROESTE",
  "País Vasco": "NOROESTE",
  Cantabria: "NOROESTE",
  Navarra: "NOROESTE",
  "La Rioja": "NOROESTE",
  Zaragoza: "NOROESTE",
  Huesca: "NOROESTE",
  Teruel: "NOROESTE",
  Aragón: "NOROESTE",
  Badajoz: "CENTRO",
  Cáceres: "CENTRO",
  Extremadura: "CENTRO",
  Toledo: "CENTRO",
  "Ciudad Real": "CENTRO",
  Cuenca: "CENTRO",
  Guadalajara: "CENTRO",
  Albacete: "CENTRO",
  "Castilla-La Mancha": "CENTRO",
  "Las Palmas De Gran Canaria": "CANARIAS",
  "Las Palmas": "CANARIAS",
  Tenerife: "CANARIAS",
  Canarias: "CANARIAS",
};

/** @deprecated Usar `PROVINCE_TO_MACRO_ZONE`. */
export const PROVINCE_TO_GEOGRAPHIC_ZONE = PROVINCE_TO_MACRO_ZONE;

export function resolveZoneCode(
  code: string | null | undefined,
): AepMacroZoneId | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  if (!trimmed) return undefined;

  const direct = LEGACY_ZONE_CODE_MAP[trimmed];
  if (direct) return direct;

  const upper = LEGACY_ZONE_CODE_MAP[normalizeZoneKey(trimmed)];
  if (upper) return upper;

  const key = normalizeZoneKey(trimmed);
  if (key.includes("NOROESTE")) return "NOROESTE";
  if (key.includes("CENTRO")) return "CENTRO";
  if (key.includes("MEDITERRAN")) return "MEDITERRANEO";
  if (key.includes("ANDALUCIA")) return "ANDALUCIA";
  if (key.includes("CANARIAS")) return "CANARIAS";

  if (MACRO_NAME_BY_ID[trimmed as AepMacroZoneId]) {
    return trimmed as AepMacroZoneId;
  }

  return undefined;
}

export function macroZoneName(macroId: string): string {
  return MACRO_NAME_BY_ID[macroId as AepMacroZoneId] ?? macroId;
}

/** @deprecated Usar `macroZoneName`. */
export function geographicZoneName(geographicId: string): string {
  return macroZoneName(geographicId);
}

export function zoneDisplayName(code: string | null | undefined): string {
  const resolved = resolveZoneCode(code);
  if (!resolved) return code?.trim() || "—";
  return macroZoneName(resolved);
}

export function zoneUiName(code: string | null | undefined): string {
  const raw = zoneDisplayName(code);
  return raw.replace(/^\d+\-\s*/, "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeZoneInput(zona?: string | null): string | null {
  return resolveZoneCode(zona) ?? null;
}

/** Clave de provincia sin acentos ni mayúsculas, para casar imports en MAYÚS. */
function normalizeProvinceKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, "")
    .toLowerCase()
    .trim();
}

const NORMALIZED_PROVINCE_TO_MACRO_ZONE: Record<string, AepMacroZoneId> =
  Object.fromEntries(
    Object.entries(PROVINCE_TO_MACRO_ZONE).map(([k, v]) => [normalizeProvinceKey(k), v]),
  );

export function deduceMacroZone(
  provincia: string | undefined,
  localidad: string,
): AepMacroZoneId | undefined {
  const candidates: string[] = [];
  if (provincia) candidates.push(provincia);
  candidates.push(localidad.replace(/\([^)]*\)/g, ""));
  for (const c of candidates) {
    const zone = NORMALIZED_PROVINCE_TO_MACRO_ZONE[normalizeProvinceKey(c)];
    if (zone) return zone;
  }
  return undefined;
}

/** @deprecated Usar `deduceMacroZone`. */
export const deduceGeographicZone = deduceMacroZone;
