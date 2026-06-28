import type { CompensationHubItem, CompensationHubSummary } from "./hub-types";
import type { CompetitionCompensationSummary } from "./types";
import type { Competition } from "@/lib/types";

export function buildHubItem(
  competition: Competition,
  summary: CompetitionCompensationSummary,
): CompensationHubItem {
  const { readiness, claims } = summary;
  const pendingKmCount = readiness.pendingTravelReferees.length;

  return {
    competitionId: competition.id,
    nombre: competition.nombre,
    fecha: competition.fecha,
    fechaFin: competition.fechaFin,
    sede: competition.sede,
    estado: competition.estado,
    judgeCount: claims.length,
    venueReady: readiness.venueReady,
    readyForExport: readiness.readyForExport,
    pendingKmCount,
    grandTotal: summary.grandTotal,
    issueCount: readiness.issues.length,
  };
}

export function buildHubSummary(
  competitions: Competition[],
  summaries: Map<string, CompetitionCompensationSummary>,
): CompensationHubSummary {
  const items = competitions
    .map((comp) => {
      const summary = summaries.get(comp.id);
      if (!summary) return null;
      return buildHubItem(comp, summary);
    })
    .filter((item): item is CompensationHubItem => item != null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const withJudges = items.filter((i) => i.judgeCount > 0);
  const totalPendingKm = withJudges.reduce((sum, i) => sum + i.pendingKmCount, 0);
  const readyCount = withJudges.filter((i) => i.readyForExport).length;

  return { items: withJudges, totalPendingKm, readyCount };
}
