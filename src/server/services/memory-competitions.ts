import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import { countOpenSlots, validateAssignment, validateRosterOperation } from "@/lib/roster-rules";
import { formatRosterExport } from "@/lib/roster-export";
import { pruneAssignments } from "@/lib/roster-template";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import type {
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  Competition,
  DashboardPayload,
  FlagsMap,
  RoleKey,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
  SlotFlags,
} from "@/lib/types";
import {
  getCalendarEvents,
  getCompetitionTemplate,
  getStore,
  pushActivity,
  pushHistory,
  setCompetitionTemplate,
} from "@/server/store";
import { buildKpis, healthHistory, parseSlotKey, syncCompetitionCoverage } from "./memory-helpers";
import { getReferee } from "./memory-referees";

export async function getDashboard(user: SessionUser): Promise<DashboardPayload> {
  const store = getStore();
  const competitions = [...store.competitions].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );
  const coverage = competitions.map((c) => {
    const assignments = store.assignments.get(c.id) ?? {};
    const filled = Object.values(assignments).filter(Boolean).length;
    const open = countOpenSlots(getCompetitionTemplate(c.id), assignments);
    return {
      id: c.id,
      nombre: c.nombre,
      fecha: c.fecha,
      estado: c.estado,
      filled,
      open,
      required: filled + open,
    };
  });
  const { health, insights } = buildIntelligence({
    referees: store.referees,
    competitions,
    approvals: store.approvals,
    promotions: store.promotions,
    coverage,
    activity: store.activity,
  });
  const last = healthHistory[healthHistory.length - 1];
  if (last) {
    health.previousScore = last.score;
    health.delta = health.score - last.score;
  }
  if (!last || Date.now() - last.at > 6 * 60 * 60 * 1000) {
    healthHistory.push({ score: health.score, at: Date.now() });
  }
  return {
    kpis: buildKpis(user),
    activity: store.activity,
    calendar: getCalendarEvents(),
    upcomingCompetitions: competitions.slice(0, 6),
    currentUser: user,
    health,
    insights,
    coverage,
    sanctionAlerts: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function getCompetitions(user?: SessionUser): Promise<Competition[]> {
  const list = getStore().competitions;
  if (user?.role === "delegado_zona" && user.zona) {
    const userZone = resolveZoneCode(user.zona);
    return list.filter((c) => resolveZoneCode(c.zona) === userZone);
  }
  return list;
}

export async function getCompetition(id: string) {
  return getStore().competitions.find((c) => c.id === id);
}

export async function createCompetition(
  input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
): Promise<Competition> {
  const store = getStore();
  const id = `evt-${String(store.competitions.length + 1).padStart(3, "0")}`;
  const comp: Competition = {
    ...input,
    id,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    zona: normalizeZoneInput(input.zona) ?? input.zona,
  };
  store.competitions.push(comp);
  store.assignments.set(id, {});
  store.slotFlags.set(id, {});
  setCompetitionTemplate(id, []);
  return comp;
}

export async function updateCompetition(id: string, patch: Partial<Competition>): Promise<Competition | undefined> {
  const store = getStore();
  const idx = store.competitions.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  store.competitions[idx] = {
    ...store.competitions[idx]!,
    ...patch,
    ...(patch.zona !== undefined
      ? { zona: normalizeZoneInput(patch.zona) ?? patch.zona }
      : {}),
  };
  return store.competitions[idx];
}

export async function deleteCompetition(id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.competitions.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  store.competitions.splice(idx, 1);
  store.assignments.delete(id);
  store.slotFlags.delete(id);
  return true;
}

export async function getRoster(
  competitionId: string,
): Promise<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap; crossZoneMap: import("@/lib/types").CrossZoneMap } | undefined> {
  if (!(await getCompetition(competitionId))) return undefined;
  const store = getStore();
  if (!store.assignments.has(competitionId)) store.assignments.set(competitionId, {});
  if (!store.slotFlags.has(competitionId)) store.slotFlags.set(competitionId, {});
  return {
    template: getCompetitionTemplate(competitionId),
    assignments: { ...store.assignments.get(competitionId)! },
    flags: { ...store.slotFlags.get(competitionId)! },
    crossZoneMap: {},
  };
}

export async function saveCompetitionTemplate(
  competitionId: string,
  template: RosterSession[],
  actor: string,
) {
  const comp = await getCompetition(competitionId);
  if (!comp) return undefined;
  const store = getStore();
  setCompetitionTemplate(competitionId, template);
  const assignments = store.assignments.get(competitionId) ?? {};
  const flags = store.slotFlags.get(competitionId) ?? {};
  const pruned = pruneAssignments(template, assignments, flags);
  store.assignments.set(competitionId, pruned.assignments);
  store.slotFlags.set(competitionId, pruned.flags);
  const idx = store.competitions.findIndex((c) => c.id === competitionId);
  if (idx >= 0) {
    store.competitions[idx] = {
      ...store.competitions[idx]!,
      sesiones: template.length,
    };
  }
  syncCompetitionCoverage(competitionId);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Plantilla actualizada",
    detail: `${template.length} sesiones`,
  });
  return {
    template,
    assignments: pruned.assignments,
    flags: pruned.flags,
  };
}

export async function setSlotFlags(
  competitionId: string,
  slotKey: string,
  flags: SlotFlags,
  actor: string,
): Promise<{ flags: FlagsMap } | { error: string }> {
  const store = getStore();
  const assignments = store.assignments.get(competitionId) ?? {};
  if (!assignments[slotKey]) {
    return { error: "Asigna un juez antes de marcar flags" };
  }
  const all = { ...(store.slotFlags.get(competitionId) ?? {}) };
  const merged: SlotFlags = {
    compartido: Boolean(flags.compartido),
    intercambio: Boolean(flags.intercambio),
  };
  if (merged.compartido || merged.intercambio) all[slotKey] = merged;
  else delete all[slotKey];
  store.slotFlags.set(competitionId, all);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Flags slot",
    detail: slotKey,
  });
  return { flags: { ...all } };
}

export async function validateAssign(
  competitionId: string,
  slotKey: string,
  refereeId: string,
): Promise<AssignValidation> {
  const comp = await getCompetition(competitionId);
  const referee = await getReferee(refereeId);
  if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
  const parsed = parseSlotKey(slotKey);
  if (!parsed) return { ok: false, error: "Slot inválido" };
  return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
}

export async function assignReferee(
  competitionId: string,
  slotKey: string,
  refereeId: string,
  actor: string,
  slotFlags?: SlotFlags,
): Promise<{ assignments?: AssignmentsMap; flags?: FlagsMap; error?: string }> {
  const validation = await validateAssign(competitionId, slotKey, refereeId);
  if (!validation.ok) return { error: validation.error };

  const store = getStore();
  const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
  const template = getCompetitionTemplate(competitionId);
  const operation = validateRosterOperation({ template, assignments, slotKey, refereeId });
  if (!operation.ok) return { error: operation.error };
  assignments[slotKey] = refereeId;
  store.assignments.set(competitionId, assignments);
  const flagMap = { ...(store.slotFlags.get(competitionId) ?? {}) };
  if (slotFlags && (slotFlags.compartido || slotFlags.intercambio)) {
    flagMap[slotKey] = {
      compartido: Boolean(slotFlags.compartido),
      intercambio: Boolean(slotFlags.intercambio),
    };
  }
  store.slotFlags.set(competitionId, flagMap);
  syncCompetitionCoverage(competitionId);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Asignación",
    detail: `${slotKey} → ${refereeId}`,
  });
  return {
    assignments: { ...assignments },
    flags: { ...flagMap },
  };
}

export async function clearSlot(
  competitionId: string,
  slotKey: string,
  actor: string,
): Promise<AssignmentsMap | undefined> {
  const store = getStore();
  const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
  delete assignments[slotKey];
  store.assignments.set(competitionId, assignments);
  const flagMap = { ...(store.slotFlags.get(competitionId) ?? {}) };
  delete flagMap[slotKey];
  store.slotFlags.set(competitionId, flagMap);
  syncCompetitionCoverage(competitionId);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Liberó slot",
    detail: slotKey,
  });
  return { ...assignments };
}

export async function clearRosterAssignments(
  competitionId: string,
  actor: string,
): Promise<{ assignments: AssignmentsMap; flags: FlagsMap } | undefined> {
  const comp = await getCompetition(competitionId);
  if (!comp) return undefined;
  const store = getStore();
  store.assignments.set(competitionId, {});
  store.slotFlags.set(competitionId, {});
  syncCompetitionCoverage(competitionId);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Asignaciones vaciadas",
    detail: "Todos los huecos liberados",
  });
  return { assignments: {}, flags: {} };
}

export async function submitRoster(
  competitionId: string,
  actor: string,
  userId?: string,
): Promise<ApprovalProposal | undefined> {
  const comp = await getCompetition(competitionId);
  if (!comp) return undefined;
  const store = getStore();
  const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
  const existing = store.approvals.find(
    (a) => a.competitionId === competitionId && a.status === "pendiente",
  );
  if (existing) {
    existing.assignments = assignments;
    existing.submittedAt = new Date().toISOString();
    existing.submittedBy = actor;
    existing.submittedById = userId;
  } else {
    store.approvals.unshift({
      id: `apr-${Date.now()}`,
      competitionId,
      competitionName: comp.nombre,
      zona: comp.zona ?? "—",
      submittedBy: actor,
      submittedById: userId,
      submittedAt: new Date().toISOString(),
      status: "pendiente",
      assignments,
    });
  }
  comp.aprobacion = "Propuesta enviada";
  pushActivity({
    tipo: "propuesta",
    actor,
    accion: "envió propuesta de roster para",
    evento: comp.nombre,
    hace: "ahora",
  });
  return store.approvals.find((a) => a.competitionId === competitionId && a.status === "pendiente");
}

export async function saveDraft(competitionId: string, actor: string) {
  const comp = await getCompetition(competitionId);
  if (comp && comp.estado === "Borrador") comp.estado = "Incompleto";
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Guardó borrador",
  });
}

export async function getApprovals(user?: SessionUser): Promise<ApprovalProposal[]> {
  const list = getStore().approvals;
  if (user?.role === "delegado_zona" && user.zona) {
    return list.filter((a) => a.zona === user.zona);
  }
  return list;
}

export async function reviewApproval(
  id: string,
  approve: boolean,
  reviewer: string,
  reviewerId?: string,
  comment?: string,
): Promise<ApprovalProposal | undefined> {
  const store = getStore();
  const proposal = store.approvals.find((a) => a.id === id);
  if (!proposal || proposal.status !== "pendiente") return undefined;

  proposal.status = approve ? "aprobado" : "rechazado";
  proposal.reviewedBy = reviewer;
  proposal.reviewedById = reviewerId;
  proposal.reviewedAt = new Date().toISOString();
  proposal.comment = comment;

  const comp = store.competitions.find((c) => c.id === proposal.competitionId);
  if (comp) {
    if (approve) {
      store.assignments.set(proposal.competitionId, { ...proposal.assignments });
      comp.aprobacion = "Aprobado";
      comp.estado = "Completo";
      comp.confirmados = Object.values(proposal.assignments).filter(Boolean).length;
    } else {
      comp.aprobacion = "Rechazado";
    }
  }

  pushActivity({
    tipo: approve ? "aprobacion" : "rechazo",
    actor: reviewer,
    accion: approve ? "aprobó roster para" : "rechazó propuesta para",
    evento: proposal.competitionName,
    hace: "ahora",
  });
  return proposal;
}

export async function getRosterHistory(competitionId: string): Promise<RosterHistoryEntry[]> {
  return getStore().history.filter((h) => h.competitionId === competitionId);
}

export async function exportRoster(competitionId: string) {
  const roster = await getRoster(competitionId);
  const comp = await getCompetition(competitionId);
  if (!roster || !comp) return null;
  const store = getStore();
  return formatRosterExport(
    comp,
    roster.template,
    roster.assignments,
    (id) => {
      const r = store.referees.find((ref) => ref.id === id);
      return r ? { nombre: r.nombre, nivel: r.nivel } : undefined;
    },
    roster.flags,
  );
}

export async function findCompetitionDuplicates(user?: SessionUser) {
  const { groupCompetitionDuplicates } = await import("@/lib/competition-dedup");
  const list = await getCompetitions(user);
  return groupCompetitionDuplicates(list);
}

export async function removeDuplicateCompetitions(user?: SessionUser) {
  const { competitionsToRemoveInGroup } = await import("@/lib/competition-dedup");
  const groups = await findCompetitionDuplicates(user);
  const removed: string[] = [];
  const kept: string[] = [];
  for (const group of groups) {
    const toDrop = competitionsToRemoveInGroup(group.competitions);
    const keep = group.competitions.find((e) => !toDrop.some((d) => d.id === e.id));
    if (keep) kept.push(keep.id);
    for (const c of toDrop) {
      if (await deleteCompetition(c.id)) removed.push(c.id);
    }
  }
  return { removed, kept, groups: groups.length };
}

