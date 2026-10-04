import { zoneVisibilityFilter } from "@/lib/zone-scope";
import {
  computeRosterCoverage,
  deriveCompetitionEstado,
} from "@/lib/roster-coverage";
import { buildRefereeCompetitionHistory } from "@/lib/referee-competition-history";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import type {
  DashboardKpi,
  RefereeCompetitionHistoryItem,
  SessionUser,
  SlotFlags,
} from "@/lib/types";
import {
  getCalendarEvents,
  getCompetitionTemplate,
  getLevels,
  getStore,
  getZones,
} from "@/server/store";
import { isCompetitionPast } from "@/lib/competition-status";
import { applyCoverageToCompetition, rosterAnalyticsStats } from "@/lib/roster-coverage";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";

/** Bitácora de salud en memoria (modo dev sin Supabase). */
export const healthHistory: { score: number; at: number }[] = [];

export { parseSlotKey } from "@/lib/roster-template";

export function syncCompetitionCoverage(competitionId: string) {
  const store = getStore();
  const comp = store.competitions.find((c) => c.id === competitionId);
  if (!comp) return;
  const assignments = store.assignments.get(competitionId) ?? {};
  const template = getCompetitionTemplate(competitionId);
  const coverage = computeRosterCoverage(template, assignments, comp.requeridos);
  comp.confirmados = coverage.confirmados;
  comp.requeridos = coverage.requeridos;
  comp.estado = deriveCompetitionEstado(coverage);
}

/** Reexportado: la fuente está en `@/lib/season`. */
export { yearFromIso } from "@/lib/season";

export function buildMemoryCompetitionHistory(refereeId: string): RefereeCompetitionHistoryItem[] {
  const store = getStore();
  const rows: Array<{ competitionId: string; slotKey: string; flags?: SlotFlags }> = [];
  for (const [competitionId, assignments] of store.assignments.entries()) {
    const flags = store.slotFlags.get(competitionId) ?? {};
    for (const [slotKey, assignedRefereeId] of Object.entries(assignments)) {
      if (assignedRefereeId !== refereeId) continue;
      rows.push({ competitionId, slotKey, flags: flags[slotKey] });
    }
  }
  return buildRefereeCompetitionHistory(store.competitions, rows);
}

/**
 * Campeonatos del panel con su cobertura VIVA (plantilla + asignaciones), igual
 * que el gemelo de Supabase. El `estado`/`confirmados` guardado en el store
 * puede ir atrasado y el panel no debe enseñar dos cifras del mismo campeonato.
 */
export function liveDashboardData(user?: SessionUser) {
  const store = getStore();
  // Ver `zone-scope`: una zona ilegible no es «sin restricción».
  const visibleEnZona = zoneVisibilityFilter(user);
  const competitions = store.competitions
    .filter((c) => visibleEnZona(c.zona))
    .map((c) => applyCoverageToCompetition(c, getCompetitionTemplate(c.id), store.assignments.get(c.id) ?? {}))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Solo campeonatos no celebrados: los pasados inflaban KPIs, salud e
  // "insights" indefinidamente.
  const dashboardCompetitions = competitions.filter((c) => !isCompetitionPast(c));
  const coverage = dashboardCompetitions.map((c) => {
    const s = rosterAnalyticsStats(getCompetitionTemplate(c.id), store.assignments.get(c.id) ?? {}, c.requeridos);
    return { id: c.id, nombre: c.nombre, fecha: c.fecha, estado: c.estado, filled: s.filledSlots, open: s.openSlots, required: s.requiredSlots };
  });
  return {
    competitions,
    dashboardCompetitions,
    coverage,
    referees: store.referees.filter((r) => visibleEnZona(r.zona)),
    approvals: store.approvals.filter((a) => visibleEnZona(a.zona)),
    promotions: store.promotions.filter((p) => visibleEnZona(p.zona)),
  };
}

export function buildKpis(user?: SessionUser): DashboardKpi[] {
  const { coverage, referees, approvals } = liveDashboardData(user);
  return buildDashboardKpis({ coverage, referees, approvals });
}

export { buildIntelligence, getCalendarEvents, getLevels, getStore, getZones };
