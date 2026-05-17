import { validateAssignment } from "@/lib/roster-rules";
import type {
  AssignmentsMap,
  EventType,
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
  const base = validateAssignment(referee, roleKey, eventType);
  if (!base.ok) return base.error ?? "No se puede asignar";
  const reg = findRegulationViolation(roleKey, eventType, referee.nivel, regulations);
  if (reg) return `Normativa: mínimo ${reg.minLevel} (${reg.rol})`;
  return null;
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

export type RosterWorkflowStep = "plantilla" | "asignacion" | "revision";

export const ROSTER_STEP_LABELS: Record<RosterWorkflowStep, string> = {
  plantilla: "Plantilla",
  asignacion: "Asignación",
  revision: "Revisión",
};
