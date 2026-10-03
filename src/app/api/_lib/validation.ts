import type { EventType, RefereeLevel, RefereeStatus } from "@/lib/types";
import { REFEREE_LEVEL_ORDER } from "@/lib/referee-levels";

/**
 * Whitelists de enums para validar payloads de la API.
 *
 * `src/lib/types` solo declara estos enums como uniones de tipos (no existen
 * arrays en runtime), así que los valores viven aquí. `satisfies` garantiza en
 * compilación que cada literal pertenece a la unión; si la unión gana un nuevo
 * miembro, hay que añadirlo también a la lista correspondiente.
 */
export const EVENT_TYPES = ["AEP-1", "AEP-2", "AEP-3"] as const satisfies readonly EventType[];

/**
 * Los cuatro niveles, para validar entrada. Sale del escalafón para que no
 * puedan divergir en miembros —y para que su orden deje de ser una trampa:
 * tenía «IPF Cat. 1» antes que «IPF Cat. 2», así que quien la reutilizara para
 * ordenar invertía la cima del escalafón sin que ningún tipo se quejara.
 */
export const REFEREE_LEVELS: readonly RefereeLevel[] = REFEREE_LEVEL_ORDER;

export const REFEREE_STATUSES = [
  "Activo",
  "Inactivo",
  "Sancionado",
] as const satisfies readonly RefereeStatus[];

/** Formato de fecha ISO corto (AAAA-MM-DD). Solo la forma: ver `isIsoDate`. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ¿Es una fecha AAAA-MM-DD que EXISTE en el calendario?
 *
 * Validar solo con el patrón dejaba pasar «2026-02-30» o «2026-13-01»: en
 * memoria se guardaban tal cual y en Supabase la columna `DATE` las rechazaba
 * con un 500 genérico en vez de un 400 que dijera qué estaba mal.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

export function isRefereeLevel(value: unknown): value is RefereeLevel {
  return typeof value === "string" && (REFEREE_LEVELS as readonly string[]).includes(value);
}

export function isRefereeStatus(value: unknown): value is RefereeStatus {
  return typeof value === "string" && (REFEREE_STATUSES as readonly string[]).includes(value);
}

/**
 * Valida los campos base de un campeonato (POST y PATCH de /competitions).
 * Solo valida los campos presentes (`undefined` = no enviado). Para el cruce
 * fecha/fechaFin en un PATCH parcial se puede pasar `baseline` con los valores
 * actuales de la competición.
 *
 * @returns mensaje de error legible, o `null` si todo es válido.
 */
export function validateCompetitionFields(
  fields: {
    tipo?: string;
    fecha?: string;
    fechaFin?: string;
    sesiones?: number;
    requeridos?: number;
  },
  baseline?: { fecha: string; fechaFin: string },
): string | null {
  if (fields.tipo !== undefined && !isEventType(fields.tipo)) {
    return `Tipo de campeonato no válido. Valores permitidos: ${EVENT_TYPES.join(", ")}`;
  }
  if (fields.fecha !== undefined && !isIsoDate(fields.fecha)) {
    return "La fecha de inicio no es válida (formato AAAA-MM-DD)";
  }
  if (fields.fechaFin !== undefined && !isIsoDate(fields.fechaFin)) {
    return "La fecha de fin no es válida (formato AAAA-MM-DD)";
  }
  const fecha = fields.fecha ?? baseline?.fecha;
  const fechaFin = fields.fechaFin ?? baseline?.fechaFin;
  if (
    (fields.fecha !== undefined || fields.fechaFin !== undefined) &&
    fecha !== undefined &&
    fechaFin !== undefined &&
    fechaFin < fecha
  ) {
    return "La fecha de fin no puede ser anterior a la de inicio";
  }
  if (
    fields.sesiones !== undefined &&
    (!Number.isFinite(fields.sesiones) || fields.sesiones < 1 || fields.sesiones > 6)
  ) {
    return "Las sesiones deben estar entre 1 y 6";
  }
  if (
    fields.requeridos !== undefined &&
    (!Number.isFinite(fields.requeridos) || fields.requeridos < 1)
  ) {
    return "Las plazas requeridas deben ser al menos 1";
  }
  return null;
}
