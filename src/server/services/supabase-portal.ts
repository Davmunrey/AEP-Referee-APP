import { buildPortalDesignations, portalProfileOf, portalSanctionOf, type JudgePortalData } from "@/lib/judge-portal";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type { Competition, RosterSession } from "@/lib/types";
import { mapCompetition, mapReferee } from "@/server/db/mappers";
import { getActiveSanction } from "@/server/services/referee-sanctions";
import { db, fetchAllPagesOf } from "./supabase-helpers";

type Row = Record<string, unknown>;

/** Portal del juez: su ficha, su sanción activa y sus designaciones. */
async function getJudgePortal(refereeId: string): Promise<JudgePortalData | undefined> {
  const supabase = db();
  // Los campeonatos del juez con SUS huecos embebidos (`!inner` y el filtro
  // por juez dejan solo los suyos), en la misma tanda que la ficha y la
  // sanción. Antes eran dos viajes seguidos —sus asignaciones y, al volver,
  // los campeonatos— en cada página del portal. Una fila por campeonato: la
  // plantilla no se repite por hueco. Paginado por id, el mismo orden de antes.
  const [{ data: refRow, error: refErr }, competitionRows, sanction] = await Promise.all([
    supabase.from("referees").select("*").eq("id", refereeId).maybeSingle(),
    // Una lista vacía por fallo de lectura diría «no tienes designaciones» a
    // quien sí las tiene, y el juez no se presentaría: el error se lanza.
    fetchAllPagesOf<Row>("roster_assignments/competitions", (from, to) =>
      supabase
        .from("competitions")
        .select("*, roster_assignments!inner(slot_key)")
        .eq("roster_assignments.referee_id", refereeId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    getActiveSanction(refereeId),
  ]);
  if (refErr) throw new Error(`referees: ${refErr.message}`);
  if (!refRow) return undefined;

  const slotKeysByCompetition = new Map<string, string[]>();
  const competitions: Competition[] = [];
  const templates = new Map<string, RosterSession[]>();
  for (const r of competitionRows) {
    const c = mapCompetition(r);
    const slots = Array.isArray(r.roster_assignments) ? (r.roster_assignments as Row[]) : [];
    slotKeysByCompetition.set(c.id, slots.map((a) => String(a.slot_key)));
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
