import { resolveZoneCode } from "@/lib/aep-zones";
import { rosterMutationBlockedMessage } from "@/lib/roster-coverage";
import { validateRosterOperation } from "@/lib/roster-rules";
import type {
  AssignmentsMap,
  AssignValidation,
  Competition,
  FlagsMap,
  Referee,
  SlotFlags,
} from "@/lib/types";
import { RosterPaidClaimError, RosterSlotConflictError } from "@/lib/competitions/service-types";
import { paidClaimClearAllMessage, paidClaimRemovalMessage } from "@/lib/roster-paid-claims";
import {
  db,
  getCompetitionTemplate,
  loadPaidClaimRefereeIds,
  loadAssignments,
  loadRosterAssignmentData,
  pushHistory,
  syncCompetitionCoverage,
} from "./supabase-helpers";

import {
  startRead,
  validateAssignWithData,
  type RosterBatchAssignment,
} from "./supabase-roster-shared";

/** Tarima: validar, asignar (uno o en lote) y liberar huecos. Se compone en `rosterService` (supabase-roster.ts). */
export const rosterAsignacionesService = {
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
    // Sustituir a un juez con la liquidación pagada dejaría el pago sin nada
    // que lo respalde: el importe corresponde a los servicios de estos huecos.
    if (replacedRefereeId && replacedRefereeId !== refereeId) {
      const paid = await loadPaidClaimRefereeIds(competitionId);
      if (paid.has(replacedRefereeId)) {
        const replaced = await getRefereeFn(replacedRefereeId);
        return { error: paidClaimRemovalMessage(replaced?.nombre) };
      }
    }
    const isCrossZone =
      !!comp?.zona &&
      !!referee?.zona &&
      (resolveZoneCode(comp.zona) ?? comp.zona) !== (resolveZoneCode(referee.zona) ?? referee.zona);

    // Escritura condicional y atómica. La comprobación de arriba lee y compara,
    // pero entre esa lectura y esta escritura otra persona puede ocupar el
    // hueco: con un upsert, el segundo pisaba al primero sin aviso. Ahora:
    //  · hueco vacío al leer → INSERT; si ya existe la fila (clave primaria
    //    competición+hueco) es que alguien llegó antes;
    //  · hueco ocupado → UPDATE solo si sigue el mismo juez que se leyó.
    const fields = {
      referee_id: refereeId,
      flags: flagPayload,
      cross_zone: isCrossZone,
      cross_zone_reason: isCrossZone ? (crossZoneReason ?? null) : null,
    };
    let lostRace = false;
    let writeFailed = false;
    if (replacedRefereeId) {
      const { data: updated, error } = await supabase
        .from("roster_assignments")
        .update(fields)
        .eq("competition_id", competitionId)
        .eq("slot_key", slotKey)
        .eq("referee_id", replacedRefereeId)
        .select("slot_key");
      if (error) writeFailed = true;
      else lostRace = (updated ?? []).length === 0;
    } else {
      const { error } = await supabase
        .from("roster_assignments")
        .insert({ competition_id: competitionId, slot_key: slotKey, ...fields });
      if (error) {
        if ((error as { code?: string }).code === "23505") lostRace = true;
        else writeFailed = true;
      }
    }
    if (lostRace) {
      return {
        conflict: true,
        error: "Otro usuario acaba de cambiar ese hueco. Actualiza la tarima antes de reasignar.",
      };
    }
    // supabase-js no lanza: devuelve { error }. Sin esto, un fallo de escritura
    // (constraint, RLS, caída) respondería "OK" con el juez sin asignar.
    if (writeFailed) return { error: "No se pudo guardar la asignación" };

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
      const undo = previousRefereeId
        ? await supabase.from("roster_assignments").upsert({
            competition_id: competitionId,
            slot_key: slotKey,
            referee_id: previousRefereeId,
            flags: existingFlags[slotKey] ?? {},
            cross_zone: Boolean(existingCrossZone[slotKey]),
            cross_zone_reason: crossZoneReasons[slotKey] ?? null,
          })
        : await supabase
            .from("roster_assignments")
            .delete()
            .eq("competition_id", competitionId)
            .eq("slot_key", slotKey)
            // Solo la fila que acabamos de poner: si entretanto otro usuario la
            // ha cambiado, no se le borra la suya.
            .eq("referee_id", refereeId);
      // Si deshacer falla, la asignación se ha quedado puesta: decir solo
      // «no se pudo, hay un conflicto» dejaba al usuario creyendo que la
      // tarima seguía como antes cuando el juez sí había entrado.
      if (undo.error) {
        return {
          error: `${recheck.error} Además, no se pudo deshacer el cambio, así que la asignación puede haber quedado aplicada: recarga la tarima antes de seguir.`,
        };
      }
      return { error: recheck.error };
    }

    // Cobertura e historial en paralelo, y la cobertura con la plantilla y las
    // asignaciones que se acaban de releer tras escribir (antes las volvía a
    // pedir: tres consultas más en la operación más frecuente de la app).
    await Promise.all([
      syncCompetitionCoverage(competitionId, {
        template,
        assignments: freshAssignments,
        requeridos: comp.requeridos,
      }),
      pushHistory({
        competitionId,
        at: new Date().toISOString(),
        actor,
        action: isCrossZone ? "Asignación cross-zona" : "Asignación",
        // La sustitución queda registrada: antes el juez desplazado desaparecía
        // del historial y no había forma de saber quién estaba antes.
        detail: `${slotKey} → ${refereeId}${
          replacedRefereeId && replacedRefereeId !== refereeId ? ` (sustituye a ${replacedRefereeId})` : ""
        }${isCrossZone ? ` (${referee?.zona})` : ""}`,
      }),
    ]);
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
    const [comp, templateRaw, current, refMap, paidRefereeIds] = await Promise.all([
      getCompetitionFn(competitionId),
      getCompetitionTemplate(competitionId),
      loadRosterAssignmentData(competitionId),
      getRefereesByIdsFn(entries.map((e) => e.refereeId)),
      loadPaidClaimRefereeIds(competitionId),
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
    // Hueco de cada resultado (mismo índice), para marcar después los que
    // perdieron la carrera contra otro usuario al escribir.
    const resultSlots: string[] = [];

    for (const entry of entries) {
      resultSlots.push(entry.slotKey);
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

      // Importar un cuadrante tampoco puede desplazar a un juez ya pagado: es
      // la misma sustitución, en lote.
      const occupant = workingAssignments[entry.slotKey];
      if (occupant && occupant !== entry.refereeId && paidRefereeIds.has(occupant)) {
        results.push({ ok: false, error: paidClaimRemovalMessage(refMap.get(occupant)?.nombre) });
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
      // Escrituras condicionales, como en la asignación individual: entre la
      // vista previa y «Aplicar» otro delegado puede haber tocado la tarima, y
      // un upsert masivo le pisaba sin aviso.
      //  · huecos vacíos al leer → INSERT … ON CONFLICT DO NOTHING; los que no
      //    vuelvan en la respuesta los ocupó alguien entretanto;
      //  · huecos ocupados → UPDATE solo si sigue el juez que se leyó.
      const original = current.assignments;
      const inserts = rows.filter((r) => !original[r.slot_key]);
      const updates = rows.filter((r) => original[r.slot_key]);
      const conflictSlots = new Set<string>();
      const failedSlots = new Set<string>();
      if (inserts.length > 0) {
        const { data: inserted, error } = await supabase
          .from("roster_assignments")
          .upsert(inserts, { onConflict: "competition_id,slot_key", ignoreDuplicates: true })
          .select("slot_key");
        if (error) {
          for (const r of inserts) failedSlots.add(r.slot_key);
        } else {
          const ok = new Set((inserted ?? []).map((row) => String((row as { slot_key: unknown }).slot_key)));
          for (const r of inserts) if (!ok.has(r.slot_key)) conflictSlots.add(r.slot_key);
        }
      }
      await Promise.all(
        updates.map(async (r) => {
          const { slot_key, competition_id: _c, ...fields } = r;
          void _c;
          const { data: updated, error } = await supabase
            .from("roster_assignments")
            .update(fields)
            .eq("competition_id", competitionId)
            .eq("slot_key", slot_key)
            .eq("referee_id", original[slot_key]!)
            .select("slot_key");
          if (error) failedSlots.add(slot_key);
          else if ((updated ?? []).length === 0) conflictSlots.add(slot_key);
        }),
      );
      for (let i = 0; i < results.length; i++) {
        const slot = resultSlots[i];
        if (!results[i]!.ok || !slot) continue;
        if (failedSlots.has(slot)) results[i] = { ok: false, error: "No se pudo guardar la asignación" };
        else if (conflictSlots.has(slot)) {
          results[i] = {
            ok: false,
            error: "Otro usuario cambió ese hueco durante la importación; revisa la tarima.",
          };
        }
      }
      const writeError = failedSlots.size + conflictSlots.size === rows.length;
      if (writeError) {
        // Nada se aplicó: no hay cobertura que recalcular ni historial que dejar.
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
    // Una sola foto del hueco sirve para el control optimista y para saber a
    // quién se borra (antes eran dos lecturas idénticas, una tras otra); el
    // borrado sigue condicionado a ese juez, así que la carrera queda cubierta
    // igual. Las liquidaciones pagadas se piden a la vez, pero su error solo se
    // mira donde antes se leían: un 409 sigue ganando a un fallo de esa tabla.
    const readPaid = startRead(loadPaidClaimRefereeIds(competitionId));
    const { assignments: before } = await loadRosterAssignmentData(competitionId);
    // Mismo control optimista que en la asignación: liberar un hueco que otro
    // usuario acaba de rellenar borraba su trabajo sin decir nada.
    if (expectedRefereeId !== undefined) {
      const current = before[slotKey] ?? null;
      if (current !== expectedRefereeId) {
        throw new RosterSlotConflictError(
          current
            ? "Otro usuario cambió ese hueco mientras lo editabas. Actualiza la tarima antes de liberarlo."
            : "Ese hueco ya está libre. Actualiza la tarima.",
        );
      }
    }
    // Liberar el hueco de un juez pagado es la misma pérdida que sustituirlo.
    const occupant = before[slotKey];
    if (occupant && (await readPaid()).has(occupant)) {
      throw new RosterPaidClaimError(paidClaimRemovalMessage());
    }
    const supabase = db();
    if (occupant) {
      // Borrado condicional: solo si el hueco sigue con el juez leído. Si otro
      // usuario lo acaba de cambiar, no se le borra su asignación.
      const { data: deleted, error } = await supabase
        .from("roster_assignments")
        .delete()
        .eq("competition_id", competitionId)
        .eq("slot_key", slotKey)
        .eq("referee_id", occupant)
        .select("slot_key");
      // Sin esto, un borrado rechazado seguía adelante y la ruta respondía 200:
      // el juez seguía en la tarima y nadie se enteraba de que no se había
      // liberado el hueco.
      if (error) throw new Error(`roster_assignments: ${error.message}`);
      if ((deleted ?? []).length === 0) {
        throw new RosterSlotConflictError(
          "Otro usuario cambió ese hueco mientras lo editabas. Actualiza la tarima antes de liberarlo.",
        );
      }
    }
    // Relectura, cobertura e historial en paralelo (antes, tres esperas en
    // serie). La cobertura va SIN datos precargados a propósito: lee después
    // del borrado y escribe antes de responder, así dos clics seguidos no
    // pueden dejar una cobertura vieja encima de la nueva.
    const [assignments] = await Promise.all([
      loadAssignments(competitionId),
      syncCompetitionCoverage(competitionId),
      pushHistory({
        competitionId,
        at: new Date().toISOString(),
        actor,
        action: "Liberó slot",
        detail: slotKey,
      }),
    ]);
    return { ...assignments };
  },

  clearRosterAssignments: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ): Promise<{ assignments: AssignmentsMap; flags: FlagsMap } | undefined> => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    // Vaciar la tarima se llevaría por delante a los jueces ya pagados.
    const paid = await loadPaidClaimRefereeIds(competitionId);
    if (paid.size > 0) {
      const { assignments } = await loadRosterAssignmentData(competitionId);
      const assignedPaid = new Set(
        Object.values(assignments).filter((id) => id && paid.has(id)),
      );
      if (assignedPaid.size > 0) {
        throw new RosterPaidClaimError(paidClaimClearAllMessage(assignedPaid.size));
      }
    }
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
};
