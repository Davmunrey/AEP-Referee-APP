import { resolveZoneCode } from "@/lib/aep-zones";
import {
  minLevelForRole,
  validateAssignment,
  validateRosterOperation,
} from "@/lib/roster-rules";
import { enumerateSlotKeys, parseSlotKey, ROLE_LABELS } from "@/lib/roster-template";
import { meetsRefereeLevel } from "@/lib/referee-levels";
import type {
  AssignmentsMap,
  EventType,
  FlagsMap,
  Referee,
  RefereeLevel,
  RegulationRule,
  RoleKey,
  RosterSession,
} from "@/lib/types";

const meetsMinLevel = meetsRefereeLevel;

/**
 * La regla de normativa que incumple esta designación, si hay alguna.
 *
 * Estaba cortada en seco con `if (roleKey !== "jurado") return undefined`, así
 * que de toda la tabla de normativa —la que la aplicación enseña en
 * `/regulations` como la norma de la federación— solo se consultaba una fila.
 * Las demás estaban escritas, sembradas y a la vista, y no producían ningún
 * aviso: un juez Regional de Juez Central en un AEP-1 pasaba sin que nadie
 * dijera nada, con «mínimo Nacional» escrito en la propia pantalla de
 * normativa.
 */
export function findRegulationViolation(
  roleKey: RoleKey,
  eventType: EventType,
  nivel: RefereeLevel,
  regulations: RegulationRule[],
): RegulationRule | undefined {
  // De las reglas que este juez incumple se avisa de la MÁS exigente, no de la
  // primera de la lista. Con `.find()` bastaba con que hubiera dos filas para
  // el mismo rol y tipo —algo que la pantalla de normativa no impide— para que
  // el aviso dependiera del orden de los identificadores y acabara enseñando
  // el mínimo más flojo de los dos.
  let peor: RegulationRule | undefined;
  for (const r of regulations) {
    if (r.roleKey !== roleKey) continue;
    if (!r.eventTypes.includes(eventType)) continue;
    if (meetsMinLevel(nivel, r.minLevel)) continue;
    if (!peor || !meetsMinLevel(peor.minLevel, r.minLevel)) peor = r;
  }
  return peor;
}

/** Motivo por el que un juez no puede ocupar un rol; `null` = asignable. */
export function getAssignabilityReason(
  referee: Referee,
  roleKey: RoleKey,
  eventType: EventType,
  regulations: RegulationRule[],
): string | null {
  void regulations;
  const base = validateAssignment(referee, roleKey, eventType);
  if (!base.ok) return base.error ?? "No se puede asignar";
  return null;
}

export function getRecommendationWarning(
  referee: Referee,
  roleKey: RoleKey,
  eventType: EventType,
  regulations: RegulationRule[],
): string | null {
  const reg = findRegulationViolation(roleKey, eventType, referee.nivel, regulations);
  if (reg) return `Recomendado ${reg.minLevel} para ${reg.rol}`;
  // Red de seguridad para cuando la normativa no dice nada de este rol, o no
  // se pudo leer y llega vacía: el mínimo por defecto que la aplicación lleva
  // dentro. Antes esta rama solo cubría «jurado», de modo que sin tabla no
  // quedaba ni un aviso en toda la tarima.
  const minimo = minLevelForRole(roleKey, eventType);
  if (!meetsMinLevel(referee.nivel, minimo)) {
    return `Recomendado ${minimo} para ${ROLE_LABELS[roleKey] ?? roleKey}`;
  }
  return null;
}

export interface OperationalBlock {
  reason: string;
  /** Se puede forzar marcando el puesto como compartido (*). */
  overridable: boolean;
}

/** Conflicto operativo del slot, con si es forzable mediante el flag compartido (*). */
export function getOperationalBlock(input: {
  template: RosterSession[];
  assignments: AssignmentsMap;
  slotKey: string;
  refereeId: string;
  flags?: FlagsMap;
}): OperationalBlock | null {
  const validation = validateRosterOperation(input);
  if (validation.ok) return null;
  return {
    reason: validation.error ?? "No se puede asignar",
    overridable: Boolean(validation.overridable),
  };
}

/**
 * Huecos de la plantilla. Misma cuenta que `countRequiredSlots`: la lista
 * canónica, no la suma de `slots`, que cuenta de más en cuanto una sesión
 * repite un rol.
 */
export function countRosterSlots(template: RosterSession[]): number {
  return enumerateSlotKeys(template).length;
}

export function countFilledAssignments(assignments: AssignmentsMap): number {
  return Object.values(assignments).filter(Boolean).length;
}

/**
 * Cuántas designaciones incumplen la normativa.
 *
 * Enumeraba los huecos por su cuenta —recorriendo `slots` sesión a sesión— en
 * vez de pedirle la lista a `enumerateSlotKeys`, que es quien la define para
 * el resto de la aplicación. Y esa lista quita repetidos: dos filas del mismo
 * rol en una sesión, o dos sesiones con el mismo código, comparten clave de
 * hueco. Aquí no se quitaban, así que la MISMA designación se contaba dos
 * veces y el aviso decía «2 avisos de normativa» donde había uno.
 *
 * Es el número que mira quien monta la tarima para saber si puede enviarla:
 * inflarlo manda a buscar un problema que no existe.
 */
export function countRegulationViolations(
  template: RosterSession[],
  assignments: AssignmentsMap,
  eventType: EventType,
  getNivel: (refereeId: string) => RefereeLevel | undefined,
  regulations: RegulationRule[],
): number {
  let count = 0;
  for (const key of enumerateSlotKeys(template)) {
    const refId = assignments[key];
    if (!refId) continue;
    const parsed = parseSlotKey(key);
    if (!parsed) continue;
    const nivel = getNivel(refId) ?? "Regional";
    if (findRegulationViolation(parsed.roleKey, eventType, nivel, regulations)) count++;
  }
  return count;
}

/** Contexto para puntuar/ordenar jueces candidatos a un hueco (selección rápida). */
export interface SlotSuggestionContext {
  slotKey: string;
  roleKey: RoleKey;
  eventType: EventType;
  competitionZona?: string;
  template: RosterSession[];
  assignments: AssignmentsMap;
  flags?: FlagsMap;
  regulations: RegulationRule[];
  /** Jueces con disponibilidad confirmada para la competición. */
  confirmedIds?: Set<string>;
  /** Jueces ya asignados en la competición (para des-priorizarlos). */
  assignedIds?: Set<string>;
  /** Jueces ya asignados en OTRO campeonato que solapa fechas con este. */
  busyElsewhereIds?: Set<string>;
}

function zonesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return (resolveZoneCode(a) ?? a) === (resolveZoneCode(b) ?? b);
}

/** Peso dominante: la selección rápida va DESPUÉS de la disponibilidad, así que
 * un juez que ha confirmado disponibilidad siempre se ordena por encima de uno
 * que no, entre los asignables. Los criterios finos (zona, nivel, solape) solo
 * desempatan dentro de cada grupo. */
const AVAILABILITY_TIER = 500;

/**
 * Idoneidad de un juez para un hueco (mayor = mejor). Los inasignables (inactivo,
 * no disponible, o conflicto no forzable) quedan al fondo con puntuación negativa.
 * Entre los asignables manda la DISPONIBILIDAD confirmada; luego misma zona y
 * nivel adecuado desempatan.
 */
export function scoreRefereeForSlot(referee: Referee, ctx: SlotSuggestionContext): number {
  const hardBlock = getAssignabilityReason(referee, ctx.roleKey, ctx.eventType, ctx.regulations);
  if (hardBlock) return -1000;
  const op = getOperationalBlock({
    template: ctx.template,
    assignments: ctx.assignments,
    slotKey: ctx.slotKey,
    refereeId: referee.id,
    flags: ctx.flags,
  });
  if (op && !op.overridable) return -900;

  let score = 100;
  // La disponibilidad es el criterio dominante (tras el paso de disponibilidad).
  if (ctx.confirmedIds?.has(referee.id)) score += AVAILABILITY_TIER;
  if (op?.overridable) score -= 40; // solape forzable con *
  if (getRecommendationWarning(referee, ctx.roleKey, ctx.eventType, ctx.regulations)) score -= 20;
  if (ctx.competitionZona && zonesMatch(referee.zona, ctx.competitionZona)) score += 15; // misma zona
  if (ctx.assignedIds?.has(referee.id)) score -= 12; // ya ocupado en la competición
  // Ya está en otro campeonato de estas fechas: no se bloquea (la decisión es
  // de quien monta la tarima), pero deja de proponerse el primero.
  if (ctx.busyElsewhereIds?.has(referee.id)) score -= 60;
  return score;
}

/** Ordena los jueces por idoneidad para el hueco (estable ante empates). */
export function rankRefereesForSlot(referees: Referee[], ctx: SlotSuggestionContext): Referee[] {
  return referees
    .map((referee, index) => ({ referee, index, score: scoreRefereeForSlot(referee, ctx) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.referee);
}

export type RosterWorkflowStep = "plantilla" | "asignacion" | "revision";

export const ROSTER_STEP_LABELS: Record<RosterWorkflowStep, string> = {
  plantilla: "Plantilla",
  asignacion: "Asignación",
  revision: "Revisión",
};
