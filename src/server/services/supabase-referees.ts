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
import {
  RefereeAssignedError,
  RefereeHasClaimsError,
} from "@/lib/competitions/service-types";
import {
  db,
  fetchAllPagesOf,
  fetchAllRows,
  fetchAllRowsIn,
  isMissingTableError,
  pushActivity,
} from "./supabase-helpers";

async function loadRefereeCompetitionHistory(
  refereeId: string,
): Promise<RefereeCompetitionHistoryItem[]> {
  const supabase = db();
  const { data: assignmentRows, error: assignmentsError } = await supabase
    .from("roster_assignments")
    .select("competition_id, slot_key, flags")
    .eq("referee_id", refereeId);
  // Una lista vacía por fallo de lectura dice «este juez no ha arbitrado
  // nunca», y este historial es lo que se mira para decidir un ascenso. Las
  // sanciones del mismo perfil ya lanzaban por esta razón; esto se había
  // quedado atrás.
  if (assignmentsError) throw new Error(`roster_assignments: ${assignmentsError.message}`);

  const assignments = (assignmentRows ?? []).map((row) => ({
    competitionId: String(row.competition_id),
    slotKey: String(row.slot_key),
    flags: row.flags as Record<string, unknown> | null,
  }));
  const ids = [...new Set(assignments.map((row) => row.competitionId))];
  if (ids.length === 0) return [];

  const { data: competitionRows, error: competitionsError } = await supabase
    .from("competitions")
    .select("id, nombre, tipo, fecha, fecha_fin, sede, estado, aprobacion")
    .in("id", ids);
  // Ídem: aquí las designaciones ya constan, así que perder los campeonatos
  // deja un historial recortado, que engaña más que uno vacío.
  if (competitionsError) throw new Error(`competitions: ${competitionsError.message}`);

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
    // El segundo criterio no es decorativo: sin un desempate estable, dos
    // jueces con el mismo nombre pueden salir en distinto orden entre páginas
    // y la paginación duplicaría uno y se saltaría otro.
    let query = supabase.from("referees").select("*").order("nombre").order("id");

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

    // Un censo vacío por un fallo de lectura no es «no hay jueces»: dejaba el
    // directorio en blanco, el panel de la tarima sin nadie a quien asignar y
    // la bandeja de aprobación mostrando identificadores en crudo. Y uno
    // truncado tampoco: PostgREST corta en 1000 filas y el juez 1001 no
    // aparecía ni en el directorio ni en el desplegable de designación, sin
    // que nada lo dijera.
    const data = await fetchAllPagesOf<Record<string, unknown>>("referees", (from, to) =>
      query.range(from, to),
    );
    return data.map((r) => mapReferee(r));
  },

  getReferee: async (id: string): Promise<Referee | undefined> => {
    const supabase = db();
    const { data, error } = await supabase.from("referees").select("*").eq("id", id).single();
    // PGRST116 es «ninguna fila», que sí es una respuesta. Cualquier otro error
    // se devolvía como «Juez no encontrado», y desde ahí se decide si se puede
    // sancionar, designar o liquidar a esa persona.
    if (error && error.code !== "PGRST116") throw new Error(`referees: ${error.message}`);
    return data ? mapReferee(data as Record<string, unknown>) : undefined;
  },

  getRefereesByIds: async (ids: string[]): Promise<Map<string, Referee>> => {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, Referee>();
    if (unique.length === 0) return map;
    // Quien no aparece en el mapa se descarta silenciosamente aguas abajo: un
    // fallo, un `.in()` demasiado largo o el corte de PostgREST en 1000 filas
    // borraban liquidaciones enteras del resumen de compensación.
    const data = await fetchAllRowsIn("referees", "id", unique);
    for (const row of data) {
      const referee = mapReferee(row as Record<string, unknown>);
      map.set(referee.id, referee);
    }
    return map;
  },

  createReferee: async (input: Omit<Referee, "id" | "iniciales">): Promise<Referee> => {
    const supabase = db();
    // max(jN)+1 en vez de count(): tras un borrado, count+1 colisiona con una
    // PK existente y el alta de jueces queda rota para siempre. Mismo criterio
    // que el backend en memoria. El reintento cubre altas concurrentes.
    //
    // Paginado y con el error a la vista: PostgREST corta en 1000 filas, así que
    // con un censo mayor el máximo se calculaba sobre un trozo arbitrario y el
    // alta chocaba con identificadores ya usados; y si la lectura fallaba,
    // `maxSeq` se quedaba en 0 y se intentaba dar de alta j001 otra vez.
    const idRows = await fetchAllRows("referees", "id", "id");
    let maxSeq = 0;
    for (const r of idRows) {
      const m = /^j(\d+)$/.exec(String(r.id));
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
    }
    const iniciales = input.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    let data: Record<string, unknown> | null = null;
    let error: { code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = `j${String(maxSeq + 1 + attempt).padStart(3, "0")}`;
      const row = refereeToDbRow({
        ...input,
        id,
        iniciales,
        zona: normalizeZoneInput(input.zona) ?? input.zona,
      });
      const result = await supabase.from("referees").insert(row).select().single();
      data = result.data as Record<string, unknown> | null;
      error = result.error;
      // 23505 = unique_violation: otro alta concurrente ganó ese id; probar el siguiente.
      if (!error || error.code !== "23505") break;
    }
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
    // Una escritura fallida se devolvía como «no encontrado»: la ruta acababa
    // diciendo «Juez no encontrado» de un juez que había cargado dos líneas
    // antes, y quien editaba la ficha se quedaba sin saber si se guardó.
    // PGRST116 sí es «ninguna fila».
    if (error && error.code !== "PGRST116") throw new Error(`referees: ${error.message}`);
    if (!data) return undefined;
    return mapReferee(data as Record<string, unknown>);
  },

  deleteReferee: async (id: string): Promise<boolean> => {
    const supabase = db();
    // Las liquidaciones cuelgan del juez con ON DELETE CASCADE (024:17), igual
    // que las del campeonato: borrar la ficha se llevaba su dinero, incluido el
    // ya pagado. Mismo corte que en deleteCompetition.
    const { count: claims, error: claimsError } = await supabase
      .from("judge_compensation_claims")
      .select("id", { count: "exact", head: true })
      .eq("referee_id", id);
    // Ídem que en deleteCompetition: solo la tabla ausente vale como «no hay
    // nada que proteger»; con cualquier otro error no se borra.
    if (claimsError && !isMissingTableError(claimsError)) {
      throw new Error(
        `No se pudo comprobar si el juez tiene liquidaciones (${claimsError.message}). No se ha borrado nada.`,
      );
    }
    if (!claimsError && (claims ?? 0) > 0) {
      throw new RefereeHasClaimsError(claims ?? 0);
    }
    // `roster_assignments.referee_id` referencia a `referees(id)` sin ON DELETE
    // (001:81): la base rechazaba el borrado con un 23503, el servicio devolvía
    // `false` y la ruta contestaba «Juez no encontrado» sobre un juez que está a
    // la vista en el directorio. Se cuenta antes para poder decir en qué está
    // metido.
    const { data: assignedRows, error: assignedError } = await supabase
      .from("roster_assignments")
      .select("competition_id")
      .eq("referee_id", id);
    if (assignedError) {
      throw new Error(
        `No se pudo comprobar si el juez está designado en alguna tarima (${assignedError.message}). No se ha borrado nada.`,
      );
    }
    const assignedCompetitions = new Set(
      (assignedRows ?? []).map((row) => String(row.competition_id)),
    );
    if (assignedCompetitions.size > 0) {
      throw new RefereeAssignedError(assignedCompetitions.size);
    }

    // select("id") devuelve las filas borradas: sin él, borrar un id
    // inexistente respondía {deleted:true} en vez de 404.
    const { data, error } = await supabase.from("referees").delete().eq("id", id).select("id");
    // 23503 = foreign_key_violation: le asignaron un hueco entre la comprobación
    // y el borrado. Mismo mensaje que el corte de arriba, no un 404 falso.
    if (error?.code === "23503") throw new RefereeAssignedError(1);
    // Cualquier otro error del borrado se decía como «Juez no encontrado»,
    // de un juez que sigue a la vista en el directorio. La ruta tiene `catch`.
    if (error) throw new Error(`referees: ${error.message}`);
    return (data ?? []).length > 0;
  },

  getJudgeProfile: async (
    refereeId: string,
    getExamsFn: (id: string) => Promise<import("@/lib/types").RefereeExam[]>,
    getReportsFn: (id: string) => Promise<import("@/lib/types").RefereeReport[]>,
  ): Promise<JudgeProfile | undefined> => {
    const supabase = db();
    const { data, error } = await supabase
      .from("referees")
      .select("*")
      .eq("id", refereeId)
      .single();
    if (error && error.code !== "PGRST116") throw new Error(`referees: ${error.message}`);
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
