import { isCompetitionPast } from "@/lib/competition-status";
import type { Competition } from "@/lib/types";

/** Campeonatos donde aún se puede montar o completar tarima (no finalizados por fecha). */
export function listActiveTarimaCompetitions(competitions: Competition[]): Competition[] {
  return competitions
    .filter((e) => !isCompetitionPast(e))
    .sort((a, b) => {
      const pctA = a.requeridos > 0 ? a.confirmados / a.requeridos : 0;
      const pctB = b.requeridos > 0 ? b.confirmados / b.requeridos : 0;
      if (pctA !== pctB) return pctA - pctB;
      return a.fecha.localeCompare(b.fecha);
    });
}

export function rosterCoveragePct(
  competition: Pick<Competition, "confirmados" | "requeridos">,
): number {
  if (competition.requeridos <= 0) return 0;
  return Math.min(100, Math.round((competition.confirmados / competition.requeridos) * 100));
}
