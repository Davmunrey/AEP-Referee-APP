import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import {
  competitionDedupKey,
  competitionsToRemoveInGroup,
  groupCompetitionDuplicates,
} from "@/lib/competition-dedup";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import { applyCoverageToCompetition } from "@/lib/roster-coverage";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import {
  buildRefereeBusyMap,
  competitionDateRange,
  type RefereeBusyMap,
} from "@/lib/roster-conflicts";
import type { Competition, RosterSession, SessionUser } from "@/lib/types";
import { CompetitionHasClaimsError, UserFacingServiceError } from "@/lib/competitions/service-types";
import { mapCompetition, competitionPatchToDb } from "@/server/db/mappers";
import { zoneVisibilityFilter } from "@/lib/zone-scope";
import {
  cachedLoadAllAssignments,
  db,
  fetchAllPagesOf,
  fetchAllRowsIn,
  isMissingTableError,
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
    // Esta lista alimenta el listado, el calendario, la analítica y el hub de
    // compensación: tragarse el error dejaba «no hay campeonatos» en las cuatro
    // pantallas y, en el hub, un total de 0 € presentado como cifra buena. Y
    // leerla sin paginar la cortaba en 1000 filas —varias temporadas de
    // calendario— haciendo desaparecer los campeonatos más recientes de las
    // mismas cuatro pantallas. El desempate por `id` mantiene el orden estable
    // entre páginas cuando varios comparten fecha.
    const compQuery = supabase.from("competitions").select("*").order("fecha").order("id");
    const [data, assignmentsByComp] = await Promise.all([
      fetchAllPagesOf<Record<string, unknown>>("competitions", (from, to) =>
        compQuery.range(from, to),
      ),
      cachedLoadAllAssignments(),
    ]);
    const list = enrichCompetitionRows(data, assignmentsByComp);
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona);
      return list.filter((c) => resolveZoneCode(c.zona) === userZone);
    }
    return list;
  },

  /** Lista ligera {id, nombre} para desplegables: sin escanear asignaciones ni
   * calcular cobertura (a diferencia de getCompetitions). */
  getCompetitionOptions: async (
    user?: SessionUser,
  ): Promise<{ id: string; nombre: string }[]> => {
    const supabase = db();
    const { data, error } = await supabase
      .from("competitions")
      .select("id, nombre, zona")
      .order("fecha");
    if (error) throw new Error(`competitions: ${error.message}`);
    let list = (data ?? []) as { id: string; nombre: string; zona: string }[];
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona);
      list = list.filter((c) => resolveZoneCode(String(c.zona)) === userZone);
    }
    return list.map((c) => ({ id: String(c.id), nombre: String(c.nombre) }));
  },

  getCompetition: async (id: string): Promise<Competition | undefined> => {
    const supabase = db();
    // Fila y asignaciones en paralelo (antes eran secuenciales). Es una función
    // muy frecuente: detalle, compensación y cada mutación de roster.
    const [{ data, error }, assignments] = await Promise.all([
      supabase.from("competitions").select("*").eq("id", id).single(),
      loadAssignments(id),
    ]);
    // Es la lectura más usada de la aplicación: el detalle, la compensación y
    // CADA mutación de tarima empiezan por aquí, y todas contestan «Competición
    // no encontrada» cuando devuelve `undefined`. Con el error descartado, un
    // corte de un segundo hacía que el campeonato dejara de existir para todo
    // el mundo a la vez, en mitad de una competición. PGRST116 sí es «no hay
    // ninguna fila».
    if (error && error.code !== "PGRST116") throw new Error(`competitions: ${error.message}`);
    if (!data) return undefined;
    const assignmentsByComp = new Map([[id, assignments]]);
    return enrichCompetitionRows([data as Record<string, unknown>], assignmentsByComp)[0];
  },

  /** Contadores de navegación sin cargar plantillas ni asignaciones completas. */
  getNavCountsFast: async (user?: SessionUser) => {
    const supabase = db();
    const userZone =
      user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
    // Ver `zone-scope`: una zona ilegible no es «sin restricción».
    const visibleEnZona = zoneVisibilityFilter(user);

    let compQuery = supabase.from("competitions").select("id, fecha, estado").order("fecha");
    // `competitions.zona` es FK canónica, pero `approval_proposals.zona` es
    // texto libre con códigos anteriores a la 013: con `.eq` el delegado veía un
    // contador de aprobaciones más bajo que su propia bandeja. Se traen las
    // pendientes (son pocas) y se cuentan canonicalizando.
    const apprQuery = supabase
      .from("approval_proposals")
      .select("zona")
      .eq("status", "pendiente");

    if (userZone) {
      compQuery = compQuery.eq("zona", userZone);
    }

    const [{ data: comps }, { data: apprRows }] = await Promise.all([compQuery, apprQuery]);
    const apprCount = (apprRows ?? []).filter(
      (row) => visibleEnZona(String(row.zona ?? "")),
    ).length;
    const navComps = (comps ?? []).map((r) => ({
      id: String(r.id),
      fecha: String(r.fecha),
      estado: String(r.estado) as Competition["estado"],
    }));

    return {
      competitions: navComps.length,
      approvals: apprCount,
      activeRosterHref: pickActiveRosterHref(navComps),
    };
  },

  createCompetition: async (
    input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
    context?: { existing?: { id: string; nombre: string; fecha: string; tipo: string }[] },
  ): Promise<Competition> => {
    const supabase = db();
    // En importaciones por lotes se pasa `context.existing` para dedupe + max-id
    // y evitar releer la tabla en cada inserción (O(N²) → O(N)). Sin contexto,
    // comportamiento idéntico: una lectura ligera de la tabla.
    const existingRows =
      context?.existing ??
      (await (async () => {
        const { data, error } = await supabase
          .from("competitions")
          .select("id, nombre, fecha, tipo");
        // Antes se tragaba el error: la lista vacía saltaba el dedupe y dejaba
        // maxNum=0 → id "evt-001" en colisión con el ya existente.
        if (error) throw new Error(`competitions: ${error.message}`);
        return (data ?? []).map((r) => ({
          id: String(r.id),
          nombre: String(r.nombre),
          fecha: String(r.fecha),
          tipo: String(r.tipo),
        }));
      })());
    const key = competitionDedupKey(input);
    const dupe = existingRows.find(
      (r) =>
        competitionDedupKey({
          nombre: r.nombre,
          fecha: r.fecha,
          tipo: r.tipo,
        }) === key,
    );
    if (dupe) {
      throw new Error(
        `Ya existe un campeonato igual (${String(dupe.nombre)}, ${String(dupe.fecha)}). Id: ${String(dupe.id)}`,
      );
    }
    const maxNum = existingRows.reduce((max, row) => {
      const m = /^evt-(\d+)$/i.exec(String(row.id));
      const n = m ? Number.parseInt(m[1]!, 10) : 0;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    // Reintento ante 23505 (unique_violation): dos creaciones concurrentes
    // calculan el mismo evt-NNN; el perdedor prueba el siguiente número en vez
    // de fallar con un 500.
    let data: Record<string, unknown> | null = null;
    let error: { code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = `evt-${String(maxNum + 1 + attempt).padStart(3, "0")}`;
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
      const result = await supabase.from("competitions").insert(row).select().single();
      data = result.data as Record<string, unknown> | null;
      error = result.error;
      if (!error || error.code !== "23505") break;
    }
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
    // Las liquidaciones cuelgan del campeonato con ON DELETE CASCADE (024:16),
    // así que borrarlo se las llevaba en silencio, incluidas las ya pagadas.
    // Aquí se corta antes: el dinero liquidado no se tira por deduplicar un
    // calendario. La migración 036 pone además RESTRICT en la propia clave
    // ajena, para que no dependa solo de este camino.
    const { count: claims, error: claimsError } = await supabase
      .from("judge_compensation_claims")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", id);
    // Solo la tabla ausente (024 sin aplicar) significa «no hay nada que
    // proteger». Cualquier otro error dejaba pasar el borrado sin saber si
    // había dinero detrás, y la cascada se lo llevaba.
    if (claimsError && !isMissingTableError(claimsError)) {
      throw new Error(
        `No se pudo comprobar si el campeonato tiene liquidaciones (${claimsError.message}). No se ha borrado nada.`,
      );
    }
    if (!claimsError && (claims ?? 0) > 0) {
      throw new CompetitionHasClaimsError(claims ?? 0);
    }

    const [hasApprovalCols, hasHistoryCol] = await Promise.all([
      hasApprovalCompetitionColumns(),
      hasHistoryCompetitionColumn(),
    ]);
    const approvalCompetitionColumn = hasApprovalCols ? "competition_id" : "event_id";
    const historyCompetitionColumn = hasHistoryCol ? "competition_id" : "event_id";
    // Los tres borrados hijos son independientes entre sí, pero su resultado no
    // se miraba. `supabase-js` no lanza: devuelve `{ error }`. Si uno fallaba
    // —RLS, un corte, la tabla ocupada— el campeonato se borraba igual y sus
    // filas se quedaban apuntando a un id que ya no existe.
    //
    // Y ese id vuelve: `createCompetition` numera con `max(evt-NNN) + 1`, así
    // que borrar el último campeonato y crear otro reutiliza su identificador.
    // La tarima huérfana se convertía entonces en la tarima del campeonato
    // nuevo, sin que nadie la hubiera asignado.
    //
    // No hay transacción disponible desde aquí, así que la regla es: si algún
    // hijo no se ha podido borrar, el campeonato NO se borra y se dice por qué.
    const hijos = await Promise.all([
      supabase.from("roster_assignments").delete().eq("competition_id", id),
      supabase.from("approval_proposals").delete().eq(approvalCompetitionColumn, id),
      supabase.from("roster_history").delete().eq(historyCompetitionColumn, id),
    ]);
    const nombresHijos = ["la tarima", "las propuestas de aprobación", "la bitácora"];
    const fallo = hijos.findIndex(
      (r) => r.error != null && !isMissingTableError(r.error),
    );
    if (fallo >= 0) {
      const err = hijos[fallo]!.error!;
      console.error("[deleteCompetition.hijos]", id, nombresHijos[fallo], err.message);
      throw new UserFacingServiceError(
        `No se pudo borrar ${nombresHijos[fallo]} del campeonato. No se ha borrado el campeonato; vuelve a intentarlo.`,
        409,
      );
    }
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
        try {
          const ok = await deleteCompetitionFn(c.id);
          if (ok) removed.push(c.id);
        } catch (err) {
          // Un duplicado con liquidaciones se conserva en lugar de borrarse.
          // El criterio de qué copia sobrevive (`pickCompetitionToKeep`) solo
          // mira la tarima, así que la marcada para eliminar puede ser
          // justamente la que tiene el dinero: ante la duda, no se toca.
          if (err instanceof CompetitionHasClaimsError) {
            kept.push(c.id);
            continue;
          }
          throw err;
        }
      }
    }
    return { removed, kept, groups: groups.length };
  },

  /**
   * Jueces ya asignados a OTRO campeonato que solapa fechas con este.
   *
   * Las reglas de tarima solo miran dentro de un campeonato, así que sentar al
   * mismo juez en dos tarimas del mismo fin de semana no producía ningún aviso
   * y el choque se descubría el día de la competición.
   */
  getRefereeBusyMap: async (competitionId: string): Promise<RefereeBusyMap> => {
    const supabase = db();
    const { data: self, error: selfError } = await supabase
      .from("competitions")
      .select("id, fecha, fecha_fin")
      .eq("id", competitionId)
      .maybeSingle();
    if (selfError) throw new Error(`competitions: ${selfError.message}`);
    const range = competitionDateRange({
      fecha: self?.fecha as string | undefined,
      fechaFin: self?.fecha_fin as string | undefined,
    });
    if (!self || !range) return {};

    // Solape de rangos en SQL: empieza antes de que acabemos y acaba después de
    // que empecemos. `fecha_fin` es NOT NULL en el esquema.
    const { data: others, error: othersError } = await supabase
      .from("competitions")
      .select("id, nombre, fecha, fecha_fin")
      .neq("id", competitionId)
      .lte("fecha", range.end)
      .gte("fecha_fin", range.start);
    if (othersError) throw new Error(`competitions: ${othersError.message}`);
    const overlapping = (others ?? []).map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre),
      fecha: String(row.fecha),
      fechaFin: String(row.fecha_fin),
    }));
    if (overlapping.length === 0) return {};

    // `roster_assignments` no tiene columna `id`: se ordena por `slot_key`, que
    // sí forma parte de su clave primaria.
    const rows = await fetchAllRowsIn(
      "roster_assignments",
      "competition_id",
      overlapping.map((c) => c.id),
      "slot_key",
    );
    return buildRefereeBusyMap({
      competition: { id: competitionId, fecha: range.start, fechaFin: range.end },
      others: overlapping,
      assignments: rows.map((row) => ({
        competitionId: String(row.competition_id),
        refereeId: String(row.referee_id),
      })),
    });
  },

  getCompetitionAvailability: async (competitionId: string): Promise<string[]> => {
    const supabase = db();
    const { data, error } = await supabase
      .from("competition_availability")
      .select("referee_id")
      .eq("competition_id", competitionId);
    // «Nadie ha confirmado» y «no he podido leerlo» llevan a decisiones
    // distintas al montar la tarima.
    if (error) throw new Error(`competition_availability: ${error.message}`);
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
