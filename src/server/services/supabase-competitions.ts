import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import {
  competitionDedupKey,
  competitionsToRemoveInGroup,
  groupCompetitionDuplicates,
} from "@/lib/competition-dedup";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import { applyCoverageToCompetition } from "@/lib/roster-coverage";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type { Competition, RosterSession, SessionUser } from "@/lib/types";
import { mapCompetition, competitionPatchToDb } from "@/server/db/mappers";
import {
  cachedLoadAllAssignments,
  db,
  hasApprovalCompetitionColumns,
  hasHistoryCompetitionColumn,
  loadAssignments,
} from "./supabase-helpers";

function enrichCompetitionRows(
  rows: Record<string, unknown>[],
  assignmentsByComp: Map<string, Record<string, string>>,
): Competition[] {
  return rows.map((row) => {
    const comp = mapCompetition(row);
    const template = normalizeCompetitionTemplate(
      (row.template as RosterSession[] | null) ?? null,
      comp.tipo,
    );
    const assignments = assignmentsByComp.get(comp.id) ?? {};
    return applyCoverageToCompetition(comp, template, assignments);
  });
}

export const competitionService = {
  getCompetitions: async (user?: SessionUser): Promise<Competition[]> => {
    const supabase = db();
    const [{ data }, assignmentsByComp] = await Promise.all([
      supabase.from("competitions").select("*").order("fecha"),
      cachedLoadAllAssignments(),
    ]);
    const list = enrichCompetitionRows(
      (data ?? []) as Record<string, unknown>[],
      assignmentsByComp,
    );
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona);
      return list.filter((c) => resolveZoneCode(c.zona) === userZone);
    }
    return list;
  },

  getCompetition: async (id: string): Promise<Competition | undefined> => {
    const supabase = db();
    // Fila y asignaciones en paralelo (antes eran secuenciales). Es una función
    // muy frecuente: detalle, compensación y cada mutación de roster.
    const [{ data }, assignments] = await Promise.all([
      supabase.from("competitions").select("*").eq("id", id).single(),
      loadAssignments(id),
    ]);
    if (!data) return undefined;
    const assignmentsByComp = new Map([[id, assignments]]);
    return enrichCompetitionRows([data as Record<string, unknown>], assignmentsByComp)[0];
  },

  /** Contadores de navegación sin cargar plantillas ni asignaciones completas. */
  getNavCountsFast: async (user?: SessionUser) => {
    const supabase = db();
    const userZone =
      user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;

    let compQuery = supabase.from("competitions").select("id, fecha, estado").order("fecha");
    let apprQuery = supabase
      .from("approval_proposals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente");

    if (userZone) {
      compQuery = compQuery.eq("zona", userZone);
      apprQuery = apprQuery.eq("zona", userZone);
    }

    const [{ data: comps }, { count: apprCount }] = await Promise.all([compQuery, apprQuery]);
    const navComps = (comps ?? []).map((r) => ({
      id: String(r.id),
      fecha: String(r.fecha),
      estado: String(r.estado) as Competition["estado"],
    }));

    return {
      competitions: navComps.length,
      approvals: apprCount ?? 0,
      activeRosterHref: pickActiveRosterHref(navComps),
    };
  },

  createCompetition: async (
    input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
  ): Promise<Competition> => {
    const supabase = db();
    const existing = await supabase.from("competitions").select("id, nombre, fecha, tipo");
    const key = competitionDedupKey(input);
    const dupe = (existing.data ?? []).find(
      (r) =>
        competitionDedupKey({
          nombre: String(r.nombre),
          fecha: String(r.fecha),
          tipo: String(r.tipo),
        }) === key,
    );
    if (dupe) {
      throw new Error(
        `Ya existe un campeonato igual (${String(dupe.nombre)}, ${String(dupe.fecha)}). Id: ${String(dupe.id)}`,
      );
    }
    const maxNum = (existing.data ?? []).reduce((max, row) => {
      const m = /^evt-(\d+)$/i.exec(String(row.id));
      const n = m ? Number.parseInt(m[1]!, 10) : 0;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const id = `evt-${String(maxNum + 1).padStart(3, "0")}`;
    const row = {
      id,
      nombre: input.nombre,
      tipo: input.tipo,
      fecha: input.fecha,
      fecha_fin: input.fechaFin,
      sede: input.sede,
      sesiones: input.sesiones,
      requeridos: input.requeridos,
      confirmados: 0,
      estado: "Borrador",
      aprobacion: "Sin propuesta",
      zona: normalizeZoneInput(input.zona),
      template: [],
    };
    const { data, error } = await supabase.from("competitions").insert(row).select().single();
    if (error) throw error;
    return mapCompetition(data as Record<string, unknown>);
  },

  updateCompetition: async (id: string, patch: Partial<Competition>): Promise<Competition | undefined> => {
    const supabase = db();
    const dbPatch = competitionPatchToDb(patch);
    if (patch.zona !== undefined) {
      dbPatch.zona = normalizeZoneInput(patch.zona);
    }
    const { data, error } = await supabase
      .from("competitions")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
    return mapCompetition(data as Record<string, unknown>);
  },

  deleteCompetition: async (id: string): Promise<boolean> => {
    const supabase = db();
    const approvalCompetitionColumn = (await hasApprovalCompetitionColumns())
      ? "competition_id"
      : "event_id";
    const historyCompetitionColumn = (await hasHistoryCompetitionColumn())
      ? "competition_id"
      : "event_id";
    await supabase.from("roster_assignments").delete().eq("competition_id", id);
    await supabase.from("approval_proposals").delete().eq(approvalCompetitionColumn, id);
    await supabase.from("roster_history").delete().eq(historyCompetitionColumn, id);
    const { data, error } = await supabase
      .from("competitions")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("[deleteCompetition]", id, error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  },

  findCompetitionDuplicates: async (
    getCompetitionsFn: (user?: SessionUser) => Promise<Competition[]>,
    user?: SessionUser,
  ) => {
    const list = await getCompetitionsFn(user);
    return groupCompetitionDuplicates(list);
  },

  removeDuplicateCompetitions: async (
    getCompetitionsFn: (user?: SessionUser) => Promise<Competition[]>,
    deleteCompetitionFn: (id: string) => Promise<boolean>,
    user?: SessionUser,
  ) => {
    const groups = groupCompetitionDuplicates(await getCompetitionsFn(user));
    const removed: string[] = [];
    const kept: string[] = [];
    for (const group of groups) {
      const toDrop = competitionsToRemoveInGroup(group.competitions);
      const keep = group.competitions.find((e) => !toDrop.some((d) => d.id === e.id));
      if (keep) kept.push(keep.id);
      for (const c of toDrop) {
        const ok = await deleteCompetitionFn(c.id);
        if (ok) removed.push(c.id);
      }
    }
    return { removed, kept, groups: groups.length };
  },

  getCompetitionAvailability: async (competitionId: string): Promise<string[]> => {
    const supabase = db();
    const { data } = await supabase
      .from("competition_availability")
      .select("referee_id")
      .eq("competition_id", competitionId);
    return (data ?? []).map((row) => String(row.referee_id));
  },

  addCompetitionAvailability: async (competitionId: string, refereeId: string, actor: string): Promise<void> => {
    const supabase = db();
    const { error } = await supabase.from("competition_availability").upsert(
      { competition_id: competitionId, referee_id: refereeId, created_by: actor },
      { onConflict: "competition_id,referee_id" },
    );
    if (error) throw new Error(error.message);
  },

  removeCompetitionAvailability: async (competitionId: string, refereeId: string): Promise<void> => {
    const supabase = db();
    const { error } = await supabase
      .from("competition_availability")
      .delete()
      .eq("competition_id", competitionId)
      .eq("referee_id", refereeId);
    if (error) throw new Error(error.message);
  },
};
