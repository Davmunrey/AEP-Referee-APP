import { resolveZoneCode } from "@/lib/aep-zones";
import {
  isBelowRecommendedLevel,
  validateAssignment,
  validateRosterOperation,
} from "@/lib/roster-rules";
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

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];

function meetsMinLevel(actual: RefereeLevel, min: RefereeLevel): boolean {
  return LEVEL_ORDER.indexOf(actual) >= LEVEL_ORDER.indexOf(min);
}

export function findRegulationViolation(
  roleKey: RoleKey,
  eventType: EventType,
  nivel: RefereeLevel,
  regulations: RegulationRule[],
): RegulationRule | undefined {
  if (roleKey !== "jurado") return undefined;
  return regulations.find(
    (r) =>
      r.roleKey === roleKey &&
      r.eventTypes.includes(eventType) &&
      !meetsMinLevel(nivel, r.minLevel),
  );
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
  if (isBelowRecommendedLevel(referee.nivel, roleKey)) return "Recomendado IPF Cat. para jurado";
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

export function countRosterSlots(template: RosterSession[]): number {
  return template.reduce(
    (acc, s) =>
      acc +
      s.roles.reduce((a, r) => a + r.slots, 0) +
      (s.pesajeRoles ?? []).reduce((a, r) => a + r.slots, 0),
    0,
  );
}

export function countFilledAssignments(assignments: AssignmentsMap): number {
  return Object.values(assignments).filter(Boolean).length;
}

export function countRegulationViolations(
  template: RosterSession[],
  assignments: AssignmentsMap,
  eventType: EventType,
  getNivel: (refereeId: string) => RefereeLevel | undefined,
  regulations: RegulationRule[],
): number {
  let count = 0;
  for (const session of template) {
    const allRoles = [...session.roles, ...(session.pesajeRoles ?? [])];
    for (const role of allRoles) {
      for (let i = 0; i < role.slots; i++) {
        const key = `${session.sesion}_${role.key}_${i}`;
        const refId = assignments[key];
        if (!refId) continue;
        const nivel = getNivel(refId) ?? "Regional";
        if (findRegulationViolation(role.key, eventType, nivel, regulations)) count++;
      }
    }
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
}

function zonesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return (resolveZoneCode(a) ?? a) === (resolveZoneCode(b) ?? b);
}

/**
 * Idoneidad de un juez para un hueco (mayor = mejor). Los inasignables (inactivo,
 * no disponible, o conflicto no forzable) quedan al fondo con puntuación negativa;
 * el resto se ordena por disponibilidad confirmada, misma zona y nivel adecuado.
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
  if (op?.overridable) score -= 40; // solape forzable con *
  if (getRecommendationWarning(referee, ctx.roleKey, ctx.eventType, ctx.regulations)) score -= 20;
  if (ctx.confirmedIds?.has(referee.id)) score += 30; // disponibilidad confirmada
  if (ctx.competitionZona && zonesMatch(referee.zona, ctx.competitionZona)) score += 15; // misma zona
  if (ctx.assignedIds?.has(referee.id)) score -= 12; // ya ocupado en la competición
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
