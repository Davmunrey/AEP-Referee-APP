import { buildPortalDesignations, portalProfileOf, portalSanctionOf, type JudgePortalData } from "@/lib/judge-portal";
import type { RosterSession } from "@/lib/types";
import { getCompetitionTemplate, getStore } from "@/server/store";
import { getActiveSanction, listRefereeSanctions } from "./memory-referees";

/** Mismo contrato que `supabase-portal`, sobre el store en memoria. */
async function getJudgePortal(refereeId: string): Promise<JudgePortalData | undefined> {
  const store = getStore();
  const referee = store.referees.find((r) => r.id === refereeId);
  if (!referee) return undefined;

  const slotKeysByCompetition = new Map<string, string[]>();
  for (const [competitionId, assignments] of store.assignments) {
    const keys = Object.entries(assignments)
      .filter(([, id]) => id === refereeId)
      .map(([key]) => key);
    if (keys.length) slotKeysByCompetition.set(competitionId, keys);
  }
  const competitions = store.competitions.filter((c) => slotKeysByCompetition.has(c.id));
  const templates = new Map<string, RosterSession[]>(competitions.map((c) => [c.id, getCompetitionTemplate(c.id)]));

  return {
    profile: portalProfileOf(referee),
    activeSanction: portalSanctionOf(await getActiveSanction(refereeId, listRefereeSanctions)),
    ...buildPortalDesignations(competitions, templates, slotKeysByCompetition),
  };
}

export const memoryPortalService = { getJudgePortal };
