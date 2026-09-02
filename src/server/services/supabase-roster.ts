import { resolveZoneCode } from "@/lib/aep-zones";
import {
  isRosterLockedByApproval,
  rosterMutationBlockedMessage,
  ROSTER_IMPREVISTO_STATE,
} from "@/lib/roster-coverage";
import { isSlotKeyInTemplate, validateAssignment, validateRosterOperation } from "@/lib/roster-rules";
import { formatRosterExport } from "@/lib/roster-export";
import { enumerateSlotKeys, pruneAssignments } from "@/lib/roster-template";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import type {
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  Competition,
  FlagsMap,
  Referee,
  RoleKey,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
  SlotFlags,
} from "@/lib/types";
import { RosterSlotConflictError } from "@/lib/competitions/service-types";
import { mapApproval, mapHistory } from "@/server/db/mappers";
import {
  db,
  getCompetitionTemplate,
  hasApprovalCompetitionColumns,
  hasApprovalSubmitterColumns,
  loadAssignments,
  loadRosterAssignmentData,
  parseSlotKey,
  persistCompetitionTemplate,
  pushActivity,
  pushHistory,
  syncCompetitionCoverage,
} from "./supabase-helpers";

/** Entrada de una asignación dentro de un lote de importación. */
export interface RosterBatchAssignment {
  slotKey: string;
  refereeId: string;
  flags?: SlotFlags;
  crossZoneReason?: string;
}

/**
 * Núcleo puro de validateAssign: mismos checks, mismo orden y mismos mensajes,
 * pero sobre datos ya cargados (competición, juez y plantilla). Permite validar
 * sin volver a golpear la base de datos cuando el llamante ya tiene los datos.
 */
function validateAssignWithData(
  comp: Competition | undefined,
  referee: Referee | undefined,
  slotKey: string,
  template: RosterSession[],
): AssignValidation {
  if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
  const parsed = parseSlotKey(slotKey);
  if (!parsed) return { ok: false, error: "Slot inválido" };
  if (!isSlotKeyInTemplate(template, slotKey)) {
    return { ok: false, error: "El hueco no existe en la plantilla del campeonato" };
  }
  return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
}

export const rosterService = {
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
  ): Promise<
    | { template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }
    | undefined
  > => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    await persistCompetitionTemplate(competitionId, template);
    const supabase = db();
    const validKeys = new Set(enumerateSlotKeys(template));
    const { data: existingRows, error: existingError } = await supabase
      .from("roster_assignments")
      .select("slot_key")
      .eq("competition_id", competitionId);
    // Tragarse este error dejaba las filas huérfanas en la base de datos: al
    // volver a crear más adelante una sesión con el mismo código, el juez que
    // ocupaba aquel hueco reaparecía asignado sin que nadie lo pusiera.
    if (existingError) throw new Error(`roster_assignments: ${existingError.message}`);
    // Un único DELETE ... IN para las filas huérfanas (antes: un round-trip por
    // slot). Las filas restantes ya tienen sus flags correctos, así que no hace
    // falta reescribirlos uno a uno.
    const staleKeys = (existingRows ?? [])
      .map((row) => String(row.slot_key))
      .filter((key) => !validKeys.has(key));
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
    const { error: sessionsError } = await supabase
      .from("competitions")
      .update({ sesiones: template.length })
      .eq("id", competitionId);
    if (sessionsError) throw new Error(`competitions.sesiones: ${sessionsError.message}`);
    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Plantilla actualizada",
      detail: `${template.length} sesiones`,
    });
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

    const { error: writeError } = await supabase
      .from("roster_assignments")
      .update({ flags: payload })
      .eq("competition_id", competitionId)
      .eq("slot_key", slotKey);
    if (writeError) return { error: "No se pudieron guardar los marcadores del slot" };
    const allFlags = (await loadRosterAssignmentData(competitionId)).flags;
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Flags slot",
      detail: slotKey,
    });
    return { flags: allFlags };
  },

  validateAssign: async (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    getRefereeFn: (id: string) => Promise<Referee | undefined>,
  ): Promise<AssignValidation> => {
    // Las tres lecturas son independientes: en paralelo ahorran round-trips sin
    // cambiar la semántica (los checks se aplican después, en el mismo orden).
    const [comp, referee, templateRaw] = await Promise.all([
      getCompetitionFn(competitionId),
      getRefereeFn(refereeId),
      getCompetitionTemplate(competitionId),
    ]);
    return validateAssignWithData(comp, referee, slotKey, templateRaw ?? []);
  },

  assignReferee: async (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    getRefereeFn: (id: string) => Promise<Referee | undefined>,
    slotFlags?: SlotFlags,
    crossZoneReason?: string,
    expectedRefereeId?: string | null,
  ): Promise<{
    assignments?: AssignmentsMap;
    flags?: FlagsMap;
    crossZoneMap?: import("@/lib/types").CrossZoneMap;
    error?: string;
    conflict?: boolean;
  }> => {
    // Carga UNA vez, en paralelo, todo lo necesario: competición, juez,
    // asignaciones+flags actuales y plantilla. Antes validateAssign volvía a
    // cargar competición+juez+plantilla (≈10 consultas donde bastan ≈5); ahora
    // se validan esos mismos datos ya cargados y la plantilla se reutiliza en el
    // validateRosterOperation posterior.
    const [
      comp,
      referee,
      { assignments, flags: existingFlags, crossZoneMap: existingCrossZone, crossZoneReasons },
      templateRaw,
    ] = await Promise.all([
      getCompetitionFn(competitionId),
      getRefereeFn(refereeId),
      loadRosterAssignmentData(competitionId),
      getCompetitionTemplate(competitionId),
    ]);
    const template = templateRaw ?? [];
    const validation = validateAssignWithData(comp, referee, slotKey, template);
    if (!validation.ok) return { error: validation.error };
    if (!comp) return { error: "Competición no encontrada" };
    const blocked = rosterMutationBlockedMessage(comp.aprobacion);
    if (blocked) return { error: blocked };

    // Control de concurrencia optimista. El upsert no miraba quién ocupaba el
    // hueco, así que dos delegados sobre la misma tarima se pisaban: el segundo
    // sustituía al juez del primero sin error, sin aviso y sin rastro. Con el
    // ocupante esperado, una discrepancia se rechaza y el usuario recarga.
    // Sustituir a un juez sigue funcionando: el cliente manda el que ve.
    if (expectedRefereeId !== undefined) {
      const current = assignments[slotKey] ?? null;
      if (current !== expectedRefereeId) {
        const occupant = current ? await getRefereeFn(current) : undefined;
        return {
          conflict: true,
          error: current
            ? `Otro usuario asignó ${occupant?.nombre ?? "a otro juez"} a ese hueco. Actualiza la tarima antes de reasignar.`
            : "Otro usuario liberó ese hueco mientras lo editabas. Actualiza la tarima antes de reasignar.",
        };
      }
    }

    const supabase = db();
    // El * (compartido) del hueco existente o del nuevo permite forzar el solape.
    const operationFlags =
      slotFlags && (slotFlags.compartido || slotFlags.intercambio)
        ? { ...existingFlags, [slotKey]: slotFlags }
        : existingFlags;
    const operation = validateRosterOperation({
      template,
      assignments,
      slotKey,
      refereeId,
      flags: operationFlags,
    });
    if (!operation.ok) return { error: operation.error };

    const flagPayload =
      slotFlags && (slotFlags.compartido || slotFlags.intercambio)
        ? { compartido: Boolean(slotFlags.compartido), intercambio: Boolean(slotFlags.intercambio) }
        : existingFlags[slotKey] ?? {};

    const replacedRefereeId = assignments[slotKey];
    const isCrossZone =
      !!comp?.zona &&
      !!referee?.zona &&
      (resolveZoneCode(comp.zona) ?? comp.zona) !== (resolveZoneCode(referee.zona) ?? referee.zona);

    const { error: writeError } = await supabase.from("roster_assignments").upsert({
      competition_id: competitionId,
      slot_key: slotKey,
      referee_id: refereeId,
      flags: flagPayload,
      cross_zone: isCrossZone,
      cross_zone_reason: isCrossZone ? (crossZoneReason ?? null) : null,
    });
    // supabase-js no lanza: devuelve { error }. Sin esto, un fallo de escritura
    // (constraint, RLS, caída) respondería "OK" con el juez sin asignar.
    if (writeError) return { error: "No se pudo guardar la asignación" };

    // Relee una sola vez tras la escritura (antes: loadAssignments + loadFlags +
    // loadCrossZoneMap = 3 escaneos idénticos de la misma tabla).
    const {
      assignments: freshAssignments,
      flags: freshFlags,
      crossZoneMap: freshCrossZoneMap,
    } = await loadRosterAssignmentData(competitionId);
    const recheck = validateRosterOperation({
      template,
      assignments: freshAssignments,
      slotKey,
      refereeId,
      flags: freshFlags,
    });
    if (!recheck.ok) {
      // Deshacer no es borrar el hueco: si ya había un juez, el upsert lo
      // sobrescribió y el DELETE se lo llevaba por delante, de modo que una
      // colisión entre dos asignaciones simultáneas dejaba el puesto vacío en
      // vez de conservar al que ya estaba. Se restaura la fila anterior.
      const previousRefereeId = assignments[slotKey];
      if (previousRefereeId) {
        await supabase.from("roster_assignments").upsert({
          competition_id: competitionId,
          slot_key: slotKey,
          referee_id: previousRefereeId,
          flags: existingFlags[slotKey] ?? {},
          cross_zone: Boolean(existingCrossZone[slotKey]),
          cross_zone_reason: crossZoneReasons[slotKey] ?? null,
        });
      } else {
        await supabase
          .from("roster_assignments")
          .delete()
          .eq("competition_id", competitionId)
          .eq("slot_key", slotKey);
      }
      return { error: recheck.error };
    }

    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: isCrossZone ? "Asignación cross-zona" : "Asignación",
      // La sustitución queda registrada: antes el juez desplazado desaparecía
      // del historial y no había forma de saber quién estaba antes.
      detail: `${slotKey} → ${refereeId}${
        replacedRefereeId && replacedRefereeId !== refereeId ? ` (sustituye a ${replacedRefereeId})` : ""
      }${isCrossZone ? ` (${referee?.zona})` : ""}`,
    });
    return {
      assignments: { ...freshAssignments },
      flags: freshFlags,
      crossZoneMap: freshCrossZoneMap,
    };
  },

  /**
   * Aplica un lote de asignaciones con una única carga de datos y un único
   * upsert masivo. Sustituye el bucle secuencial de `assignReferee` por hueco
   * (≈6-8 consultas × N huecos) por: 4 lecturas iniciales en paralelo, 1 upsert,
   * 1 syncCompetitionCoverage y 1 entrada de history resumen. La semántica de
   * validación por entrada es idéntica a `assignReferee`: se valida
   * incrementalmente sobre un mapa de asignaciones que se actualiza con cada
   * entrada aceptada, respetando los flags (* compartido) igual que el flujo
   * individual.
   */
  assignRefereesBatch: async (
    competitionId: string,
    entries: RosterBatchAssignment[],
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    getRefereesByIdsFn: (ids: string[]) => Promise<Map<string, Referee>>,
  ): Promise<{
    results: { ok: boolean; error?: string }[];
    assignments: AssignmentsMap;
    flags: FlagsMap;
    crossZoneMap: import("@/lib/types").CrossZoneMap;
  }> => {
    const [comp, templateRaw, current, refMap] = await Promise.all([
      getCompetitionFn(competitionId),
      getCompetitionTemplate(competitionId),
      loadRosterAssignmentData(competitionId),
      getRefereesByIdsFn(entries.map((e) => e.refereeId)),
    ]);
    const template = templateRaw ?? [];
    const blocked = comp ? rosterMutationBlockedMessage(comp.aprobacion) : undefined;

    // Mapas de trabajo: parten del estado persistido y se van actualizando con
    // cada entrada aceptada, para que las validaciones posteriores del mismo
    // lote vean los huecos ya ocupados (igual que la recarga por hueco del flujo
    // secuencial). `rowsBySlot` deduplica por slot: si dos entradas apuntan al
    // mismo hueco, gana la última (idéntico a upsert).
    const workingAssignments: AssignmentsMap = { ...current.assignments };
    const workingFlags: FlagsMap = { ...current.flags };
    const rowsBySlot = new Map<
      string,
      {
        competition_id: string;
        slot_key: string;
        referee_id: string;
        flags: SlotFlags;
        cross_zone: boolean;
        cross_zone_reason: string | null;
      }
    >();
    const results: { ok: boolean; error?: string }[] = [];

    for (const entry of entries) {
      const referee = refMap.get(entry.refereeId);
      const validation = validateAssignWithData(comp, referee, entry.slotKey, template);
      if (!validation.ok) {
        results.push({ ok: false, error: validation.error });
        continue;
      }
      if (!comp) {
        results.push({ ok: false, error: "Competición no encontrada" });
        continue;
      }
      if (blocked) {
        results.push({ ok: false, error: blocked });
        continue;
      }

      const shared = Boolean(entry.flags && (entry.flags.compartido || entry.flags.intercambio));
      const operationFlags = shared
        ? { ...workingFlags, [entry.slotKey]: entry.flags! }
        : workingFlags;
      const operation = validateRosterOperation({
        template,
        assignments: workingAssignments,
        slotKey: entry.slotKey,
        refereeId: entry.refereeId,
        flags: operationFlags,
      });
      if (!operation.ok) {
        results.push({ ok: false, error: operation.error });
        continue;
      }

      const flagPayload: SlotFlags = shared
        ? {
            compartido: Boolean(entry.flags!.compartido),
            intercambio: Boolean(entry.flags!.intercambio),
          }
        : workingFlags[entry.slotKey] ?? {};
      const isCrossZone =
        !!comp.zona &&
        !!referee!.zona &&
        (resolveZoneCode(comp.zona) ?? comp.zona) !==
          (resolveZoneCode(referee!.zona) ?? referee!.zona);

      workingAssignments[entry.slotKey] = entry.refereeId;
      workingFlags[entry.slotKey] = flagPayload;
      rowsBySlot.set(entry.slotKey, {
        competition_id: competitionId,
        slot_key: entry.slotKey,
        referee_id: entry.refereeId,
        flags: flagPayload,
        cross_zone: isCrossZone,
        cross_zone_reason: isCrossZone ? (entry.crossZoneReason ?? null) : null,
      });
      results.push({ ok: true });
    }

    const rows = [...rowsBySlot.values()];
    if (rows.length > 0) {
      const supabase = db();
      const { error: writeError } = await supabase.from("roster_assignments").upsert(rows);
      if (writeError) {
        // El upsert masivo falló: las entradas que se habían aceptado no se
        // persistieron, así que se marcan como fallidas (mismo criterio que el
        // flujo individual ante un error de escritura).
        for (let i = 0; i < results.length; i++) {
          if (results[i]!.ok) results[i] = { ok: false, error: "No se pudo guardar la asignación" };
        }
      } else {
        await syncCompetitionCoverage(competitionId);
        const appliedCount = results.filter((r) => r.ok).length;
        await pushHistory({
          competitionId,
          at: new Date().toISOString(),
          actor,
          action: "Importación de asignaciones",
          detail: `${appliedCount} asignaciones aplicadas`,
        });
      }
    }

    const roster = await loadRosterAssignmentData(competitionId);
    return {
      results,
      assignments: roster.assignments,
      flags: roster.flags,
      crossZoneMap: roster.crossZoneMap,
    };
  },

  clearSlot: async (
    competitionId: string,
    slotKey: string,
    actor: string,
    expectedRefereeId?: string | null,
  ) => {
    // Mismo control optimista que en la asignación: liberar un hueco que otro
    // usuario acaba de rellenar borraba su trabajo sin decir nada.
    if (expectedRefereeId !== undefined) {
      const { assignments } = await loadRosterAssignmentData(competitionId);
      const current = assignments[slotKey] ?? null;
      if (current !== expectedRefereeId) {
        throw new RosterSlotConflictError(
          current
            ? "Otro usuario cambió ese hueco mientras lo editabas. Actualiza la tarima antes de liberarlo."
            : "Ese hueco ya está libre. Actualiza la tarima.",
        );
      }
    }
    const supabase = db();
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .eq("competition_id", competitionId)
      .eq("slot_key", slotKey);
    // Sin esto, un borrado rechazado seguía adelante y la ruta respondía 200:
    // el juez seguía en la tarima y nadie se enteraba de que no se había
    // liberado el hueco.
    if (error) throw new Error(`roster_assignments: ${error.message}`);
    const assignments = await loadAssignments(competitionId);
    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Liberó slot",
      detail: slotKey,
    });
    return { ...assignments };
  },

  clearRosterAssignments: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ): Promise<{ assignments: AssignmentsMap; flags: FlagsMap } | undefined> => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    const supabase = db();
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .eq("competition_id", competitionId);
    if (error) throw new Error(`roster_assignments: ${error.message}`);
    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Asignaciones vaciadas",
      detail: "Todos los huecos liberados",
    });
    return { assignments: {}, flags: {} };
  },

  submitRoster: async (
    competitionId: string,
    actor: string,
    userId: string | undefined,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    const assignments = await loadAssignments(competitionId);
    const supabase = db();
    const hasCompetitionColumns = await hasApprovalCompetitionColumns();
    const hasSubmitterColumns = await hasApprovalSubmitterColumns();
    const competitionIdColumn = hasCompetitionColumns ? "competition_id" : "event_id";
    const competitionNameColumn = hasCompetitionColumns ? "competition_name" : "event_name";
    const submitterId = hasSubmitterColumns ? { submitted_by_id: userId ?? null } : {};
    const { data: existing } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq(competitionIdColumn, competitionId)
      .eq("status", "pendiente")
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      const { error: updateError } = await supabase
        .from("approval_proposals")
        .update({ assignments, submitted_at: now, submitted_by: actor, ...submitterId })
        .eq("id", existing.id);
      if (updateError) return undefined;
    } else {
      const { error: insertError } = await supabase.from("approval_proposals").insert({
        // randomUUID: dos submits en el mismo milisegundo colisionaban en PK.
        id: `apr-${crypto.randomUUID()}`,
        [competitionIdColumn]: competitionId,
        [competitionNameColumn]: comp.nombre,
        zona: comp.zona ?? "—",
        submitted_by: actor,
        ...submitterId,
        submitted_at: now,
        status: "pendiente",
        assignments,
      });
      // Si el insert falla no marcamos la competición como "Propuesta enviada":
      // dejaríamos un estado enviado sin propuesta real que aprobar.
      if (insertError) return undefined;
    }
    const { error: stateError } = await supabase
      .from("competitions")
      .update({ aprobacion: "Propuesta enviada" })
      .eq("id", competitionId);
    // La propuesta ya está creada: si la competición no queda marcada, la
    // tarima seguiría editable con una propuesta pendiente encima. Reintentar
    // es seguro (el submit reutiliza la propuesta pendiente que ya existe).
    if (stateError) throw new Error(`competitions.aprobacion: ${stateError.message}`);
    await pushActivity({
      tipo: "propuesta",
      actor,
      accion: "envió propuesta de roster para",
      evento: comp.nombre,
      hace: "ahora",
    });
    const { data } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq(competitionIdColumn, competitionId)
      .eq("status", "pendiente")
      .single();
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  saveDraft: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    const comp = await getCompetitionFn(competitionId);
    if (comp?.estado === "Borrador") {
      const supabase = db();
      await supabase.from("competitions").update({ estado: "Incompleto" }).eq("id", competitionId);
    }
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Guardó borrador",
    });
  },

  getApprovals: async (user?: SessionUser): Promise<ApprovalProposal[]> => {
    const supabase = db();
    const { data, error } = await supabase
      .from("approval_proposals")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(`approval_proposals: ${error.message}`);
    const list = (data ?? []).map((r) => mapApproval(r as Record<string, unknown>));
    // `zona` es texto libre y las propuestas anteriores a la migración 013
    // guardan códigos legados ("MAD", "Centro"): el `.eq` crudo las ocultaba al
    // delegado, que veía su bandeja vacía con propuestas pendientes de su zona.
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona) ?? user.zona;
      return list.filter((p) => (resolveZoneCode(p.zona) ?? p.zona) === userZone);
    }
    return list;
  },

  reviewApproval: async (
    id: string,
    approve: boolean,
    reviewer: string,
    reviewerId: string | undefined,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    comment?: string,
  ): Promise<ApprovalProposal | undefined> => {
    const supabase = db();
    const { data: proposal } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq("id", id)
      .single();
    if (!proposal || proposal.status !== "pendiente") return undefined;

    const proposalCompetitionId = String(proposal.competition_id ?? proposal.event_id);
    const proposalCompetitionName = String(proposal.competition_name ?? proposal.event_name);
    const comp = await getCompetitionFn(proposalCompetitionId);
    const assignments = proposal.assignments as AssignmentsMap;

    // Pre-check ANTES de tocar nada: si un juez de la propuesta se borró del censo,
    // el insert final fallaría por FK dejando el roster vacío y la competición
    // marcada como "Aprobado/Completo" sin asignaciones. Abortamos limpio.
    if (approve && comp) {
      const refereeIds = [...new Set(Object.values(assignments).filter(Boolean))] as string[];
      if (refereeIds.length) {
        const { data: existingRefs, error: refErr } = await supabase
          .from("referees")
          .select("id")
          .in("id", refereeIds);
        if (refErr) throw new Error("No se pudo validar el censo; inténtalo de nuevo.");
        const existingIds = new Set((existingRefs ?? []).map((r) => String(r.id)));
        const missing = refereeIds.filter((rid) => !existingIds.has(rid));
        if (missing.length) {
          throw new Error(
            `No se puede aprobar: ${missing.length} juez(ces) de la propuesta ya no existe(n) en el censo. Revisa la tarima y reenvíala.`,
          );
        }
      }
    }

    const now = new Date().toISOString();
    const status = approve ? "aprobado" : "rechazado";
    const reviewerIdCol = (await hasApprovalSubmitterColumns())
      ? { reviewed_by_id: reviewerId ?? null }
      : {};
    // Guard condicional contra doble revisión concurrente: el UPDATE solo gana
    // si la propuesta sigue "pendiente"; si otro revisor llegó antes, no se
    // reescribe el roster ni se duplica la actividad.
    const { data: claimed } = await supabase
      .from("approval_proposals")
      .update({ status, reviewed_by: reviewer, reviewed_at: now, comment: comment ?? null, ...reviewerIdCol })
      .eq("id", id)
      .eq("status", "pendiente")
      .select("id");
    if (!claimed || claimed.length === 0) return undefined;

    if (comp) {
      if (approve) {
        // Conserva flags (*, ↑↓) y cross-zona de las filas vivas al re-insertar
        // la propuesta aprobada; antes se perdían y el acta salía sin marcas.
        const { data: liveRows, error: liveError } = await supabase
          .from("roster_assignments")
          .select("slot_key, referee_id, flags, cross_zone, cross_zone_reason")
          .eq("competition_id", proposalCompetitionId);
        // Esta lectura es la copia de seguridad del borrado que viene justo
        // después: si falla y se sigue adelante, no hay nada que restaurar si
        // el insert se tuerce, y de paso el acta pierde flags y cross-zona.
        if (liveError) throw new Error(`roster_assignments: ${liveError.message}`);
        const liveBySlot = new Map(
          (liveRows ?? []).map((r) => [String(r.slot_key), r as Record<string, unknown>]),
        );
        const { error: clearError } = await supabase
          .from("roster_assignments")
          .delete()
          .eq("competition_id", proposalCompetitionId);
        // Si el borrado falla, el insert siguiente chocaría con la clave
        // primaria y el «rollback» duplicaría filas. Mejor parar aquí.
        if (clearError) throw new Error(`roster_assignments: ${clearError.message}`);
        const rows = Object.entries(assignments).map(([slot_key, referee_id]) => {
          const live = liveBySlot.get(slot_key);
          return {
            competition_id: proposalCompetitionId,
            slot_key,
            referee_id,
            flags: live?.flags ?? {},
            cross_zone: live?.cross_zone ?? false,
            cross_zone_reason: live?.cross_zone_reason ?? null,
          };
        });
        if (rows.length) {
          const { error: insertError } = await supabase.from("roster_assignments").insert(rows);
          if (insertError) {
            // El delete ya vació las filas: restauramos exactamente lo que había
            // y revertimos la propuesta a "pendiente" para no dejar un acta vacía
            // marcada como aprobada. No marcamos la competición como Aprobado.
            if (liveRows && liveRows.length) {
              await supabase.from("roster_assignments").insert(
                liveRows.map((r) => ({
                  competition_id: proposalCompetitionId,
                  slot_key: r.slot_key,
                  referee_id: r.referee_id,
                  flags: r.flags ?? {},
                  cross_zone: r.cross_zone ?? false,
                  cross_zone_reason: r.cross_zone_reason ?? null,
                })),
              );
            }
            const resetReviewer = Object.fromEntries(
              Object.keys(reviewerIdCol).map((k) => [k, null]),
            );
            await supabase
              .from("approval_proposals")
              .update({ status: "pendiente", reviewed_by: null, reviewed_at: null, comment: null, ...resetReviewer })
              .eq("id", id);
            throw new Error(
              "No se pudo guardar el acta aprobada; la propuesta sigue pendiente. Inténtalo de nuevo.",
            );
          }
        }
        await supabase
          .from("competitions")
          .update({
            aprobacion: "Aprobado",
            estado: "Completo",
            confirmados: Object.values(assignments).filter(Boolean).length,
          })
          .eq("id", proposalCompetitionId);
      } else {
        await supabase
          .from("competitions")
          .update({ aprobacion: "Rechazado" })
          .eq("id", proposalCompetitionId);
      }
    }
    await pushActivity({
      tipo: approve ? "aprobacion" : "rechazo",
      actor: reviewer,
      accion: approve ? "aprobó roster para" : "rechazó propuesta para",
      evento: proposalCompetitionName,
      hace: "ahora",
    });
    const { data } = await supabase.from("approval_proposals").select("*").eq("id", id).single();
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  getRosterHistory: async (competitionId: string): Promise<RosterHistoryEntry[]> => {
    const supabase = db();
    const competitionColumn = (await import("./supabase-helpers").then((m) =>
      m.hasHistoryCompetitionColumn()
    ))
      ? "competition_id"
      : "event_id";
    const { data } = await supabase
      .from("roster_history")
      .select("*")
      .eq(competitionColumn, competitionId)
      .order("at", { ascending: false })
      // Cota superior: el historial crece sin límite y la UI solo muestra los
      // movimientos recientes; sin esto la respuesta crecía sin tope.
      .limit(200);
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
    const { data: referees } = assignedIds.length
      ? await supabase.from("referees").select("id, nombre, nivel").in("id", assignedIds)
      : { data: [] };
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

  unlockImprevisto: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ): Promise<{ message: string; aprobacion: string } | { error: string }> => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return { error: "Competición no encontrada" };
    if (!isRosterLockedByApproval(comp.aprobacion)) {
      return { error: "Solo se puede registrar imprevisto en tarimas ya aprobadas" };
    }
    const supabase = db();
    await supabase
      .from("competitions")
      .update({ aprobacion: ROSTER_IMPREVISTO_STATE })
      .eq("id", competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Imprevisto registrado",
      detail: "Tarima desbloqueada para cambios; reenviar a aprobación tras ajustar",
    });
    await pushActivity({
      tipo: "cambio",
      actor,
      accion: "registró imprevisto en tarima de",
      evento: comp.nombre,
      hace: "ahora",
    });
    return { message: "Tarima desbloqueada para cambios por imprevisto", aprobacion: ROSTER_IMPREVISTO_STATE };
  },
};
