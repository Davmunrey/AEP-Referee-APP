import { countOpenSlots } from "@/lib/roster-rules";
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

/** Bitácora de salud en memoria (modo dev sin Supabase). */
export const healthHistory: { score: number; at: number }[] = [];

export function parseSlotKey(slotKey: string): { session: string; roleKey: string } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  return { session: parts[0]!, roleKey: parts[1]! };
}

export function syncCompetitionCoverage(competitionId: string) {
  const store = getStore();
  const comp = store.competitions.find((c) => c.id === competitionId);
  if (!comp) return;
  const assignments = store.assignments.get(competitionId) ?? {};
  const filled = Object.values(assignments).filter(Boolean).length;
  comp.confirmados = filled;
  const open = countOpenSlots(getCompetitionTemplate(competitionId), assignments);
  if (open === 0) comp.estado = "Completo";
  else if (filled === 0) comp.estado = "Borrador";
  else if (open > 5) comp.estado = "Crítico";
  else comp.estado = "Incompleto";
}

export function yearFromIso(date: string): number | null {
  const year = Number(String(date).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

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
  const isZoneScoped =
    user?.role === "delegado_zona" && typeof user.zona === "string";
  const referees = isZoneScoped
    ? store.referees.filter((r) => r.zona === user!.zona)
    : store.referees;
  const competitions = isZoneScoped
    ? store.competitions.filter((c) => c.zona === user!.zona)
    : store.competitions;
  const approvals = isZoneScoped
    ? store.approvals.filter((a) => a.zona === user!.zona)
    : store.approvals;

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  for (const c of competitions) {
    openSlots += countOpenSlots(
      getCompetitionTemplate(c.id),
      store.assignments.get(c.id) ?? {},
    );
  }
  const critical = competitions.filter((c) => c.estado === "Crítico").length;

  const subAlcance = isZoneScoped ? `zona ${user!.zona}` : "temporada 2026";

  return [
    {
      label: "Jueces Activos",
      value: String(active),
      sub: `/ ${referees.length} federados`,
      trend: subAlcance,
      trendDir: "up",
      accent: "neutral",
    },
    {
      label: "Próximas Competiciones",
      value: String(competitions.length),
      sub: "campeonatos en calendario",
      trend: subAlcance,
      trendDir: "up",
      accent: "red",
    },
    {
      label: "Plazas sin cubrir",
      value: String(openSlots),
      sub: `en ${competitions.length} campeonatos`,
      trend: `${critical} campeonatos en estado crítico`,
      trendDir: critical > 0 ? "warn" : "flat",
      accent: "yellow",
    },
    {
      label: "Aprobaciones Pendientes",
      value: String(pending),
      sub: "propuestas regionales",
      trend: subAlcance,
      trendDir: "flat",
      accent: "blue",
    },
  ];
}

export { buildIntelligence, getCalendarEvents, getLevels, getStore, getZones };
