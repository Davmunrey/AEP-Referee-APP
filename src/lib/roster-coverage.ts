import { countOpenSlots } from "@/lib/roster-rules";
import { enumerateSlotKeys } from "@/lib/roster-template";
import type { AssignmentsMap, Competition, EventStatus, RosterSession } from "@/lib/types";

export const ROSTER_APPROVAL_LOCKED = "Aprobado";
export const ROSTER_IMPREVISTO_STATE = "Cambio por imprevisto";

export type RosterCoverage = {
  requeridos: number;
  confirmados: number;
  openSlots: number;
  pct: number;
};

export function countRequiredSlots(template: RosterSession[]): number {
  let total = 0;
  for (const session of template) {
    for (const role of session.roles) total += role.slots;
    for (const role of session.pesajeRoles ?? []) total += role.slots;
  }
  return total;
}

export function countFilledSlots(
  template: RosterSession[],
  assignments: Record<string, string>,
): number {
  const validKeys = new Set(enumerateSlotKeys(template));
  return Object.entries(assignments).filter(
    ([key, refereeId]) => Boolean(refereeId) && validKeys.has(key),
  ).length;
}

/** Cobertura unificada: misma lógica en listados, tarima y persistencia. */
export function computeRosterCoverage(
  template: RosterSession[],
  assignments: Record<string, string>,
  fallbackRequeridos = 0,
): RosterCoverage {
  const fromTemplate = countRequiredSlots(template);
  const requeridos = fromTemplate > 0 ? fromTemplate : Math.max(0, fallbackRequeridos);

  if (template.length === 0) {
    const confirmados = Object.values(assignments).filter(Boolean).length;
    const openSlots = Math.max(0, requeridos - confirmados);
    const pct =
      requeridos > 0 ? Math.min(100, Math.round((confirmados / requeridos) * 100)) : 0;
    return { requeridos, confirmados, openSlots, pct };
  }

  const openSlots = countOpenSlots(template, assignments);
  const confirmados = Math.max(0, requeridos - openSlots);
  const pct =
    requeridos > 0 ? Math.min(100, Math.round((confirmados / requeridos) * 100)) : 0;
  return { requeridos, confirmados, openSlots, pct };
}

/** IDs únicos con plaza válida en plantilla (ignora claves huérfanas). */
export function assignedRefereeIdsInTemplate(
  template: RosterSession[],
  assignments: AssignmentsMap,
): Set<string> {
  const validKeys = new Set(enumerateSlotKeys(template));
  const ids = new Set<string>();
  for (const [key, refereeId] of Object.entries(assignments)) {
    if (refereeId && validKeys.has(key)) ids.add(refereeId);
  }
  return ids;
}

/** Métricas de cobertura + jueces únicos para analítica y agregados. */
export function rosterAnalyticsStats(
  template: RosterSession[],
  assignments: AssignmentsMap,
  fallbackRequeridos = 0,
) {
  const coverage = computeRosterCoverage(template, assignments, fallbackRequeridos);
  return {
    requiredSlots: coverage.requeridos,
    filledSlots: coverage.confirmados,
    openSlots: coverage.openSlots,
    pct: coverage.pct,
    refereeIds: assignedRefereeIdsInTemplate(template, assignments),
  };
}

export function deriveCompetitionEstado(
  coverage: Pick<RosterCoverage, "confirmados" | "openSlots" | "requeridos">,
): EventStatus {
  if (coverage.requeridos > 0 && coverage.openSlots === 0) return "Completo";
  if (coverage.confirmados === 0) return "Borrador";
  if (coverage.openSlots > 5) return "Crítico";
  return "Incompleto";
}

export function applyCoverageToCompetition(
  competition: Competition,
  template: RosterSession[],
  assignments: Record<string, string>,
): Competition {
  const coverage = computeRosterCoverage(template, assignments, competition.requeridos);
  return {
    ...competition,
    requeridos: coverage.requeridos,
    confirmados: coverage.confirmados,
    estado: deriveCompetitionEstado(coverage),
  };
}

export function isRosterLockedByApproval(aprobacion: string): boolean {
  return aprobacion === ROSTER_APPROVAL_LOCKED;
}

export function isRosterImprevistoMode(aprobacion: string): boolean {
  return aprobacion === ROSTER_IMPREVISTO_STATE;
}

export function rosterCoverageLabel(coverage: Pick<RosterCoverage, "confirmados" | "requeridos" | "pct">): string {
  return `${coverage.confirmados}/${coverage.requeridos} · ${coverage.pct}%`;
}

export function rosterMutationBlockedMessage(aprobacion: string): string | null {
  if (!isRosterLockedByApproval(aprobacion)) return null;
  return "La tarima está aprobada. Usa «Registrar imprevisto» en la cabecera para permitir cambios.";
}
