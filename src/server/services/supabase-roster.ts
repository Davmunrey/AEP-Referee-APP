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
    const { data: existingRows } = await supabase
      .from("roster_assignments")
      .select("slot_key")
      .eq("competition_id", competitionId);
    for (const row of existingRows ?? []) {
      if (!validKeys.has(row.slot_key)) {
        await supabase
          .from("roster_assignments")
          .delete()
          .eq("competition_id", competitionId)
          .eq("slot_key", row.slot_key);
      }
    }
    const { assignments, flags } = await loadRosterAssignmentData(competitionId);
    const pruned = pruneAssignments(template, assignments, flags);
    for (const [slotKey, flagVal] of Object.entries(pruned.flags)) {
      await supabase
        .from("roster_assignments")
        .update({ flags: flagVal })
        .eq("competition_id", competitionId)
        .eq("slot_key", slotKey);
    }
    await supabase
      .from("competitions")
      .update({ sesiones: template.length })
      .eq("id", competitionId);
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
    const comp = await getCompetitionFn(competitionId);
    const referee = await getRefereeFn(refereeId);
    if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
    const parsed = parseSlotKey(slotKey);
    if (!parsed) return { ok: false, error: "Slot inválido" };
    const template = (await getCompetitionTemplate(competitionId)) ?? [];
    if (!isSlotKeyInTemplate(template, slotKey)) {
      return { ok: false, error: "El hueco no existe en la plantilla del campeonato" };
    }
    return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
  },

  assignReferee: async (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    getRefereeFn: (id: string) => Promise<Referee | undefined>,
    validateAssignFn: (cId: string, sKey: string, rId: string) => Promise<AssignValidation>,
    slotFlags?: SlotFlags,
    crossZoneReason?: string,
  ): Promise<{
    assignments?: AssignmentsMap;
    flags?: FlagsMap;
    crossZoneMap?: import("@/lib/types").CrossZoneMap;
    error?: string;
  }> => {
    const [validation, comp, referee] = await Promise.all([
      validateAssignFn(competitionId, slotKey, refereeId),
      getCompetitionFn(competitionId),
      getRefereeFn(refereeId),
    ]);
    if (!validation.ok) return { error: validation.error };
    if (!comp) return { error: "Competición no encontrada" };
    const blocked = rosterMutationBlockedMessage(comp.aprobacion);
    if (blocked) return { error: blocked };

    const supabase = db();
    // Una sola lectura de roster_assignments (antes loadAssignments + loadFlags
    // escaneaban la misma tabla 2 veces) en paralelo con la plantilla.
    const [{ assignments, flags: existingFlags }, templateRaw] = await Promise.all([
      loadRosterAssignmentData(competitionId),
      getCompetitionTemplate(competitionId),
    ]);
    const template = templateRaw ?? [];
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
      await supabase
        .from("roster_assignments")
        .delete()
        .eq("competition_id", competitionId)
        .eq("slot_key", slotKey);
      return { error: recheck.error };
    }

    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: isCrossZone ? "Asignación cross-zona" : "Asignación",
      detail: `${slotKey} → ${refereeId}${isCrossZone ? ` (${referee?.zona})` : ""}`,
    });
    return {
      assignments: { ...freshAssignments },
      flags: freshFlags,
      crossZoneMap: freshCrossZoneMap,
    };
  },

  clearSlot: async (competitionId: string, slotKey: string, actor: string) => {
    const supabase = db();
    await supabase
      .from("roster_assignments")
      .delete()
      .eq("competition_id", competitionId)
      .eq("slot_key", slotKey);
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
    await supabase.from("roster_assignments").delete().eq("competition_id", competitionId);
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
        id: `apr-${Date.now()}`,
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
    await supabase
      .from("competitions")
      .update({ aprobacion: "Propuesta enviada" })
      .eq("id", competitionId);
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
    let query = supabase
      .from("approval_proposals")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (user?.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapApproval(r as Record<string, unknown>));
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
    await supabase
      .from("approval_proposals")
      .update({ status, reviewed_by: reviewer, reviewed_at: now, comment: comment ?? null, ...reviewerIdCol })
      .eq("id", id);

    if (comp) {
      if (approve) {
        // Conserva flags (*, ↑↓) y cross-zona de las filas vivas al re-insertar
        // la propuesta aprobada; antes se perdían y el acta salía sin marcas.
        const { data: liveRows } = await supabase
          .from("roster_assignments")
          .select("slot_key, referee_id, flags, cross_zone, cross_zone_reason")
          .eq("competition_id", proposalCompetitionId);
        const liveBySlot = new Map(
          (liveRows ?? []).map((r) => [String(r.slot_key), r as Record<string, unknown>]),
        );
        await supabase.from("roster_assignments").delete().eq("competition_id", proposalCompetitionId);
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
      .order("at", { ascending: false });
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
    const roster = await getRosterFn(competitionId);
    const comp = await getCompetitionFn(competitionId);
    if (!roster || !comp) return null;
    const supabase = db();
    const { data: referees } = await supabase.from("referees").select("id, nombre, nivel");
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
