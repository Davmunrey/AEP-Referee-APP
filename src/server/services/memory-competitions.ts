import { isCompetitionPast } from "@/lib/competition-status";
import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import { competitionDedupKey } from "@/lib/competition-dedup";
import {
  applyCoverageToCompetition,
  isRosterLockedByApproval,
  isRosterPendingApproval,
  rosterMutationBlockedMessage,
  ROSTER_IMPREVISTO_STATE,
  rosterAnalyticsStats,
} from "@/lib/roster-coverage";
import { isSlotKeyInTemplate, validateAssignment, validateRosterOperation } from "@/lib/roster-rules";
import { formatRosterExport } from "@/lib/roster-export";
import { pruneAssignments } from "@/lib/roster-template";
import { buildRefereeBusyMap, type RefereeBusyMap } from "@/lib/roster-conflicts";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import {
  CompetitionHasClaimsError,
  RosterPaidClaimError,
  RosterSlotConflictError,
} from "@/lib/competitions/service-types";
import {
  paidClaimClearAllMessage,
  paidClaimRemovalMessage,
  paidClaimTemplateMessage,
} from "@/lib/roster-paid-claims";
import { paidClaimRefereeIds } from "./memory-compensation-store";
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
  nextSeqId,
  pushActivity,
  pushHistory,
  setCompetitionTemplate,
} from "@/server/store";
import { buildKpis, healthHistory, parseSlotKey, syncCompetitionCoverage } from "./memory-helpers";
import { getReferee } from "./memory-referees";

export async function getDashboard(user: SessionUser): Promise<DashboardPayload> {
  const store = getStore();
  const userZone =
    user.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
  const competitions = [...store.competitions]
    .filter((c) => !userZone || resolveZoneCode(c.zona) === userZone)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const competitionNames = new Set(competitions.map((c) => c.nombre));
  const scopedReferees = userZone
    ? store.referees.filter((r) => resolveZoneCode(r.zona) === userZone)
    : store.referees;
  const scopedApprovals = userZone
    ? store.approvals.filter((a) => resolveZoneCode(a.zona) === userZone)
    : store.approvals;
  const scopedPromotions = userZone
    ? store.promotions.filter((p) => resolveZoneCode(p.zona) === userZone)
    : store.promotions;
  const activity = userZone
    ? store.activity.filter((item) => competitionNames.has(item.evento))
    : store.activity;
  // Solo campeonatos no celebrados: los pasados inflaban KPIs, salud e
  // "insights" indefinidamente. Misma fórmula de cobertura que la analítica.
  const dashboardCompetitions = competitions.filter((c) => !isCompetitionPast(c));
  const coverage = dashboardCompetitions.map((c) => {
    const assignments = store.assignments.get(c.id) ?? {};
    const s = rosterAnalyticsStats(getCompetitionTemplate(c.id), assignments, c.requeridos);
    return {
      id: c.id,
      nombre: c.nombre,
      fecha: c.fecha,
      estado: c.estado,
      filled: s.filledSlots,
      open: s.openSlots,
      required: s.requiredSlots,
    };
  });
  const { health, insights } = buildIntelligence({
    referees: scopedReferees,
    competitions: dashboardCompetitions,
    approvals: scopedApprovals,
    promotions: scopedPromotions,
    coverage,
    activity,
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
    activity,
    calendar: getCalendarEvents(competitions),
    upcomingCompetitions: dashboardCompetitions.slice(0, 6),
    currentUser: user,
    health,
    insights,
    coverage,
    sanctionAlerts: [],
    generatedAt: new Date().toISOString(),
  };
}

/** Mismo criterio que el twin de Supabase, sobre el store en memoria. */
export async function getRefereeBusyMap(competitionId: string): Promise<RefereeBusyMap> {
  const store = getStore();
  const competition = store.competitions.find((c) => c.id === competitionId);
  if (!competition) return {};
  const assignments: Array<{ competitionId: string; refereeId: string }> = [];
  for (const [id, map] of store.assignments) {
    for (const refereeId of Object.values(map)) {
      if (refereeId) assignments.push({ competitionId: id, refereeId });
    }
  }
  return buildRefereeBusyMap({
    competition,
    others: store.competitions,
    assignments,
  });
}

export async function getCompetitions(user?: SessionUser): Promise<Competition[]> {
  const store = getStore();
  const list = store.competitions.map((comp) => {
    const template = getCompetitionTemplate(comp.id);
    const assignments = store.assignments.get(comp.id) ?? {};
    return applyCoverageToCompetition(comp, template, assignments);
  });
  if (user?.role === "delegado_zona" && user.zona) {
    const userZone = resolveZoneCode(user.zona);
    return list.filter((c) => resolveZoneCode(c.zona) === userZone);
  }
  return list;
}

export async function getCompetitionOptions(
  user?: SessionUser,
): Promise<{ id: string; nombre: string }[]> {
  let list = getStore().competitions;
  if (user?.role === "delegado_zona" && user.zona) {
    const userZone = resolveZoneCode(user.zona);
    list = list.filter((c) => resolveZoneCode(c.zona) === userZone);
  }
  return list.map((c) => ({ id: c.id, nombre: c.nombre }));
}

export async function getCompetition(id: string) {
  const comp = getStore().competitions.find((c) => c.id === id);
  if (!comp) return undefined;
  const store = getStore();
  const template = getCompetitionTemplate(id);
  const assignments = store.assignments.get(id) ?? {};
  return applyCoverageToCompetition(comp, template, assignments);
}

export async function createCompetition(
  input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
  context?: { existing?: { id: string; nombre: string; fecha: string; tipo: string }[] },
): Promise<Competition> {
  const store = getStore();
  // En importaciones por lotes se pasa `context.existing` para dedupe + max-id
  // sin recorrer el store en cada inserción. Sin contexto: comportamiento
  // idéntico al actual (max-id sobre el store, sin dedupe).
  const existingList =
    context?.existing ??
    store.competitions.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      fecha: c.fecha,
      tipo: c.tipo,
    }));
  if (context?.existing) {
    const key = competitionDedupKey(input);
    const dupe = existingList.find(
      (r) => competitionDedupKey({ nombre: r.nombre, fecha: r.fecha, tipo: r.tipo }) === key,
    );
    if (dupe) {
      throw new Error(
        `Ya existe un campeonato igual (${dupe.nombre}, ${dupe.fecha}). Id: ${dupe.id}`,
      );
    }
  }
  // ID por máximo existente, no por longitud: tras borrar una competición
  // intermedia, `length + 1` reutilizaría un id ya usado y machacaría su roster.
  const maxNum = existingList.reduce((max, c) => {
    const m = /^evt-(\d+)$/i.exec(c.id);
    const n = m ? parseInt(m[1]!, 10) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const id = `evt-${String(maxNum + 1).padStart(3, "0")}`;
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
  // Misma protección que el backend de Supabase: un campeonato con
  // liquidaciones no se borra. Se lee el store de compensación por globalThis
  // en vez de importarlo porque memory-compensation ya importa este módulo y
  // el import inverso cerraría un ciclo.
  const claimsStore = (
    globalThis as unknown as { __aepCompensationStore?: Map<string, { competitionId: string }> }
  ).__aepCompensationStore;
  if (claimsStore) {
    let n = 0;
    for (const claim of claimsStore.values()) if (claim.competitionId === id) n += 1;
    if (n > 0) throw new CompetitionHasClaimsError(n);
  }

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
  const assignments = store.assignments.get(competitionId) ?? {};
  const flags = store.slotFlags.get(competitionId) ?? {};
  const pruned = pruneAssignments(template, assignments, flags);
  // Mismo corte que en producción: quitar una sesión borra sus huecos, y por
  // ahí se colaba lo que vaciar la tarima sí impide —dejar sin puesto a un
  // juez ya pagado—. Se comprueba antes de tocar la plantilla.
  const paid = paidClaimRefereeIds(competitionId);
  if (paid.size > 0) {
    const desasignados = new Set<string>();
    for (const [slotKey, refereeId] of Object.entries(assignments)) {
      if (!refereeId || pruned.assignments[slotKey] === refereeId) continue;
      if (paid.has(refereeId)) desasignados.add(refereeId);
    }
    if (desasignados.size > 0) {
      throw new RosterPaidClaimError(paidClaimTemplateMessage(desasignados.size));
    }
  }
  setCompetitionTemplate(competitionId, template);
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
  const refereeId = assignments[slotKey];
  if (!refereeId) {
    return { error: "Asigna un juez antes de marcar flags" };
  }
  const all = { ...(store.slotFlags.get(competitionId) ?? {}) };
  const merged: SlotFlags = {
    compartido: Boolean(flags.compartido),
    intercambio: Boolean(flags.intercambio),
  };
  const resultingFlags: FlagsMap = { ...all };
  if (merged.compartido || merged.intercambio) resultingFlags[slotKey] = merged;
  else delete resultingFlags[slotKey];

  // Igual que en supabase-roster: quitar el * no debe dejar una doble asignación
  // solapada del mismo juez que el override permitía.
  const revalidation = validateRosterOperation({
    template: getCompetitionTemplate(competitionId),
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
  const template = getCompetitionTemplate(competitionId);
  if (!isSlotKeyInTemplate(template, slotKey)) {
    return { ok: false, error: "El hueco no existe en la plantilla del campeonato" };
  }
  return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
}

export async function assignReferee(
  competitionId: string,
  slotKey: string,
  refereeId: string,
  actor: string,
  slotFlags?: SlotFlags,
  expectedRefereeId?: string | null,
): Promise<{
  assignments?: AssignmentsMap;
  flags?: FlagsMap;
  crossZoneMap?: import("@/lib/types").CrossZoneMap;
  error?: string;
  conflict?: boolean;
}> {
  const validation = await validateAssign(competitionId, slotKey, refereeId);
  if (!validation.ok) return { error: validation.error };

  const comp = await getCompetition(competitionId);
  if (!comp) return { error: "Competición no encontrada" };
  const blocked = rosterMutationBlockedMessage(comp.aprobacion);
  if (blocked) return { error: blocked };

  const store = getStore();
  const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
  const template = getCompetitionTemplate(competitionId);
  const storedFlags = store.slotFlags.get(competitionId) ?? {};
  // El * (compartido) del hueco existente o del nuevo permite forzar el solape.
  const operationFlags: FlagsMap =
    slotFlags && (slotFlags.compartido || slotFlags.intercambio)
      ? { ...storedFlags, [slotKey]: slotFlags }
      : storedFlags;
  const operation = validateRosterOperation({
    template,
    assignments,
    slotKey,
    refereeId,
    flags: operationFlags,
  });
  if (!operation.ok) return { error: operation.error };
  // Mismo control optimista que el twin de Supabase, para que ambos backends
  // respondan igual ante dos usuarios sobre la misma tarima.
  if (expectedRefereeId !== undefined) {
    const current = assignments[slotKey] ?? null;
    if (current !== expectedRefereeId) {
      const occupant = current ? store.referees.find((r) => r.id === current) : undefined;
      return {
        conflict: true,
        error: current
          ? `Otro usuario asignó ${occupant?.nombre ?? "a otro juez"} a ese hueco. Actualiza la tarima antes de reasignar.`
          : "Otro usuario liberó ese hueco mientras lo editabas. Actualiza la tarima antes de reasignar.",
      };
    }
  }
  const replacedRefereeId = assignments[slotKey];
  // Mismo criterio que el twin de Supabase: un juez con la liquidación pagada
  // no se puede sustituir.
  if (replacedRefereeId && replacedRefereeId !== refereeId) {
    if (paidClaimRefereeIds(competitionId).has(replacedRefereeId)) {
      const replaced = store.referees.find((r) => r.id === replacedRefereeId);
      return { error: paidClaimRemovalMessage(replaced?.nombre) };
    }
  }
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

  const recheck = validateRosterOperation({
    template,
    assignments,
    slotKey,
    refereeId,
    flags: flagMap,
  });
  if (!recheck.ok) {
    delete assignments[slotKey];
    delete flagMap[slotKey];
    store.assignments.set(competitionId, assignments);
    store.slotFlags.set(competitionId, flagMap);
    return { error: recheck.error };
  }

  syncCompetitionCoverage(competitionId);
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Asignación",
    // Igual que el twin de Supabase: la sustitución deja constancia del juez
    // desplazado, que antes desaparecía del historial sin rastro.
    detail: `${slotKey} → ${refereeId}${
      replacedRefereeId && replacedRefereeId !== refereeId ? ` (sustituye a ${replacedRefereeId})` : ""
    }`,
  });
  return {
    assignments: { ...assignments },
    flags: { ...flagMap },
    crossZoneMap: {},
  };
}

export async function assignRefereesBatch(
  competitionId: string,
  entries: import("./supabase-roster").RosterBatchAssignment[],
  actor: string,
): Promise<{
  results: { ok: boolean; error?: string }[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  crossZoneMap: import("@/lib/types").CrossZoneMap;
}> {
  // Paridad de RESULTADOS con el backend Supabase (no de rendimiento): itera el
  // assign existente, que ya valida incrementalmente sobre el store mutado.
  const results: { ok: boolean; error?: string }[] = [];
  for (const entry of entries) {
    const res = await assignReferee(
      competitionId,
      entry.slotKey,
      entry.refereeId,
      actor,
      entry.flags,
    );
    results.push(res.error ? { ok: false, error: res.error } : { ok: true });
  }
  const roster = await getRoster(competitionId);
  return {
    results,
    assignments: roster?.assignments ?? {},
    flags: roster?.flags ?? {},
    crossZoneMap: roster?.crossZoneMap ?? {},
  };
}

export async function clearSlot(
  competitionId: string,
  slotKey: string,
  actor: string,
  expectedRefereeId?: string | null,
): Promise<AssignmentsMap> {
  const store = getStore();
  const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
  // Mismo control optimista que el twin de Supabase.
  if (expectedRefereeId !== undefined) {
    const current = assignments[slotKey] ?? null;
    if (current !== expectedRefereeId) {
      throw new RosterSlotConflictError(
        current
          ? "Otro usuario cambió ese hueco mientras lo editabas. Actualiza la tarima antes de liberarlo."
          : "Ese hueco ya está libre. Actualiza la tarima.",
      );
    }
  }
  const occupant = assignments[slotKey];
  if (occupant && paidClaimRefereeIds(competitionId).has(occupant)) {
    const referee = store.referees.find((r) => r.id === occupant);
    throw new RosterPaidClaimError(paidClaimRemovalMessage(referee?.nombre));
  }
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
  const paid = paidClaimRefereeIds(competitionId);
  if (paid.size > 0) {
    const assigned = new Set(
      Object.values(store.assignments.get(competitionId) ?? {}).filter((id) => id && paid.has(id)),
    );
    if (assigned.size > 0) throw new RosterPaidClaimError(paidClaimClearAllMessage(assigned.size));
  }
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
      id: nextSeqId("apr"),
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
  // Mutar la fila del store, no `comp`: getCompetition devuelve una COPIA
  // (applyCoverageToCompetition hace {...competition}), así que escribir en la
  // copia dejaba la competición en "Sin propuesta" y sin candado de aprobación.
  const storedComp = store.competitions.find((c) => c.id === competitionId);
  if (storedComp) storedComp.aprobacion = "Propuesta enviada";
  pushActivity({
    tipo: "propuesta",
    actor,
    accion: "envió propuesta de roster para",
    evento: comp.nombre,
    hace: "ahora",
  });
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Propuesta enviada a aprobación",
    detail: `${Object.values(assignments).filter(Boolean).length} asignaciones`,
  });
  return store.approvals.find((a) => a.competitionId === competitionId && a.status === "pendiente");
}

export async function saveDraft(competitionId: string, actor: string) {
  const comp = await getCompetition(competitionId);
  // Igual que en submitRoster: hay que mutar la fila del store, no la copia.
  if (comp && comp.estado === "Borrador") {
    const storedComp = getStore().competitions.find((c) => c.id === competitionId);
    if (storedComp) storedComp.estado = "Incompleto";
  }
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: "Guardó borrador",
  });
}

/** Jueces con la liquidación pagada (mismo criterio que el twin de Supabase). */
export async function getPaidClaimRefereeIds(competitionId: string): Promise<string[]> {
  return [...paidClaimRefereeIds(competitionId)];
}

/** Última propuesta de una competición (mismo criterio que el twin de Supabase). */
export async function getLatestApproval(
  competitionId: string,
): Promise<ApprovalProposal | undefined> {
  const store = getStore();
  return store.approvals
    .filter((a) => a.competitionId === competitionId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id))[0];
}

export async function getApprovals(user?: SessionUser): Promise<ApprovalProposal[]> {
  // Copia y zona canonicalizada, como el twin de Supabase: devolver el array
  // vivo del store dejaba que un llamante lo mutara, y comparar `zona` en
  // crudo ocultaba las propuestas con códigos legados al delegado.
  const list = [...getStore().approvals];
  if (user?.role === "delegado_zona" && user.zona) {
    const userZone = resolveZoneCode(user.zona) ?? user.zona;
    return list.filter((a) => (resolveZoneCode(a.zona) ?? a.zona) === userZone);
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
  // Igual que el twin de Supabase: los hitos del ciclo de aprobación también
  // van al historial de la competición.
  pushHistory({
    competitionId: proposal.competitionId,
    at: proposal.reviewedAt!,
    actor: reviewer,
    action: approve ? "Propuesta aprobada" : "Propuesta rechazada",
    detail: comment?.trim() || undefined,
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
      try {
        if (await deleteCompetition(c.id)) removed.push(c.id);
      } catch (err) {
        // Un duplicado con liquidaciones se conserva, no se borra.
        if (err instanceof CompetitionHasClaimsError) {
          kept.push(c.id);
          continue;
        }
        throw err;
      }
    }
  }
  return { removed, kept, groups: groups.length };
}

export async function unlockImprevisto(
  competitionId: string,
  actor: string,
): Promise<{ message: string; aprobacion: string } | { error: string }> {
  const store = getStore();
  const comp = store.competitions.find((c) => c.id === competitionId);
  if (!comp) return { error: "Competición no encontrada" };
  const pending = isRosterPendingApproval(comp.aprobacion);
  if (!isRosterLockedByApproval(comp.aprobacion) && !pending) {
    return { error: "La tarima ya se puede editar" };
  }
  // Mismo criterio que el twin de Supabase: retirar la propuesta es la salida a
  // la congelación, y borrarla mantiene la garantía de que una propuesta
  // pendiente y la tarima nunca divergen.
  if (pending) {
    for (let i = store.approvals.length - 1; i >= 0; i--) {
      const a = store.approvals[i]!;
      if (a.competitionId === competitionId && a.status === "pendiente") {
        store.approvals.splice(i, 1);
      }
    }
  }
  comp.aprobacion = ROSTER_IMPREVISTO_STATE;
  pushHistory({
    competitionId,
    at: new Date().toISOString(),
    actor,
    action: pending ? "Propuesta retirada" : "Imprevisto registrado",
    detail: pending
      ? "Propuesta retirada de la bandeja de aprobación; tarima editable de nuevo"
      : "Tarima desbloqueada para cambios; reenviar a aprobación tras ajustar",
  });
  pushActivity({
    tipo: "cambio",
    actor,
    accion: pending ? "retiró la propuesta de tarima de" : "registró imprevisto en tarima de",
    evento: comp.nombre,
    hace: "ahora",
  });
  return {
    message: pending
      ? "Propuesta retirada; ya puedes editar la tarima"
      : "Tarima desbloqueada para cambios por imprevisto",
    aprobacion: ROSTER_IMPREVISTO_STATE,
  };
}

