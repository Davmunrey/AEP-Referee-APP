import { buildPortalDesignations, portalProfileOf, portalSanctionOf, type JudgePortalData } from "@/lib/judge-portal";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type { Competition, RosterSession } from "@/lib/types";
import { mapCompetition, mapReferee } from "@/server/db/mappers";
import { getActiveSanction } from "@/server/services/referee-sanctions";
import { db, fetchAllRowsIn } from "./supabase-helpers";

/** Portal del juez: su ficha, su sanción activa y sus designaciones. */
async function getJudgePortal(refereeId: string): Promise<JudgePortalData | undefined> {
  const supabase = db();
  const [{ data: refRow, error: refErr }, { data: rows, error: rowsErr }, sanction] = await Promise.all([
    supabase.from("referees").select("*").eq("id", refereeId).maybeSingle(),
    supabase.from("roster_assignments").select("competition_id, slot_key").eq("referee_id", refereeId),
    getActiveSanction(refereeId),
  ]);
  if (refErr) throw new Error(`referees: ${refErr.message}`);
  // Una lista vacía por fallo de lectura diría «no tienes designaciones» a
  // quien sí las tiene, y el juez no se presentaría.
  if (rowsErr) throw new Error(`roster_assignments: ${rowsErr.message}`);
  if (!refRow) return undefined;

  const slotKeysByCompetition = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const id = String(row.competition_id);
    slotKeysByCompetition.set(id, [...(slotKeysByCompetition.get(id) ?? []), String(row.slot_key)]);
  }
  const ids = [...slotKeysByCompetition.keys()];
  const competitionRows = ids.length ? await fetchAllRowsIn("competitions", "id", ids) : [];
  const competitions: Competition[] = [];
  const templates = new Map<string, RosterSession[]>();
  for (const row of competitionRows) {
    const r = row as Record<string, unknown>;
    const c = mapCompetition(r);
    competitions.push(c);
    templates.set(c.id, normalizeCompetitionTemplate(r.template as RosterSession[] | null, c.tipo));
  }

  return {
    profile: portalProfileOf(mapReferee(refRow as Record<string, unknown>)),
    activeSanction: portalSanctionOf(sanction),
    ...buildPortalDesignations(competitions, templates, slotKeysByCompetition),
  };
}

export const portalService = { getJudgePortal };
