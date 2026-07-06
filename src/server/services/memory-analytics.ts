import { resolveZoneCode } from "@/lib/aep-zones";
import { rosterAnalyticsStats } from "@/lib/roster-coverage";
import { enumerateSlotKeys } from "@/lib/roster-template";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import type { AnalyticsPayload, SessionUser } from "@/lib/types";
import { getCompetitionTemplate, getStore, getZones } from "@/server/store";
import { yearFromIso } from "./memory-helpers";
import { getCompetitions, getApprovals } from "./memory-competitions";

export async function getNavCounts(user?: SessionUser) {
  const competitions = await getCompetitions(user);
  const approvals = (await getApprovals(user)).filter((a) => a.status === "pendiente").length;
  return {
    competitions: competitions.length,
    approvals,
    activeRosterHref: pickActiveRosterHref(competitions),
  };
}

export async function getAnalytics(
  user?: SessionUser,
  requestedYear?: number,
): Promise<AnalyticsPayload> {
  const store = getStore();
  const competitions = await getCompetitions(user);
  const userZone =
    user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
  const scopedReferees = userZone
    ? store.referees.filter((r) => resolveZoneCode(r.zona) === userZone)
    : store.referees;
  const years = Array.from(
    new Set(competitions.map((c) => yearFromIso(c.fecha)).filter((y): y is number => y != null)),
  ).sort((a, b) => a - b);
  const selectedYear =
    requestedYear != null && years.includes(requestedYear)
      ? requestedYear
      : years[years.length - 1] ?? new Date().getFullYear();
  const yearAgg = new Map<number, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
  const zoneAgg = new Map<string, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
  const topRefAgg = new Map<string, { competitionIds: Set<string>; slots: number }>();

  for (const c of competitions) {
    const year = yearFromIso(c.fecha);
    if (year == null) continue;
    const template = getCompetitionTemplate(c.id);
    const assignments = store.assignments.get(c.id) ?? {};
    const stats = rosterAnalyticsStats(template, assignments, c.requeridos);
    const y = yearAgg.get(year) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
    y.competitions += 1;
    y.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
    y.requiredSlots += stats.requiredSlots;
    y.filledSlots += stats.filledSlots;
    stats.refereeIds.forEach((id) => y.refereeIds.add(id));
    yearAgg.set(year, y);
    if (year === selectedYear && c.zona) {
      const zoneCode = resolveZoneCode(c.zona);
      if (!zoneCode) continue;
      const z = zoneAgg.get(zoneCode) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
      z.competitions += 1;
      z.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
      z.requiredSlots += stats.requiredSlots;
      z.filledSlots += stats.filledSlots;
      stats.refereeIds.forEach((id) => z.refereeIds.add(id));
      zoneAgg.set(zoneCode, z);
    }
    if (year === selectedYear) {
      const validKeys = new Set(enumerateSlotKeys(template));
      for (const [slotKey, refereeId] of Object.entries(assignments)) {
        if (!refereeId || !validKeys.has(slotKey)) continue;
        const refAgg = topRefAgg.get(refereeId) ?? { competitionIds: new Set<string>(), slots: 0 };
        refAgg.competitionIds.add(c.id);
        refAgg.slots += 1;
        topRefAgg.set(refereeId, refAgg);
      }
    }
  }

  const yearlyHistory = [...yearAgg.entries()].sort((a, b) => a[0] - b[0]).map(([year, agg]) => ({
    year, competitions: agg.competitions, criticalCompetitions: agg.criticalCompetitions,
    requiredSlots: agg.requiredSlots, filledSlots: agg.filledSlots, uniqueAssignedReferees: agg.refereeIds.size,
  }));
  const activityByZone = getZones().map((z) => {
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
  const approvalsForYear = (userZone
    ? store.approvals.filter((a) => resolveZoneCode(a.zona) === userZone)
    : store.approvals
  ).filter((a) => yearFromIso(a.submittedAt) === selectedYear);
  const reviewed = approvalsForYear.filter((a) => a.status !== "pendiente").length;
  const rejected = approvalsForYear.filter((a) => a.status === "rechazado").length;
  const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;
  const selectedYearAgg = yearAgg.get(selectedYear);
  return {
    availableYears: years, selectedYear, yearlyHistory, activityByZone, topReferees, rejectionRate,
    criticalEvents: competitions.filter((c) => c.estado === "Crítico" && yearFromIso(c.fecha) === selectedYear),
    crossZoneSummary: { totalCrossZoneSlots: 0, pctOfFilledSlots: 0 },
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
}
