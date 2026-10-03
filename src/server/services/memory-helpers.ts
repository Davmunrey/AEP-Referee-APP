import { zoneVisibilityFilter } from "@/lib/zone-scope";
import { resolveZoneCode } from "@/lib/aep-zones";
import { seasonLabel } from "@/lib/season";
import { countOpenSlots } from "@/lib/roster-rules";
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
import { contar } from "@/lib/plural";
import { applyCoverageToCompetition } from "@/lib/roster-coverage";

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

export function buildKpis(user?: SessionUser): DashboardKpi[] {
  const store = getStore();
  const userZone =
    user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
  const isZoneScoped = Boolean(userZone);
  // Ver `zone-scope`: una zona ilegible no es «sin restricción».
  const visibleEnZona = zoneVisibilityFilter(user);
  const referees = store.referees.filter((r) => visibleEnZona(r.zona));
  // Solo los no celebrados, igual que el gemelo de Supabase: el panel es
  // operativo. Contando los pasados, «Próximas competiciones» y «Plazas sin
  // cubrir» sumaban campeonatos de abril mientras la salud, que sí filtraba,
  // decía «0/0 plazas»: dos cifras contradictorias en la misma portada.
  const competitions = store.competitions.filter(
    (c) => visibleEnZona(c.zona) && !isCompetitionPast(c),
  );
  const approvals = store.approvals.filter((a) => visibleEnZona(a.zona));

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  for (const c of competitions) {
    openSlots += countOpenSlots(
      getCompetitionTemplate(c.id),
      store.assignments.get(c.id) ?? {},
    );
  }
  // El estado se deriva de la cobertura al leer (`applyCoverageToCompetition`);
  // el guardado en el store puede ir atrasado. Con el crudo, la portada decía
  // «0 campeonatos en estado crítico» mientras la lista marcaba uno Crítico.
  const critical = competitions.filter(
    (c) =>
      applyCoverageToCompetition(
        c,
        getCompetitionTemplate(c.id),
        store.assignments.get(c.id) ?? {},
      ).estado === "Crítico",
  ).length;

  const subAlcance = isZoneScoped ? `zona ${userZone}` : seasonLabel();

  return [
    {
      label: "Jueces activos",
      value: String(active),
      sub: `/ ${referees.length} federados`,
      trend: subAlcance,
      trendDir: "up",
      accent: "neutral",
    },
    {
      label: "Próximas competiciones",
      value: String(competitions.length),
      sub: "campeonatos en calendario",
      trend: subAlcance,
      trendDir: "up",
      accent: "red",
    },
    {
      label: "Plazas sin cubrir",
      value: String(openSlots),
      sub: `en ${contar(competitions.length, "campeonato", "campeonatos")}`,
      trend: `${contar(critical, "campeonato", "campeonatos")} en estado crítico`,
      trendDir: critical > 0 ? "warn" : "flat",
      accent: "yellow",
    },
    {
      label: "Aprobaciones pendientes",
      value: String(pending),
      sub: "propuestas regionales",
      trend: subAlcance,
      trendDir: "flat",
      accent: "blue",
    },
  ];
}

export { buildIntelligence, getCalendarEvents, getLevels, getStore, getZones };
