import { rosterTemplateHash } from "@/lib/roster-template-hash";
import { validateRosterOperation } from "@/lib/roster-rules";
import { formatRosterExport } from "@/lib/roster-export";
import { enumerateSlotKeys, pruneAssignments } from "@/lib/roster-template";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import type {
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  FlagsMap,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
  SlotFlags,
} from "@/lib/types";
import {
  RosterPaidClaimError,
  RosterTemplateConflictError,
} from "@/lib/competitions/service-types";
import { paidClaimTemplateMessage } from "@/lib/roster-paid-claims";
import { mapHistory } from "@/server/db/mappers";
import {
  db,
  getCompetitionTemplate,
  loadPaidClaimRefereeIds,
  loadRosterAssignmentData,
  pushHistory,
  syncCompetitionCoverage,
} from "./supabase-helpers";

import { startRead } from "./supabase-roster-shared";

/** Tarima: leer, plantilla, marcas de hueco, historial, acta y contadores de navegación. Se compone en `rosterService` (supabase-roster.ts). */
export const rosterPlantillaService = {
  getRoster: async (
    competitionId: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    // Paraleliza las tres lecturas (existencia, plantilla, asignaciones) en vez
    // de encadenarlas: mismo trabajo, ~1 round-trip de latencia en vez de 3.
    const [comp, template, assignmentData] = await Promise.all([
      getCompetitionFn(competitionId),
      getCompetitionTemplate(competitionId),
      loadRosterAssignmentData(competitionId),
    ]);
    if (!comp) return undefined;
    const { assignments, flags, crossZoneMap } = assignmentData;
    return { template: template ?? [], assignments, flags, crossZoneMap };
  },

  saveCompetitionTemplate: async (
    competitionId: string,
    template: RosterSession[],
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    baseHash?: string,
  ): Promise<
    | { template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }
    | undefined
  > => {
    const supabase = db();
    // Las tres lecturas de partida (campeonato, plantilla guardada para la
    // huella y asignaciones actuales) son independientes: van en paralelo, no
    // en serie. Los errores se miran en el mismo orden que antes: si el
    // campeonato no existe se devuelve `undefined` aunque las otras fallen.
    const readCurrentTemplate =
      baseHash !== undefined ? startRead(getCompetitionTemplate(competitionId)) : undefined;
    const readExisting = startRead(
      Promise.resolve(
        supabase
          .from("roster_assignments")
          .select("slot_key, referee_id")
          .eq("competition_id", competitionId),
      ),
    );
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    // Concurrencia optimista: si la plantilla guardada ya no es la que el
    // usuario abrió, otra persona la ha cambiado entretanto.
    if (readCurrentTemplate) {
      const current = (await readCurrentTemplate()) ?? [];
      if (rosterTemplateHash(current) !== baseHash) throw new RosterTemplateConflictError();
    }
    const validKeys = new Set(enumerateSlotKeys(template));
    const { data: existingRows, error: existingError } = await readExisting();
    // Tragarse este error dejaba las filas huérfanas en la base de datos: al
    // volver a crear más adelante una sesión con el mismo código, el juez que
    // ocupaba aquel hueco reaparecía asignado sin que nadie lo pusiera.
    if (existingError) throw new Error(`roster_assignments: ${existingError.message}`);
    const stale = (existingRows ?? []).filter(
      (row) => !validKeys.has(String(row.slot_key)),
    );
    // Quitar una sesión de la plantilla borra los huecos de esa sesión, y por
    // ahí se colaba lo que `clearSlot` y `clearRosterAssignments` sí impiden:
    // dejar sin puesto a un juez con la liquidación ya pagada. La comprobación
    // va ANTES de guardar la plantilla; si no, el corte dejaba la plantilla
    // cambiada y las asignaciones intactas.
    if (stale.length > 0) {
      const paid = await loadPaidClaimRefereeIds(competitionId);
      if (paid.size > 0) {
        const afectados = new Set(
          stale.map((row) => String(row.referee_id)).filter((id) => paid.has(id)),
        );
        if (afectados.size > 0) {
          throw new RosterPaidClaimError(paidClaimTemplateMessage(afectados.size));
        }
      }
    }
    // Plantilla y número de sesiones en un único UPDATE (antes eran dos sobre
    // la misma fila, el segundo al final): un round-trip menos y nunca queda
    // una plantilla nueva con el recuento de sesiones viejo. Si falla hay que
    // PARAR, igual que en persistCompetitionTemplate: seguir podaría
    // asignaciones vivas contra una plantilla que la BD no llegó a guardar.
    const { error: templateError } = await supabase
      .from("competitions")
      .update({ template, sesiones: template.length })
      .eq("id", competitionId);
    if (templateError) throw new Error(`competitions.template: ${templateError.message}`);
    // Un único DELETE ... IN para las filas huérfanas (antes: un round-trip por
    // slot). Las filas restantes ya tienen sus flags correctos, así que no hace
    // falta reescribirlos uno a uno.
    const staleKeys = stale.map((row) => String(row.slot_key));
    if (staleKeys.length > 0) {
      const { error: deleteError } = await supabase
        .from("roster_assignments")
        .delete()
        .eq("competition_id", competitionId)
        .in("slot_key", staleKeys);
      if (deleteError) throw new Error(`roster_assignments: ${deleteError.message}`);
    }
    const { assignments, flags } = await loadRosterAssignmentData(competitionId);
    const pruned = pruneAssignments(template, assignments, flags);
    // Cobertura e historial en paralelo. La cobertura relee la plantilla
    // guardada, no la de esta petición: si otro delegado guarda la suya a la
    // vez y su UPDATE llega después, la cobertura tiene que contar con la que
    // queda en la base, no con esta (igual que en clearSlot).
    await Promise.all([
      syncCompetitionCoverage(competitionId),
      pushHistory({
        competitionId,
        at: new Date().toISOString(),
        actor,
        action: "Plantilla actualizada",
        detail: `${template.length} sesiones`,
      }),
    ]);
    return { template, assignments: pruned.assignments, flags: pruned.flags };
  },

  setSlotFlags: async (
    competitionId: string,
    slotKey: string,
    flags: SlotFlags,
    actor: string,
  ): Promise<{ flags: FlagsMap } | { error: string }> => {
    // Una sola lectura de roster_assignments (asignaciones + flags) en paralelo
    // con la plantilla, en vez de loadAssignments + loadFlags + template en serie.
    const [{ assignments, flags: currentFlags }, templateRaw] = await Promise.all([
      loadRosterAssignmentData(competitionId),
      getCompetitionTemplate(competitionId),
    ]);
    const refereeId = assignments[slotKey];
    if (!refereeId) {
      return { error: "Asigna un juez antes de marcar flags" };
    }
    const supabase = db();
    const merged: SlotFlags = {
      compartido: flags.compartido ?? false,
      intercambio: flags.intercambio ?? false,
    };
    const payload = merged.compartido || merged.intercambio ? merged : {};

    // Quitar el * (compartido) puede dejar una doble asignación del mismo juez en
    // slots solapados que antes el override permitía. Revalidamos con los flags
    // resultantes antes de persistir; validateRosterOperation ya respeta el * del
    // otro slot en conflicto, así que solo rechaza los solapes realmente ilegales.
    const template = templateRaw ?? [];
    const resultingFlags: FlagsMap = { ...currentFlags, [slotKey]: payload };
    const revalidation = validateRosterOperation({
      template,
      assignments,
      slotKey,
      refereeId,
      flags: resultingFlags,
    });
    if (!revalidation.ok) {
      return {
        error:
          revalidation.error ??
          "Quitar el * dejaría a ese juez en dos puestos solapados de la misma sesión",
      };
    }

    const { data: flagged, error: writeError } = await supabase
      .from("roster_assignments")
      .update({ flags: payload })
      .eq("competition_id", competitionId)
      .eq("slot_key", slotKey)
      // El marcador es de ESE juez en ese hueco: si otro usuario lo acaba de
      // sustituir, no se le aplica al nuevo.
      .eq("referee_id", refereeId)
      .select("slot_key");
    if (writeError) return { error: "No se pudieron guardar los marcadores del slot" };
    if ((flagged ?? []).length === 0) {
      return { error: "Otro usuario cambió ese hueco mientras lo editabas. Actualiza la tarima." };
    }
    // Relectura e historial son independientes (y pushHistory nunca lanza): en
    // paralelo, un round-trip menos en cada clic sobre el * o el intercambio.
    const [{ flags: allFlags }] = await Promise.all([
      loadRosterAssignmentData(competitionId),
      pushHistory({
        competitionId,
        at: new Date().toISOString(),
        actor,
        action: "Flags slot",
        detail: slotKey,
      }),
    ]);
    return { flags: allFlags };
  },

  getRosterHistory: async (competitionId: string): Promise<RosterHistoryEntry[]> => {
    const supabase = db();
    const competitionColumn = (await import("./supabase-helpers").then((m) =>
      m.hasHistoryCompetitionColumn()
    ))
      ? "competition_id"
      : "event_id";
    const { data, error } = await supabase
      .from("roster_history")
      .select("*")
      .eq(competitionColumn, competitionId)
      .order("at", { ascending: false })
      // Cota superior: el historial crece sin límite y la UI solo muestra los
      // movimientos recientes; sin esto la respuesta crecía sin tope.
      .limit(200);
    // Un historial vacío por fallo de lectura dice «aquí no ha pasado nada», y
    // es justo el sitio donde se mira quién tocó qué. La ruta ya tiene `catch`
    // y la pantalla, su estado de error con reintento.
    if (error) throw new Error(`roster_history: ${error.message}`);
    return (data ?? []).map((r) => mapHistory(r as Record<string, unknown>));
  },

  exportRoster: async (
    competitionId: string,
    getRosterFn: (id: string) => Promise<
      | { template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }
      | undefined
    >,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    const [roster, comp] = await Promise.all([
      getRosterFn(competitionId),
      getCompetitionFn(competitionId),
    ]);
    if (!roster || !comp) return null;
    const supabase = db();
    // Solo los jueces asignados a la tarima, no el censo completo.
    const assignedIds = [...new Set(Object.values(roster.assignments).filter(Boolean))];
    const { data: referees, error: refereesError } = assignedIds.length
      ? await supabase.from("referees").select("id, nombre, nivel").in("id", assignedIds)
      : { data: [], error: null };
    // Sin esto, un fallo de lectura dejaba el mapa vacío y el acta salía con
    // TODOS los puestos como «VACÍO»: el documento oficial de la designación
    // afirmando que no hay nadie designado. La ruta ya tiene `catch`.
    if (refereesError) throw new Error(`referees: ${refereesError.message}`);
    const refMap = new Map((referees ?? []).map((r) => [r.id, r]));
    return formatRosterExport(
      comp,
      roster.template,
      roster.assignments,
      (id) => {
        const r = refMap.get(id);
        return r ? { nombre: String(r.nombre), nivel: String(r.nivel) } : undefined;
      },
      roster.flags,
    );
  },

  getNavCounts: async (
    user: SessionUser | undefined,
    getCompetitionsFn: (u?: SessionUser) => Promise<Competition[]>,
    getApprovalsFn: (u?: SessionUser) => Promise<ApprovalProposal[]>,
  ) => {
    const competitions = await getCompetitionsFn(user);
    const approvals = (await getApprovalsFn(user)).filter((a) => a.status === "pendiente").length;
    return {
      competitions: competitions.length,
      approvals,
      activeRosterHref: pickActiveRosterHref(competitions),
    };
  },
};
