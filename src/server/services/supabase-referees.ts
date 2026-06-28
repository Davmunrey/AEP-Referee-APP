import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import { computeJudgeProfile } from "@/lib/judge-stats";
import { buildRefereeCompetitionHistory } from "@/lib/referee-competition-history";
import type {
  Competition,
  JudgeProfile,
  Referee,
  RefereeCompetitionHistoryItem,
  SessionUser,
} from "@/lib/types";
import { mapReferee, refereeToDbRow } from "@/server/db/mappers";
import {
  createRefereeSanction,
  expireStaleSanctions,
  getActiveSanction,
  getSanctionAlerts,
  listRefereeSanctions,
  markSanctionDelegateNotified,
  revokeRefereeSanction,
} from "@/server/services/referee-sanctions";
import { db, pushActivity } from "./supabase-helpers";

async function loadRefereeCompetitionHistory(
  refereeId: string,
): Promise<RefereeCompetitionHistoryItem[]> {
  const supabase = db();
  const { data: assignmentRows } = await supabase
    .from("roster_assignments")
    .select("competition_id, slot_key, flags")
    .eq("referee_id", refereeId);

  const assignments = (assignmentRows ?? []).map((row) => ({
    competitionId: String(row.competition_id),
    slotKey: String(row.slot_key),
    flags: row.flags as Record<string, unknown> | null,
  }));
  const ids = [...new Set(assignments.map((row) => row.competitionId))];
  if (ids.length === 0) return [];

  const { data: competitionRows } = await supabase
    .from("competitions")
    .select("id, nombre, tipo, fecha, fecha_fin, sede, estado, aprobacion")
    .in("id", ids);

  const competitions = (competitionRows ?? []).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre),
    tipo: row.tipo as Competition["tipo"],
    fecha: String(row.fecha),
    fechaFin: String(row.fecha_fin),
    sede: String(row.sede),
    sesiones: 0,
    requeridos: 0,
    confirmados: 0,
    estado: row.estado as Competition["estado"],
    aprobacion: String(row.aprobacion),
  }));

  return buildRefereeCompetitionHistory(competitions, assignments);
}

export const refereeService = {
  getReferees: async (params?: {
    zona?: string;
    nivel?: string;
    estado?: string;
    q?: string;
    user?: SessionUser;
  }): Promise<Referee[]> => {
    await expireStaleSanctions();
    const supabase = db();
    let query = supabase.from("referees").select("*").order("nombre");

    const userZone =
      params?.user?.role === "delegado_zona" && params.user.zona
        ? resolveZoneCode(params.user.zona)
        : undefined;
    if (userZone) {
      query = query.eq("zona", userZone);
    }

    if (params?.zona && params.zona !== "TODAS") {
      const zone = resolveZoneCode(params.zona) ?? params.zona;
      query = query.eq("zona", zone);
    }
    if (params?.nivel && params.nivel !== "TODOS") {
      query = query.eq("nivel", params.nivel);
    }
    if (params?.estado && params.estado !== "TODOS") {
      query = query.eq("estado", params.estado);
    }
    if (params?.q?.trim()) {
      const term = params.q.trim().replace(/[%_]/g, "");
      if (term) {
        query = query.ilike("nombre", `%${term}%`);
      }
    }

    const { data } = await query;
    return (data ?? []).map((r) => mapReferee(r as Record<string, unknown>));
  },

  getReferee: async (id: string): Promise<Referee | undefined> => {
    const supabase = db();
    const { data } = await supabase.from("referees").select("*").eq("id", id).single();
    return data ? mapReferee(data as Record<string, unknown>) : undefined;
  },

  getRefereesByIds: async (ids: string[]): Promise<Map<string, Referee>> => {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, Referee>();
    if (unique.length === 0) return map;
    const supabase = db();
    const { data } = await supabase.from("referees").select("*").in("id", unique);
    for (const row of data ?? []) {
      const referee = mapReferee(row as Record<string, unknown>);
      map.set(referee.id, referee);
    }
    return map;
  },

  createReferee: async (input: Omit<Referee, "id" | "iniciales">): Promise<Referee> => {
    const supabase = db();
    const { count } = await supabase.from("referees").select("*", { count: "exact", head: true });
    const id = `j${String((count ?? 0) + 1).padStart(3, "0")}`;
    const iniciales = input.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const row = refereeToDbRow({
      ...input,
      id,
      iniciales,
      zona: normalizeZoneInput(input.zona) ?? input.zona,
    });
    const { data, error } = await supabase.from("referees").insert(row).select().single();
    if (error) throw error;
    await pushActivity({
      tipo: "cambio",
      actor: "Sistema",
      accion: "registró al juez",
      evento: input.nombre,
      hace: "ahora",
    });
    return mapReferee(data as Record<string, unknown>);
  },

  updateReferee: async (id: string, patch: Partial<Referee>): Promise<Referee | undefined> => {
    const supabase = db();
    const merged = { ...patch };
    if (patch.zona !== undefined) {
      merged.zona = normalizeZoneInput(patch.zona) ?? patch.zona;
    }
    if (typeof merged.nombre === "string" && merged.nombre.trim()) {
      merged.iniciales = merged.nombre
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    const dbPatch = refereeToDbRow(merged);
    const { data, error } = await supabase
      .from("referees")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
    return mapReferee(data as Record<string, unknown>);
  },

  deleteReferee: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referees").delete().eq("id", id);
    return !error;
  },

  getJudgeProfile: async (
    refereeId: string,
    getExamsFn: (id: string) => Promise<import("@/lib/types").RefereeExam[]>,
    getReportsFn: (id: string) => Promise<import("@/lib/types").RefereeReport[]>,
  ): Promise<JudgeProfile | undefined> => {
    const supabase = db();
    const { data } = await supabase.from("referees").select("*").eq("id", refereeId).single();
    const referee = data ? mapReferee(data as Record<string, unknown>) : undefined;
    if (!referee) return undefined;
    const [exams, reports, sanctions, competitionHistory] = await Promise.all([
      getExamsFn(refereeId),
      getReportsFn(refereeId),
      listRefereeSanctions(refereeId),
      loadRefereeCompetitionHistory(refereeId),
    ]);
    return computeJudgeProfile(referee, exams, reports, sanctions, competitionHistory);
  },

  listRefereeSanctions,
  getActiveSanction,
  createRefereeSanction,
  revokeRefereeSanction,
  markSanctionDelegateNotified,
  getSanctionAlerts,
  expireStaleSanctions,
};
