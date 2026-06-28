import { buildIntelligence } from "@/lib/dashboard-intelligence";
import { currentSeasonYear } from "@/lib/season";
import { LEVELS } from "@/lib/mock-data";
import { countOpenSlots } from "@/lib/roster-rules";
import { rosterAnalyticsStats } from "@/lib/roster-coverage";
import { enumerateSlotKeys, normalizeCompetitionTemplate } from "@/lib/roster-template";
import { resolveZoneCode } from "@/lib/aep-zones";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import type {
  AnalyticsPayload,
  AppMeta,
  Competition,
  DashboardKpi,
  DashboardPayload,
  RegulationRule,
  RosterSession,
  SessionUser,
} from "@/lib/types";
import { mapActivity, mapCompetition } from "@/server/db/mappers";
import { getRegulationsCached } from "@/server/cache/static-data";
import { expireStaleSanctions, getSanctionAlerts } from "@/server/services/referee-sanctions";
import {
  applyHealthHistory,
  cachedLoadAllAssignments,
  db,
  getZones,
  yearFromIso,
} from "./supabase-helpers";
import { competitionService } from "./supabase-competitions";

type KpiInput = {
  referees: { estado: string }[];
  competitions: { id: string; estado: string; template?: unknown; tipo?: string }[];
  approvals: { status: string }[];
  openSlotsByCompetition: Map<string, number>;
};

async function buildKpis(input?: KpiInput): Promise<DashboardKpi[]> {
  let referees: { estado: string }[];
  let competitions: { id: string; estado: string; template?: unknown; tipo?: string }[];
  let approvals: { status: string }[];
  let openSlotsByCompetition: Map<string, number>;

  if (input) {
    ({ referees, competitions, approvals, openSlotsByCompetition } = input);
  } else {
    const supabase = db();
    const [refRes, compRes, apprRes, assignmentsByComp] = await Promise.all([
      supabase.from("referees").select("estado"),
      supabase.from("competitions").select("id, estado, template, tipo"),
      supabase.from("approval_proposals").select("status"),
      cachedLoadAllAssignments(),
    ]);
    referees = refRes.data ?? [];
    competitions = compRes.data ?? [];
    approvals = apprRes.data ?? [];
    openSlotsByCompetition = new Map(
      competitions.map((c) => {
        const tpl = normalizeCompetitionTemplate(
          c.template as RosterSession[] | null,
          c.tipo as Competition["tipo"],
        );
        return [c.id, countOpenSlots(tpl, assignmentsByComp.get(c.id) ?? {})];
      }),
    );
  }

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  let requiredSlots = 0;
  for (const c of competitions) {
    const tpl = normalizeCompetitionTemplate(
      c.template as RosterSession[] | null,
      c.tipo as Competition["tipo"],
    );
    openSlots += openSlotsByCompetition.get(c.id) ?? 0;
    requiredSlots += enumerateSlotKeys(tpl).length;
  }
  const filledSlots = requiredSlots - openSlots;
  const coveragePct = requiredSlots > 0 ? Math.round((filledSlots / requiredSlots) * 100) : 0;
  const critical = competitions.filter((c) => c.estado === "Crítico").length;
  const refereesLength = referees.length;
  const competitionsLength = competitions.length;

  return [
    { label: "Jueces Activos", value: String(active), sub: `/ ${refereesLength} federados`, trend: `cuota operativa ${currentSeasonYear()}`, trendDir: "up", accent: "neutral" },
    { label: "Próximas Competiciones", value: String(competitionsLength), sub: "campeonatos en calendario", trend: "AEP-1 · AEP-2 · AEP-3", trendDir: "up", accent: "red" },
    { label: "Plazas sin cubrir", value: String(openSlots), sub: `en ${competitionsLength} campeonatos`, trend: `${critical} campeonatos en estado crítico`, trendDir: critical > 0 ? "warn" : "flat", accent: "yellow" },
    { label: "Aprobaciones Pendientes", value: String(pending), sub: "propuestas regionales", trend: "esperan revisión nacional", trendDir: "flat", accent: "blue" },
    {
      label: "Cobertura Nacional",
      value: `${coveragePct}%`,
      sub: `${filledSlots} / ${requiredSlots} plazas`,
      trend: coveragePct >= 80 ? "cobertura óptima" : coveragePct >= 50 ? "cobertura parcial" : "cobertura baja",
      trendDir: coveragePct >= 80 ? "up" : coveragePct >= 50 ? "warn" : "down",
      accent: coveragePct >= 80 ? "blue" : coveragePct >= 50 ? "yellow" : "red",
    },
  ];
}

export const analyticsService = {
  getMeta: async (user: SessionUser): Promise<AppMeta> => ({
    zones: await getZones(),
    levels: LEVELS,
    currentUser: user,
  }),

  getDashboard: async (user: SessionUser): Promise<DashboardPayload> => {
    await expireStaleSanctions();
    const supabase = db();
    const isZoneScoped = user.role === "delegado_zona" && !!user.zona;
    const userZone = isZoneScoped ? resolveZoneCode(user.zona) : undefined;

    let competitionQuery = supabase.from("competitions").select("*").order("fecha", { ascending: true });
    let refereeQuery = supabase.from("referees").select("estado, disp, zona");
    let approvalQuery = supabase.from("approval_proposals").select("status, zona");
    let promotionQuery = supabase.from("promotion_requests").select("status, zona");

    if (userZone) {
      competitionQuery = competitionQuery.eq("zona", userZone);
      refereeQuery = refereeQuery.eq("zona", userZone);
      approvalQuery = approvalQuery.eq("zona", userZone);
      promotionQuery = promotionQuery.eq("zona", userZone);
    }

    const [
      { data: competitionRows },
      { data: activity },
      { data: referees },
      { data: approvals },
      { data: promotions },
      assignmentsByComp,
    ] = await Promise.all([
      competitionQuery,
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      refereeQuery,
      approvalQuery,
      promotionQuery,
      cachedLoadAllAssignments(),
    ]);

    const competitions = (competitionRows ?? []).map((r) =>
      mapCompetition(r as Record<string, unknown>),
    );
    const competitionNames = new Set(competitions.map((c) => c.nombre));
    const templateByComp = new Map(
      (competitionRows ?? []).map((r) => {
        const row = r as { id: string; template: RosterSession[] | null; tipo: string };
        return [row.id, normalizeCompetitionTemplate(row.template, row.tipo as Competition["tipo"])] as const;
      }),
    );
    const coverage = competitions.map((c) => {
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const filled = Object.values(assignments).filter(Boolean).length;
      const tpl = templateByComp.get(c.id) ?? [];
      const open = countOpenSlots(tpl, assignments);
      return { id: c.id, nombre: c.nombre, fecha: c.fecha, estado: c.estado, filled, open, required: filled + open };
    });
    const activityItems = (activity ?? [])
      .map((r) => mapActivity(r as Record<string, unknown>))
      .filter((item) => !userZone || competitionNames.has(item.evento));
    const scopedReferees = (referees ?? []) as { estado: string; disp?: boolean }[];
    const scopedApprovals = (approvals ?? []) as { status: string }[];
    const scopedPromotions = (promotions ?? []) as { status: string }[];
    const { health, insights } = buildIntelligence({
      referees: scopedReferees,
      competitions,
      approvals: scopedApprovals,
      promotions: scopedPromotions,
      coverage,
      activity: activityItems,
    });
    await applyHealthHistory(health);

    const kpiCompetitions = (competitionRows ?? []) as {
      id: string;
      estado: string;
      template: RosterSession[] | null;
      tipo: string;
    }[];
    const kpiOpenSlots = new Map<string, number>(
      kpiCompetitions.map((c) => {
        const tpl = normalizeCompetitionTemplate(c.template, c.tipo as Competition["tipo"]);
        return [c.id, countOpenSlots(tpl, assignmentsByComp.get(c.id) ?? {})];
      }),
    );

    const coverageLabel = isZoneScoped ? "Cobertura Zonal" : "Cobertura Nacional";

    return {
      kpis: (await buildKpis({
        referees: scopedReferees,
        competitions: kpiCompetitions,
        approvals: scopedApprovals,
        openSlotsByCompetition: kpiOpenSlots,
      })).map((kpi) =>
        kpi.label === "Cobertura Nacional" ? { ...kpi, label: coverageLabel } : kpi,
      ),
      activity: activityItems,
      calendar: calendarEventsFromCompetitions(competitions),
      upcomingCompetitions: competitions.slice(0, 6),
      currentUser: user,
      health,
      insights,
      coverage,
      sanctionAlerts: await getSanctionAlerts(user, { skipExpire: true }),
      generatedAt: new Date().toISOString(),
    };
  },

  getAnalytics: async (user?: SessionUser): Promise<AnalyticsPayload> => {
    const userZone =
      user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
    const competitions = await competitionService.getCompetitions(user);
    const assignmentsByComp = await cachedLoadAllAssignments();
    const supabase = db();
    const { data: compTemplates } = await supabase.from("competitions").select("id, template, tipo");
    const templateById = new Map(
      (compTemplates ?? []).map((row) => {
        const r = row as { id: string; template: RosterSession[] | null; tipo: string };
        return [r.id, normalizeCompetitionTemplate(r.template, r.tipo as Competition["tipo"])] as const;
      }),
    );
    const years = Array.from(
      new Set(competitions.map((c) => yearFromIso(c.fecha)).filter((y): y is number => y != null)),
    ).sort((a, b) => a - b);
    const selectedYear = years[years.length - 1] ?? new Date().getFullYear();
    const yearAgg = new Map<number, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
    const zoneAgg = new Map<string, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
    const topRefAgg = new Map<string, { competitionIds: Set<string>; slots: number }>();

    for (const c of competitions) {
      const year = yearFromIso(c.fecha);
      if (year == null) continue;
      const tpl = templateById.get(c.id) ?? [];
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const stats = rosterAnalyticsStats(tpl, assignments, c.requeridos);
      const y = yearAgg.get(year) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
      y.competitions += 1;
      y.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
      y.requiredSlots += stats.requiredSlots;
      y.filledSlots += stats.filledSlots;
      stats.refereeIds.forEach((id) => y.refereeIds.add(id));
      yearAgg.set(year, y);
      const zoneCode = c.zona ? resolveZoneCode(c.zona) : undefined;
      if (year === selectedYear && zoneCode) {
        const z = zoneAgg.get(zoneCode) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
        z.competitions += 1;
        z.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
        z.requiredSlots += stats.requiredSlots;
        z.filledSlots += stats.filledSlots;
        stats.refereeIds.forEach((id) => z.refereeIds.add(id));
        zoneAgg.set(zoneCode, z);
      }
      if (year === selectedYear) {
        const validKeys = new Set(enumerateSlotKeys(tpl));
        for (const [slotKey, refereeId] of Object.entries(assignments)) {
          if (!refereeId || !validKeys.has(slotKey)) continue;
          const refAgg = topRefAgg.get(refereeId) ?? { competitionIds: new Set<string>(), slots: 0 };
          refAgg.competitionIds.add(c.id);
          refAgg.slots += 1;
          topRefAgg.set(refereeId, refAgg);
        }
      }
    }
    const { data: referees } = await supabase.from("referees").select("*");
    const mappedReferees = (referees ?? []).map((r) => ({
      id: String((r as Record<string, unknown>).id),
      nombre: String((r as Record<string, unknown>).nombre),
      nivel: String((r as Record<string, unknown>).nivel),
      zona: String((r as Record<string, unknown>).zona),
      estado: String((r as Record<string, unknown>).estado),
    }));
    const scopedReferees = userZone
      ? mappedReferees.filter((r) => resolveZoneCode(r.zona) === userZone)
      : mappedReferees;
    const zones = await getZones();
    const activityByZone = zones.map((z) => {
      const agg = zoneAgg.get(z.code);
      const activeReferees = scopedReferees.filter(
        (r) => resolveZoneCode(r.zona) === z.code && r.estado === "Activo",
      ).length;
      return { zona: z.code, name: z.name, competitions: agg?.competitions ?? 0, criticalCompetitions: agg?.criticalCompetitions ?? 0, requiredSlots: agg?.requiredSlots ?? 0, filledSlots: agg?.filledSlots ?? 0, uniqueAssignedReferees: agg?.refereeIds.size ?? 0, activeReferees };
    });
    const topReferees = [...topRefAgg.entries()]
      .map(([id, agg]) => {
        const referee = scopedReferees.find((r) => r.id === id);
        if (!referee) return null;
        return { id, nombre: referee.nombre, nivel: referee.nivel, assignedCompetitions: agg.competitionIds.size, assignedSlots: agg.slots };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.assignedCompetitions - a!.assignedCompetitions) || (b!.assignedSlots - a!.assignedSlots) || a!.nombre.localeCompare(b!.nombre, "es"))
      .slice(0, 5) as AnalyticsPayload["topReferees"];
    const { data: approvals } = userZone
      ? await supabase.from("approval_proposals").select("status, submitted_at").eq("zona", userZone)
      : await supabase.from("approval_proposals").select("status, submitted_at");
    const approvalsForYear = (approvals ?? []).filter((a) => yearFromIso(String(a.submitted_at ?? "")) === selectedYear);
    const reviewed = approvalsForYear.filter((a) => a.status !== "pendiente").length;
    const rejected = approvalsForYear.filter((a) => a.status === "rechazado").length;
    const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;
    const yearlyHistory = [...yearAgg.entries()].sort((a, b) => a[0] - b[0]).map(([year, agg]) => ({ year, competitions: agg.competitions, criticalCompetitions: agg.criticalCompetitions, requiredSlots: agg.requiredSlots, filledSlots: agg.filledSlots, uniqueAssignedReferees: agg.refereeIds.size }));
    const selectedYearAgg = yearAgg.get(selectedYear);
    const selectedYearCompetitionIds = competitions.filter((c) => yearFromIso(c.fecha) === selectedYear).map((c) => c.id);
    const { data: crossZoneRows } = selectedYearCompetitionIds.length > 0
      ? await supabase.from("roster_assignments").select("competition_id").eq("cross_zone", true).in("competition_id", selectedYearCompetitionIds)
      : { data: [] };
    const crossZoneByComp = new Map<string, number>();
    for (const row of crossZoneRows ?? []) {
      const id = String(row.competition_id);
      crossZoneByComp.set(id, (crossZoneByComp.get(id) ?? 0) + 1);
    }
    const crossZoneByZone = new Map<string, number>();
    for (const c of competitions) {
      if (yearFromIso(c.fecha) !== selectedYear || !c.zona) continue;
      const zoneCode = resolveZoneCode(c.zona);
      if (!zoneCode) continue;
      const count = crossZoneByComp.get(c.id) ?? 0;
      if (count > 0) crossZoneByZone.set(zoneCode, (crossZoneByZone.get(zoneCode) ?? 0) + count);
    }
    const totalCrossZoneSlots = [...crossZoneByZone.values()].reduce((a, n) => a + n, 0);
    const filledForYear = selectedYearAgg?.filledSlots ?? 0;
    return {
      availableYears: years,
      selectedYear,
      yearlyHistory,
      activityByZone: activityByZone.map((z) => ({ ...z, crossZoneSlots: crossZoneByZone.get(z.zona) ?? 0 })),
      topReferees,
      rejectionRate,
      criticalEvents: competitions.filter((c) => c.estado === "Crítico" && yearFromIso(c.fecha) === selectedYear),
      crossZoneSummary: { totalCrossZoneSlots, pctOfFilledSlots: filledForYear > 0 ? Math.round((totalCrossZoneSlots / filledForYear) * 100) : 0 },
      totals: {
        competitions: selectedYearAgg?.competitions ?? 0,
        criticalCompetitions: selectedYearAgg?.criticalCompetitions ?? 0,
        activeReferees: scopedReferees.filter((r) => r.estado === "Activo").length,
        totalReferees: scopedReferees.length,
        pendingApprovals: approvalsForYear.filter((a) => a.status === "pendiente").length,
        uniqueAssignedReferees: selectedYearAgg?.refereeIds.size ?? 0,
        filledSlots: selectedYearAgg?.filledSlots ?? 0,
        openSlots: selectedYearAgg ? Math.max(0, selectedYearAgg.requiredSlots - selectedYearAgg.filledSlots) : 0,
      },
    };
  },

  getRegulations: async (): Promise<RegulationRule[]> => getRegulationsCached(),
};
