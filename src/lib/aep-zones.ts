import type { Zone } from "@/lib/types";

/** Zonas geográficas oficiales AEP 2026 (§4.1 Guía AEP). Código canónico en BD y RBAC. */
export const AEP_GEOGRAPHIC_ZONES = [
  {
    id: "N1",
    name: "Zona norte 1",
    provinces: ["Galicia", "Asturias", "Castilla y León"],
  },
  {
    id: "N2",
    name: "Zona norte 2",
    provinces: [
      "Cantabria",
      "País Vasco",
      "Navarra",
      "La Rioja",
      "Aragón",
    ],
  },
  {
    id: "CENTRO",
    name: "Zona centro",
    provinces: ["Extremadura", "Castilla-La Mancha"],
  },
  {
    id: "MAD",
    name: "Zona Madrid",
    provinces: ["Madrid"],
  },
  {
    id: "CAT",
    name: "Zona Cataluña",
    provinces: ["Cataluña"],
  },
  {
    id: "LEV",
    name: "Zona levante e islas",
    provinces: ["Valencia", "Murcia", "Baleares"],
  },
  {
    id: "SUR",
    name: "Zona sur",
    provinces: ["Andalucía", "Ceuta", "Melilla"],
  },
  {
    id: "CAN",
    name: "Zona Canarias",
    provinces: ["Canarias"],
  },
] as const;

export type AepGeographicZoneId = (typeof AEP_GEOGRAPHIC_ZONES)[number]["id"];

/** Listado para selects, seed y mock (`zones` en Supabase). */
export const AEP_ZONES: Zone[] = AEP_GEOGRAPHIC_ZONES.map((z) => ({
  code: z.id,
  name: z.name,
}));

/** Códigos CCAA/provincia históricos en Tarima → zona geográfica 2026. */
export const LEGACY_ZONE_CODE_MAP: Record<string, AepGeographicZoneId> = {
  AND: "SUR",
  VAL: "LEV",
  GAL: "N1",
  AST: "N1",
  CYL: "N1",
  PVA: "N2",
  ARA: "N2",
  Centro: "CENTRO",
  CENTRO: "CENTRO",
  Norte: "N1",
  NORTE: "N1",
  MAD: "MAD",
  CAT: "CAT",
  CAN: "CAN",
  N1: "N1",
  N2: "N2",
  LEV: "LEV",
  SUR: "SUR",
};

/** Provincia o localidad → código zona geográfica (import calendario, sedes). */
export const PROVINCE_TO_GEOGRAPHIC_ZONE: Record<string, AepGeographicZoneId> = {
  Madrid: "MAD",
  Barcelona: "CAT",
  Tarragona: "CAT",
  Lleida: "CAT",
  Girona: "CAT",
  Cataluña: "CAT",
  Valencia: "LEV",
  Castellón: "LEV",
  Alicante: "LEV",
  Murcia: "LEV",
  Baleares: "LEV",
  Mallorca: "LEV",
  Sevilla: "SUR",
  Málaga: "SUR",
  Granada: "SUR",
  Cádiz: "SUR",
  Córdoba: "SUR",
  Huelva: "SUR",
  Almería: "SUR",
  Jaén: "SUR",
  Andalucía: "SUR",
  Ceuta: "SUR",
  Melilla: "SUR",
  "A Coruña": "N1",
  "La Coruña": "N1",
  Pontevedra: "N1",
  Lugo: "N1",
  Ourense: "N1",
  Galicia: "N1",
  Asturias: "N1",
  Valladolid: "N1",
  León: "N1",
  Salamanca: "N1",
  Burgos: "N1",
  Zamora: "N1",
  Palencia: "N1",
  Segovia: "N1",
  Ávila: "N1",
  Soria: "N1",
  "Castilla y León": "N1",
  Vizcaya: "N2",
  Bizkaia: "N2",
  Guipúzcoa: "N2",
  Gipuzkoa: "N2",
  Álava: "N2",
  Araba: "N2",
  "País Vasco": "N2",
  Cantabria: "N2",
  Navarra: "N2",
  "La Rioja": "N2",
  Zaragoza: "N2",
  Huesca: "N2",
  Teruel: "N2",
  Aragón: "N2",
  Badajoz: "CENTRO",
  Cáceres: "CENTRO",
  Extremadura: "CENTRO",
  Toledo: "CENTRO",
  "Ciudad Real": "CENTRO",
  Cuenca: "CENTRO",
  Guadalajara: "CENTRO",
  Albacete: "CENTRO",
  "Castilla-La Mancha": "CENTRO",
  "Las Palmas De Gran Canaria": "CAN",
  "Las Palmas": "CAN",
  Tenerife: "CAN",
  Canarias: "CAN",
};

const GEOGRAPHIC_NAME_BY_ID = Object.fromEntries(
  AEP_GEOGRAPHIC_ZONES.map((z) => [z.id, z.name]),
) as Record<string, string>;

/** Normaliza código almacenado (legacy CCAA o alias) → id geográfico 2026. */
export function resolveZoneCode(
  code: string | null | undefined,
): AepGeographicZoneId | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  const direct = LEGACY_ZONE_CODE_MAP[trimmed];
  if (direct) return direct;
  const upper = LEGACY_ZONE_CODE_MAP[trimmed.toUpperCase()];
  if (upper) return upper;
  if (GEOGRAPHIC_NAME_BY_ID[trimmed]) return trimmed as AepGeographicZoneId;
  return undefined;
}

export function geographicZoneName(geographicId: string): string {
  return GEOGRAPHIC_NAME_BY_ID[geographicId] ?? geographicId;
}

export function zoneDisplayName(code: string | null | undefined): string {
  const resolved = resolveZoneCode(code);
  if (!resolved) return code?.trim() || "—";
  return geographicZoneName(resolved);
}

/** Valor listo para persistir en BD (migra códigos legacy). */
export function normalizeZoneInput(
  zona?: string | null,
): string | null {
  return resolveZoneCode(zona) ?? null;
}

export function deduceGeographicZone(
  provincia: string | undefined,
  localidad: string,
): AepGeographicZoneId | undefined {
  const candidates: string[] = [];
  if (provincia) candidates.push(provincia.replace(/\(|\)/g, "").trim());
  candidates.push(localidad.replace(/\([^)]*\)/g, "").trim());
  for (const c of candidates) {
    if (PROVINCE_TO_GEOGRAPHIC_ZONE[c]) return PROVINCE_TO_GEOGRAPHIC_ZONE[c];
  }
  return undefined;
}
