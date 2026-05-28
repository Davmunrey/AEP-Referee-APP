import { validateAssignment, validateRosterOperation } from "@/lib/roster-rules";
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
  loadAssignments,
  loadCrossZoneMap,
  loadFlags,
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
    if (!(await getCompetitionFn(competitionId))) return undefined;
    const template = await getCompetitionTemplate(competitionId);
    const [assignments, flags, crossZoneMap] = await Promise.all([
      loadAssignments(competitionId),
      loadFlags(competitionId),
      loadCrossZoneMap(competitionId),
    ]);
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
    const assignments = await loadAssignments(competitionId);
    const flags = await loadFlags(competitionId);
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
    const assignments = await loadAssignments(competitionId);
    if (!assignments[slotKey]) {
      return { error: "Asigna un juez antes de marcar flags" };
    }
    const supabase = db();
    const merged: SlotFlags = {
      compartido: flags.compartido ?? false,
      intercambio: flags.intercambio ?? false,
    };
    const payload = merged.compartido || merged.intercambio ? merged : {};
    await supabase
      .from("roster_assignments")
      .update({ flags: payload })
      .eq("competition_id", competitionId)
      .eq("slot_key", slotKey);
    const allFlags = await loadFlags(competitionId);
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

    const supabase = db();
    const assignments = await loadAssignments(competitionId);
    const template = (await getCompetitionTemplate(competitionId)) ?? [];
    const operation = validateRosterOperation({ template, assignments, slotKey, refereeId });
    if (!operation.ok) return { error: operation.error };

    const existingFlags = await loadFlags(competitionId);
    const flagPayload =
      slotFlags && (slotFlags.compartido || slotFlags.intercambio)
        ? { compartido: Boolean(slotFlags.compartido), intercambio: Boolean(slotFlags.intercambio) }
        : existingFlags[slotKey] ?? {};

    const isCrossZone = !!comp?.zona && !!referee?.zona && comp.zona !== referee.zona;

    await supabase.from("roster_assignments").upsert({
      competition_id: competitionId,
      slot_key: slotKey,
      referee_id: refereeId,
      flags: flagPayload,
      cross_zone: isCrossZone,
      cross_zone_reason: isCrossZone ? (crossZoneReason ?? null) : null,
    });
    assignments[slotKey] = refereeId;
    await syncCompetitionCoverage(competitionId);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: isCrossZone ? "Asignación cross-zona" : "Asignación",
      detail: `${slotKey} → ${refereeId}${isCrossZone ? ` (${referee?.zona})` : ""}`,
    });
    return {
      assignments: { ...assignments },
      flags: await loadFlags(competitionId),
      crossZoneMap: await loadCrossZoneMap(competitionId),
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
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return undefined;
    const assignments = await loadAssignments(competitionId);
    const supabase = db();
    const hasCompetitionColumns = await hasApprovalCompetitionColumns();
    const competitionIdColumn = hasCompetitionColumns ? "competition_id" : "event_id";
    const competitionNameColumn = hasCompetitionColumns ? "competition_name" : "event_name";
    const { data: existing } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq(competitionIdColumn, competitionId)
      .eq("status", "pendiente")
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      await supabase
        .from("approval_proposals")
        .update({ assignments, submitted_at: now, submitted_by: actor })
        .eq("id", existing.id);
    } else {
      await supabase.from("approval_proposals").insert({
        id: `apr-${Date.now()}`,
        [competitionIdColumn]: competitionId,
        [competitionNameColumn]: comp.nombre,
        zona: comp.zona ?? "—",
        submitted_by: actor,
        submitted_at: now,
        status: "pendiente",
        assignments,
      });
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

    const now = new Date().toISOString();
    const status = approve ? "aprobado" : "rechazado";
    await supabase
      .from("approval_proposals")
      .update({ status, reviewed_by: reviewer, reviewed_at: now, comment: comment ?? null })
      .eq("id", id);

    const proposalCompetitionId = String(proposal.competition_id ?? proposal.event_id);
    const proposalCompetitionName = String(proposal.competition_name ?? proposal.event_name);
    const comp = await getCompetitionFn(proposalCompetitionId);
    if (comp) {
      if (approve) {
        await supabase.from("roster_assignments").delete().eq("competition_id", proposalCompetitionId);
        const assignments = proposal.assignments as AssignmentsMap;
        const rows = Object.entries(assignments).map(([slot_key, referee_id]) => ({
          competition_id: proposalCompetitionId,
          slot_key,
          referee_id,
        }));
        if (rows.length) await supabase.from("roster_assignments").insert(rows);
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
};
