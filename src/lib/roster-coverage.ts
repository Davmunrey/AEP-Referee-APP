import { countOpenSlots } from "@/lib/roster-rules";
import { enumerateSlotKeys } from "@/lib/roster-template";
import type { AssignmentsMap, Competition, EventStatus, RosterSession } from "@/lib/types";

export const ROSTER_APPROVAL_LOCKED = "Aprobado";
/** Propuesta enviada y esperando decisión nacional. */
export const ROSTER_PENDING_APPROVAL = "Propuesta enviada";
export const ROSTER_IMPREVISTO_STATE = "Cambio por imprevisto";
/** Propuesta revisada y devuelta a la zona. */
export const ROSTER_REJECTED = "Rechazado";

export type RosterCoverage = {
  requeridos: number;
  confirmados: number;
  openSlots: number;
  pct: number;
};

/**
 * Porcentaje de cobertura: única fórmula para toda la aplicación.
 *
 * Estaba copiada en seis sitios y en tres variantes: los listados capaban al
 * 100 % y devolvían 0 sin plazas requeridas, la exportación CSV no capaba, y el
 * panel (previsión y radar) además devolvía **100 %** cuando no había nada que
 * cubrir — un campeonato sin plantilla salía con la barra verde llena en el
 * panel y al 0 % en la tabla de campeonatos.
 */
export function coveragePct(confirmados: number, requeridos: number): number {
  // `!(x > 0)` cubre también NaN, que llegaba de columnas numéricas nulas o de
  // plantillas con `slots` en texto y se pintaba como «NaN%».
  if (!(requeridos > 0) || !Number.isFinite(confirmados)) return 0;
  return Math.min(100, Math.max(0, Math.round((confirmados / requeridos) * 100)));
}

/**
 * Plazas requeridas = huecos realmente asignables.
 *
 * Sumar `slots` contaba de más cuando una sesión repetía un rol (dos filas
 * «Juez Central»): esas filas comparten clave de hueco, así que la plaza
 * sobrante no existía y no había forma de cubrirla.
 */
export function countRequiredSlots(template: RosterSession[]): number {
  return enumerateSlotKeys(template).length;
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

  // Sin plantilla, o plantilla presente pero sin slots reales (todos slots:0):
  // cuenta confirmados desde las asignaciones reales. Antes, con fromTemplate=0
  // se fabricaba confirmados = requeridos - openSlots → falso 100%/«Completo».
  if (template.length === 0 || fromTemplate === 0) {
    const confirmados = Object.values(assignments).filter(Boolean).length;
    const openSlots = Math.max(0, requeridos - confirmados);
    return { requeridos, confirmados, openSlots, pct: coveragePct(confirmados, requeridos) };
  }

  const openSlots = countOpenSlots(template, assignments);
  const confirmados = Math.max(0, requeridos - openSlots);
  return { requeridos, confirmados, openSlots, pct: coveragePct(confirmados, requeridos) };
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

/**
 * Compara un estado de aprobación con su valor canónico.
 *
 * `aprobacion` es TEXT y lo escriben varios caminos: la app, la importación de
 * calendario y, alguna vez, una mano en el editor de Supabase. Comparar con
 * `===` exacto hacía que «Aprobado » con un espacio de más, o «aprobado» en
 * minúscula, no fuera reconocido — y como de ese reconocimiento depende
 * CONGELAR la tarima, un estado con un espacio la dejaba editable: se podía
 * tocar una tarima ya aprobada y el acta dejaba de coincidir con lo aprobado,
 * que es justo lo que la congelación existe para impedir.
 *
 * `isRosterRejected` ya normalizaba; los que cierran la puerta, no.
 */
function mismoEstado(aprobacion: string | null | undefined, canonico: string): boolean {
  return (aprobacion ?? "").trim().toLowerCase().replace(/\s+/g, " ") === canonico.toLowerCase();
}

export function isRosterLockedByApproval(aprobacion: string | undefined): boolean {
  return mismoEstado(aprobacion, ROSTER_APPROVAL_LOCKED);
}

/**
 * Este se queda con la comparación exacta a propósito: el modo imprevisto
 * ABRE la tarima, así que aflojar el reconocimiento sería aflojar el cierre.
 * Lo escribe siempre la propia aplicación, con el valor canónico.
 */
export function isRosterImprevistoMode(aprobacion: string): boolean {
  return aprobacion === ROSTER_IMPREVISTO_STATE;
}

/**
 * Con propuesta pendiente la tarima queda congelada.
 *
 * La propuesta guarda un *snapshot* de las asignaciones y la aprobación lo
 * reinserta borrando lo que haya. Mientras se pudo editar en esa ventana, todo
 * cambio hecho entre el envío y la aprobación se perdía en silencio: ni quien
 * lo hizo ni quien aprobaba se enteraban. Congelando, el snapshot y la tarima
 * no pueden divergir.
 */
export function isRosterPendingApproval(aprobacion: string | undefined): boolean {
  return mismoEstado(aprobacion, ROSTER_PENDING_APPROVAL);
}

/** La última revisión devolvió la tarima a la zona. */
export function isRosterRejected(aprobacion: string | null | undefined): boolean {
  return mismoEstado(aprobacion, ROSTER_REJECTED);
}

/** Cualquiera de los dos estados que impiden tocar la tarima. */
export function isRosterFrozen(aprobacion: string | undefined): boolean {
  return isRosterLockedByApproval(aprobacion) || isRosterPendingApproval(aprobacion);
}

export function rosterCoverageLabel(coverage: Pick<RosterCoverage, "confirmados" | "requeridos" | "pct">): string {
  return `${coverage.confirmados}/${coverage.requeridos} · ${coverage.pct}%`;
}

export function rosterMutationBlockedMessage(aprobacion: string): string | null {
  if (isRosterLockedByApproval(aprobacion)) {
    return "La tarima está aprobada. Usa «Registrar imprevisto» en la cabecera para permitir cambios.";
  }
  if (isRosterPendingApproval(aprobacion)) {
    return "La tarima está pendiente de aprobación. Usa «Retirar propuesta» en la cabecera para volver a editarla.";
  }
  return null;
}
