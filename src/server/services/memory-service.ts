import type { ParsedJudgesRegistry } from "@/lib/judges-registry";
import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import type { JudgesRegistryImportApplyResult } from "@/lib/types";
import { importJudgesRegistryToMemory } from "@/server/services/import-judges-registry";
import { countOpenSlots, validateAssignment } from "@/lib/roster-rules";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import { computeJudgeProfile } from "@/lib/judge-stats";
import { formatRosterExport } from "@/lib/roster-export";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import { enumerateSlotKeys, pruneAssignments } from "@/lib/roster-template";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  Competition,
  FlagsMap,
  SlotFlags,
  DashboardKpi,
  DashboardPayload,
  ExamResult,
  ExamType,
  JudgeProfile,
  PromotionRequest,
  Referee,
  RefereeCompetitionHistoryItem,
  RefereeExam,
  RefereeLevel,
  RefereeReport,
  RegulationRule,
  ReportType,
  RoleKey,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
} from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roster-template";
import {
  REGULATION_RULES,
  getCalendarEvents,
  getCompetitionTemplate,
  getLevels,
  getStore,
  getZones,
  pushActivity,
  pushHistory,
  setCompetitionTemplate,
} from "@/server/store";

/** Bitácora de salud en memoria (modo dev sin Supabase). */
const healthHistory: { score: number; at: number }[] = [];

function parseSlotKey(slotKey: string): { session: string; roleKey: string } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  return { session: parts[0]!, roleKey: parts[1]! };
}

function syncCompetitionCoverage(competitionId: string) {
  const store = getStore();
  const comp = store.competitions.find((c) => c.id === competitionId);
  if (!comp) return;
  const assignments = store.assignments.get(competitionId) ?? {};
  const filled = Object.values(assignments).filter(Boolean).length;
  comp.confirmados = filled;
  const open = countOpenSlots(getCompetitionTemplate(competitionId), assignments);
  if (open === 0) comp.estado = "Completo";
  else if (filled === 0) comp.estado = "Borrador";
  else if (open > 5) comp.estado = "Crítico";
  else comp.estado = "Incompleto";
}

function yearFromIso(date: string): number | null {
  const year = Number(String(date).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function validateExamLevel(
  tipo: ExamType,
  nivelObjetivo: RefereeLevel,
  nivelActual: RefereeLevel,
) {
  if (tipo === "Nuevo juez" && nivelObjetivo !== "Regional") {
    throw new Error("Nuevo juez solo puede registrar nivel objetivo Regional");
  }
  if (tipo === "Ascenso IPF" && !["IPF Cat. 2", "IPF Cat. 1"].includes(nivelObjetivo)) {
    throw new Error("Ascenso IPF solo permite IPF Cat. 2 o IPF Cat. 1");
  }
  if (tipo === "Recertificación" && nivelObjetivo !== nivelActual) {
    throw new Error("Recertificación debe usar el nivel actual del juez");
  }
}

function roleLabelFromSlot(slotKey: string): string {
  const role = slotKey.split("_")[1] as keyof typeof ROLE_LABELS | undefined;
  return role ? ROLE_LABELS[role] ?? role : "Rol";
}

function buildMemoryCompetitionHistory(refereeId: string): RefereeCompetitionHistoryItem[] {
  const store = getStore();
  const byCompetition = new Map<string, { roles: Set<string>; slotCount: number }>();
  for (const [competitionId, assignments] of store.assignments.entries()) {
    for (const [slotKey, assignedRefereeId] of Object.entries(assignments)) {
      if (assignedRefereeId !== refereeId) continue;
      const bucket = byCompetition.get(competitionId) ?? {
        roles: new Set<string>(),
        slotCount: 0,
      };
      bucket.roles.add(roleLabelFromSlot(slotKey));
      bucket.slotCount += 1;
      byCompetition.set(competitionId, bucket);
    }
  }
  return [...byCompetition.entries()]
    .map(([competitionId, agg]) => {
      const comp = store.competitions.find((c) => c.id === competitionId);
      if (!comp) return null;
      return {
        competitionId,
        competitionName: comp.nombre,
        tipo: comp.tipo,
        fecha: comp.fecha,
        fechaFin: comp.fechaFin,
        sede: comp.sede,
        estado: comp.estado,
        aprobacion: comp.aprobacion,
        roles: [...agg.roles].sort((a, b) => a.localeCompare(b, "es")),
        slotCount: agg.slotCount,
      } satisfies RefereeCompetitionHistoryItem;
    })
    .filter((item): item is RefereeCompetitionHistoryItem => Boolean(item));
}

function buildKpis(user?: SessionUser): DashboardKpi[] {
  const store = getStore();
  const isZoneScoped =
    user?.role === "delegado_zona" && typeof user.zona === "string";
  const referees = isZoneScoped
    ? store.referees.filter((r) => r.zona === user!.zona)
    : store.referees;
  const competitions = isZoneScoped
    ? store.competitions.filter((c) => c.zona === user!.zona)
    : store.competitions;
  const approvals = isZoneScoped
    ? store.approvals.filter((a) => a.zona === user!.zona)
    : store.approvals;

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  for (const c of competitions) {
    openSlots += countOpenSlots(
      getCompetitionTemplate(c.id),
      store.assignments.get(c.id) ?? {},
    );
  }
  const critical = competitions.filter((c) => c.estado === "Crítico").length;

  const subAlcance = isZoneScoped ? `zona ${user!.zona}` : "temporada 2026";

  return [
    {
      label: "Jueces Activos",
      value: String(active),
      sub: `/ ${referees.length} federados`,
      trend: subAlcance,
      trendDir: "up",
      accent: "neutral",
    },
    {
      label: "Próximas Competiciones",
      value: String(competitions.length),
      sub: "campeonatos en calendario",
      trend: subAlcance,
      trendDir: "up",
      accent: "red",
    },
    {
      label: "Plazas sin cubrir",
      value: String(openSlots),
      sub: `en ${competitions.length} campeonatos`,
      trend: `${critical} campeonatos en estado crítico`,
      trendDir: critical > 0 ? "warn" : "flat",
      accent: "yellow",
    },
    {
      label: "Aprobaciones Pendientes",
      value: String(pending),
      sub: "propuestas regionales",
      trend: subAlcance,
      trendDir: "flat",
      accent: "blue",
    },
  ];
}

export const memoryDataService = {
  getMeta: async (user: SessionUser): Promise<AppMeta> => ({
    zones: getZones(),
    levels: getLevels(),
    currentUser: user,
  }),

  getDashboard: async (user: SessionUser): Promise<DashboardPayload> => {
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
  },

  getReferees: async (params?: {
    zona?: string;
    nivel?: string;
    estado?: string;
    q?: string;
    user?: SessionUser;
  }): Promise<Referee[]> => {
    const store = getStore();
    return store.referees.filter((r) => {
      if (params?.user?.role === "delegado_zona" && params.user.zona && r.zona !== params.user.zona) {
        return false;
      }
      if (params?.zona && params.zona !== "TODAS" && r.zona !== params.zona) return false;
      if (params?.nivel && params.nivel !== "TODOS" && r.nivel !== params.nivel) return false;
      if (params?.estado && params.estado !== "TODOS" && r.estado !== params.estado) return false;
      if (params?.q && !r.nombre.toLowerCase().includes(params.q.toLowerCase())) return false;
      return true;
    });
  },

  getReferee: async (id: string) => getStore().referees.find((r) => r.id === id),

  createReferee: async (input: Omit<Referee, "id" | "iniciales">): Promise<Referee> => {
    const store = getStore();
    const id = `j${String(store.referees.length + 1).padStart(3, "0")}`;
    const iniciales = input.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const referee: Referee = {
      ...input,
      id,
      iniciales,
      zona: normalizeZoneInput(input.zona) ?? input.zona,
    };
    store.referees.push(referee);
    pushActivity({
      tipo: "cambio",
      actor: "Sistema",
      accion: "registró al juez",
      evento: referee.nombre,
      hace: "ahora",
    });
    return referee;
  },

  updateReferee: async (id: string, patch: Partial<Referee>): Promise<Referee | undefined> => {
    const store = getStore();
    const idx = store.referees.findIndex((r) => r.id === id);
    if (idx < 0) return undefined;
    const merged = {
      ...store.referees[idx]!,
      ...patch,
      ...(patch.zona !== undefined
        ? { zona: normalizeZoneInput(patch.zona) ?? patch.zona }
        : {}),
    };
    if (typeof patch.nombre === "string" && patch.nombre.trim()) {
      merged.iniciales = patch.nombre
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    store.referees[idx] = merged;
    return merged;
  },

  getCompetitions: async (user?: SessionUser): Promise<Competition[]> => {
    const list = getStore().competitions;
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona);
      return list.filter((c) => resolveZoneCode(c.zona) === userZone);
    }
    return list;
  },

  getCompetition: async (id: string) => getStore().competitions.find((c) => c.id === id),

  createCompetition: async (
    input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
  ): Promise<Competition> => {
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
  },

  updateCompetition: async (id: string, patch: Partial<Competition>): Promise<Competition | undefined> => {
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
  },

  getRoster: async (
    competitionId: string,
  ): Promise<
    { template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap } | undefined
  > => {
    if (!(await memoryDataService.getCompetition(competitionId))) return undefined;
    const store = getStore();
    if (!store.assignments.has(competitionId)) store.assignments.set(competitionId, {});
    if (!store.slotFlags.has(competitionId)) store.slotFlags.set(competitionId, {});
    return {
      template: getCompetitionTemplate(competitionId),
      assignments: { ...store.assignments.get(competitionId)! },
      flags: { ...store.slotFlags.get(competitionId)! },
    };
  },

  saveCompetitionTemplate: async (
    competitionId: string,
    template: RosterSession[],
    actor: string,
  ) => {
    const comp = await memoryDataService.getCompetition(competitionId);
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
  },

  setSlotFlags: async (
    competitionId: string,
    slotKey: string,
    flags: SlotFlags,
    actor: string,
  ): Promise<{ flags: FlagsMap } | { error: string }> => {
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
  },

  validateAssign: async (
    competitionId: string,
    slotKey: string,
    refereeId: string,
  ): Promise<AssignValidation> => {
    const comp = await memoryDataService.getCompetition(competitionId);
    const referee = await memoryDataService.getReferee(refereeId);
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
    slotFlags?: SlotFlags,
  ): Promise<{ assignments?: AssignmentsMap; flags?: FlagsMap; error?: string }> => {
    const validation = await memoryDataService.validateAssign(competitionId, slotKey, refereeId);
    if (!validation.ok) return { error: validation.error };

    const store = getStore();
    const assignments = { ...(store.assignments.get(competitionId) ?? {}) };
    // El juez puede estar en varias sesiones; solo se libera su slot previo
    // dentro de la MISMA sesión.
    const session = slotKey.split("_")[0];
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === refereeId && key.split("_")[0] === session) {
        delete assignments[key];
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
  },

  clearSlot: async (
    competitionId: string,
    slotKey: string,
    actor: string,
  ): Promise<AssignmentsMap | undefined> => {
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
  },

  submitRoster: async (competitionId: string, actor: string): Promise<ApprovalProposal | undefined> => {
    const comp = await memoryDataService.getCompetition(competitionId);
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
    } else {
      store.approvals.unshift({
        id: `apr-${Date.now()}`,
        competitionId,
        competitionName: comp.nombre,
        zona: comp.zona ?? "—",
        submittedBy: actor,
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
  },

  saveDraft: async (competitionId: string, actor: string) => {
    const comp = await memoryDataService.getCompetition(competitionId);
    if (comp && comp.estado === "Borrador") comp.estado = "Incompleto";
    pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: "Guardó borrador",
    });
  },

  getApprovals: async (user?: SessionUser): Promise<ApprovalProposal[]> => {
    const list = getStore().approvals;
    if (user?.role === "delegado_zona" && user.zona) {
      return list.filter((a) => a.zona === user.zona);
    }
    return list;
  },

  reviewApproval: async (
    id: string,
    approve: boolean,
    reviewer: string,
    comment?: string,
  ): Promise<ApprovalProposal | undefined> => {
    const store = getStore();
    const proposal = store.approvals.find((a) => a.id === id);
    if (!proposal || proposal.status !== "pendiente") return undefined;

    proposal.status = approve ? "aprobado" : "rechazado";
    proposal.reviewedBy = reviewer;
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
  },

  getPromotions: async (user?: SessionUser): Promise<PromotionRequest[]> => {
    const list = getStore().promotions;
    if (user?.role === "delegado_zona" && user.zona) {
      return list.filter((p) => p.zona === user.zona);
    }
    return list;
  },

  reviewPromotion: async (
    id: string,
    approve: boolean,
    reviewer: string,
  ): Promise<PromotionRequest | undefined> => {
    const store = getStore();
    const req = store.promotions.find((p) => p.id === id);
    if (!req || req.status !== "pendiente") return undefined;
    req.status = approve ? "aprobado" : "rechazado";
    if (approve) {
      const ref = store.referees.find((r) => r.id === req.refereeId);
      if (ref) ref.nivel = req.toLevel;
    }
    pushActivity({
      tipo: "ascenso",
      actor: reviewer,
      accion: approve ? "aprobó ascenso a" : "rechazó ascenso a",
      evento: req.toLevel,
      hace: "ahora",
    });
    return req;
  },

  getRegulations: async (): Promise<RegulationRule[]> => REGULATION_RULES,

  getAnalytics: async (user?: SessionUser): Promise<AnalyticsPayload> => {
    const store = getStore();
    const competitions = await memoryDataService.getCompetitions(user);
    const scopedReferees =
      user?.role === "delegado_zona" && user.zona
        ? store.referees.filter((r) => r.zona === user.zona)
        : store.referees;
    const years = Array.from(
      new Set(competitions.map((c) => yearFromIso(c.fecha)).filter((y): y is number => y != null)),
    ).sort((a, b) => a - b);
    const selectedYear = years[years.length - 1] ?? new Date().getFullYear();
    const yearAgg = new Map<number, {
      competitions: number;
      criticalCompetitions: number;
      requiredSlots: number;
      filledSlots: number;
      refereeIds: Set<string>;
    }>();
    const zoneAgg = new Map<string, {
      competitions: number;
      criticalCompetitions: number;
      requiredSlots: number;
      filledSlots: number;
      refereeIds: Set<string>;
    }>();
    const topRefAgg = new Map<string, { competitionIds: Set<string>; slots: number }>();

    for (const c of competitions) {
      const year = yearFromIso(c.fecha);
      if (year == null) continue;
      const template = getCompetitionTemplate(c.id);
      const assignments = store.assignments.get(c.id) ?? {};
      const requiredSlots = enumerateSlotKeys(template).length;
      const filledSlots = Object.values(assignments).filter(Boolean).length;
      const assignedIds = new Set(Object.values(assignments).filter(Boolean));

      const y = yearAgg.get(year) ?? {
        competitions: 0,
        criticalCompetitions: 0,
        requiredSlots: 0,
        filledSlots: 0,
        refereeIds: new Set<string>(),
      };
      y.competitions += 1;
      y.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
      y.requiredSlots += requiredSlots;
      y.filledSlots += filledSlots;
      assignedIds.forEach((id) => y.refereeIds.add(id));
      yearAgg.set(year, y);

      if (year === selectedYear && c.zona) {
        const z = zoneAgg.get(c.zona) ?? {
          competitions: 0,
          criticalCompetitions: 0,
          requiredSlots: 0,
          filledSlots: 0,
          refereeIds: new Set<string>(),
        };
        z.competitions += 1;
        z.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
        z.requiredSlots += requiredSlots;
        z.filledSlots += filledSlots;
        assignedIds.forEach((id) => z.refereeIds.add(id));
        zoneAgg.set(c.zona, z);
      }

      if (year === selectedYear) {
        Object.values(assignments)
          .filter(Boolean)
          .forEach((refereeId) => {
            const refAgg = topRefAgg.get(refereeId) ?? {
              competitionIds: new Set<string>(),
              slots: 0,
            };
            refAgg.competitionIds.add(c.id);
            refAgg.slots += 1;
            topRefAgg.set(refereeId, refAgg);
          });
      }
    }

    const yearlyHistory = [...yearAgg.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, agg]) => ({
        year,
        competitions: agg.competitions,
        criticalCompetitions: agg.criticalCompetitions,
        requiredSlots: agg.requiredSlots,
        filledSlots: agg.filledSlots,
        uniqueAssignedReferees: agg.refereeIds.size,
      }));

    const activityByZone = getZones().map((z) => {
      const agg = zoneAgg.get(z.code);
      const activeReferees = scopedReferees.filter(
        (r) => r.zona === z.code && r.estado === "Activo",
      ).length;
      return {
        zona: z.code,
        name: z.name,
        competitions: agg?.competitions ?? 0,
        criticalCompetitions: agg?.criticalCompetitions ?? 0,
        requiredSlots: agg?.requiredSlots ?? 0,
        filledSlots: agg?.filledSlots ?? 0,
        uniqueAssignedReferees: agg?.refereeIds.size ?? 0,
        activeReferees,
      };
    });

    const topReferees = [...topRefAgg.entries()]
      .map(([id, agg]) => {
        const referee = scopedReferees.find((r) => r.id === id);
        if (!referee) return null;
        return {
          id,
          nombre: referee.nombre,
          nivel: referee.nivel,
          assignedCompetitions: agg.competitionIds.size,
          assignedSlots: agg.slots,
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        (b!.assignedCompetitions - a!.assignedCompetitions) ||
        (b!.assignedSlots - a!.assignedSlots) ||
        a!.nombre.localeCompare(b!.nombre, "es"))
      .slice(0, 5) as AnalyticsPayload["topReferees"];

    const approvalsForYear = store.approvals.filter(
      (a) => yearFromIso(a.submittedAt) === selectedYear,
    );
    const reviewed = approvalsForYear.filter((a) => a.status !== "pendiente").length;
    const rejected = approvalsForYear.filter((a) => a.status === "rechazado").length;
    const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;
    const selectedYearAgg = yearAgg.get(selectedYear);

    return {
      availableYears: years,
      selectedYear,
      yearlyHistory,
      activityByZone,
      topReferees,
      rejectionRate,
      criticalEvents: competitions.filter(
        (c) => c.estado === "Crítico" && yearFromIso(c.fecha) === selectedYear,
      ),
      totals: {
        competitions: selectedYearAgg?.competitions ?? 0,
        criticalCompetitions: selectedYearAgg?.criticalCompetitions ?? 0,
        activeReferees: scopedReferees.filter((r) => r.estado === "Activo").length,
        totalReferees: scopedReferees.length,
        pendingApprovals: approvalsForYear.filter((a) => a.status === "pendiente").length,
        uniqueAssignedReferees: selectedYearAgg?.refereeIds.size ?? 0,
        filledSlots: selectedYearAgg?.filledSlots ?? 0,
        openSlots: selectedYearAgg
          ? Math.max(0, selectedYearAgg.requiredSlots - selectedYearAgg.filledSlots)
          : 0,
      },
    };
  },

  getRosterHistory: async (competitionId: string): Promise<RosterHistoryEntry[]> =>
    getStore().history.filter((h) => h.competitionId === competitionId),

  exportRoster: async (competitionId: string) => {
    const roster = await memoryDataService.getRoster(competitionId);
    const comp = await memoryDataService.getCompetition(competitionId);
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
  },

  deleteReferee: async (id: string): Promise<boolean> => {
    const store = getStore();
    const idx = store.referees.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    store.referees.splice(idx, 1);
    return true;
  },

  deleteCompetition: async (id: string): Promise<boolean> => {
    const store = getStore();
    const idx = store.competitions.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    store.competitions.splice(idx, 1);
    store.assignments.delete(id);
    store.slotFlags.delete(id);
    return true;
  },

  findCompetitionDuplicates: async (user?: import("@/lib/types").SessionUser) => {
    const { groupCompetitionDuplicates } = await import("@/lib/competition-dedup");
    const list = await memoryDataService.getCompetitions(user);
    return groupCompetitionDuplicates(list);
  },

  removeDuplicateCompetitions: async (user?: import("@/lib/types").SessionUser) => {
    const { competitionsToRemoveInGroup } = await import("@/lib/competition-dedup");
    const groups = await memoryDataService.findCompetitionDuplicates(user);
    const removed: string[] = [];
    const kept: string[] = [];
    for (const group of groups) {
      const toDrop = competitionsToRemoveInGroup(group.competitions);
      const keep = group.competitions.find((e) => !toDrop.some((d) => d.id === e.id));
      if (keep) kept.push(keep.id);
      for (const c of toDrop) {
        if (await memoryDataService.deleteCompetition(c.id)) removed.push(c.id);
      }
    }
    return { removed, kept, groups: groups.length };
  },

  createPromotion: async (input: {
    refereeId: string;
    toLevel: import("@/lib/types").RefereeLevel;
    zona: string;
    motivo?: string;
  }): Promise<import("@/lib/types").PromotionRequest> => {
    const store = getStore();
    const referee = store.referees.find((r) => r.id === input.refereeId);
    if (!referee) throw new Error("Juez no encontrado");
    const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
    const fromIdx = LEVEL_ORDER.indexOf(referee.nivel);
    const toIdx = LEVEL_ORDER.indexOf(input.toLevel);
    if (toIdx <= fromIdx) throw new Error(`El nivel destino (${input.toLevel}) debe ser superior al actual (${referee.nivel})`);
    const req: import("@/lib/types").PromotionRequest = {
      id: `pro-${Date.now()}`,
      refereeId: input.refereeId,
      refereeName: referee.nombre,
      fromLevel: referee.nivel,
      toLevel: input.toLevel,
      zona: normalizeZoneInput(input.zona) ?? input.zona,
      status: "pendiente",
      submittedAt: new Date().toISOString().split("T")[0]!,
      eventosCompletados: referee.eventos,
      motivo: input.motivo,
    };
    store.promotions.unshift(req);
    return req;
  },

  getNavCounts: async (user?: SessionUser) => {
    const competitions = await memoryDataService.getCompetitions(user);
    const approvals = (await memoryDataService.getApprovals(user)).filter(
      (a) => a.status === "pendiente",
    ).length;
    return {
      competitions: competitions.length,
      approvals,
      activeRosterHref: pickActiveRosterHref(competitions),
    };
  },

  getExams: async (
    refereeId?: string,
    user?: SessionUser,
  ): Promise<RefereeExam[]> => {
    const store = getStore();
    let exams = store.exams.slice();
    // Scoping por zona para delegado_zona: solo exámenes de jueces de su zona.
    if (user && user.role === "delegado_zona" && user.zona) {
      const zoneRefs = new Set(
        store.referees.filter((r) => r.zona === user.zona).map((r) => r.id),
      );
      exams = exams.filter((e) => zoneRefs.has(e.refereeId));
    }
    if (refereeId) exams = exams.filter((e) => e.refereeId === refereeId);
    return exams.sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  createExam: async (input: {
    refereeId: string;
    tipo: ExamType;
    nivelObjetivo: RefereeLevel;
    fecha: string;
    examinador: string;
    puntuacion?: number;
    puntuacionMaxima?: number;
    resultado?: ExamResult;
    notas?: string;
  }): Promise<RefereeExam> => {
    const store = getStore();
    const referee = store.referees.find((r) => r.id === input.refereeId);
    if (!referee) throw new Error("Juez no encontrado");
    validateExamLevel(input.tipo, input.nivelObjetivo, referee.nivel);
    const exam: RefereeExam = {
      id: `exam-${Date.now()}`,
      refereeId: input.refereeId,
      refereeName: referee.nombre,
      tipo: input.tipo,
      nivelObjetivo: input.nivelObjetivo,
      fecha: input.fecha,
      examinador: input.examinador,
      puntuacion: input.puntuacion,
      puntuacionMaxima: input.puntuacionMaxima ?? 100,
      resultado: input.resultado ?? "Pendiente",
      notas: input.notas,
      createdAt: new Date().toISOString(),
    };
    store.exams.unshift(exam);
    return exam;
  },

  updateExam: async (
    id: string,
    patch: Partial<
      Pick<
        RefereeExam,
        "resultado" | "puntuacion" | "notas" | "fecha" | "examinador"
      >
    >,
  ): Promise<RefereeExam | undefined> => {
    const exam = getStore().exams.find((e) => e.id === id);
    if (!exam) return undefined;
    Object.assign(exam, patch);
    return exam;
  },

  deleteExam: async (id: string): Promise<boolean> => {
    const store = getStore();
    const idx = store.exams.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    store.exams.splice(idx, 1);
    return true;
  },

  getReport: async (id: string): Promise<RefereeReport | undefined> =>
    getStore().reports.find((r) => r.id === id),

  getReports: async (
    refereeId?: string,
    user?: SessionUser,
  ): Promise<RefereeReport[]> => {
    const store = getStore();
    let reports = store.reports.slice();
    if (user && user.role === "delegado_zona" && user.zona) {
      reports = reports.filter((r) => r.zona === user.zona);
    }
    if (refereeId) reports = reports.filter((r) => r.refereeId === refereeId);
    return reports.sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
  },

  createReport: async (input: {
    subjectType: RefereeReport["subjectType"];
    zona: string;
    refereeId?: string;
    competitionId?: string;
    titulo: string;
    tipo: ReportType;
    evento?: string;
    contenido: string;
    adjuntoUrl?: string;
    autor: string;
  }): Promise<RefereeReport> => {
    const store = getStore();
    const referee = input.refereeId
      ? store.referees.find((r) => r.id === input.refereeId)
      : undefined;
    const competition = input.competitionId
      ? store.competitions.find((c) => c.id === input.competitionId)
      : undefined;
    if (input.subjectType === "juez" && !referee) throw new Error("Juez no encontrado");
    if (input.subjectType === "competicion" && !competition) {
      throw new Error("Competición no encontrada");
    }
    const report: RefereeReport = {
      id: `rep-${Date.now()}`,
      subjectType: input.subjectType,
      zona: referee?.zona ?? competition?.zona ?? input.zona,
      refereeId: referee?.id,
      refereeName: referee?.nombre,
      competitionId: competition?.id,
      competitionName: competition?.nombre,
      titulo: input.titulo,
      tipo: input.tipo,
      evento: input.evento,
      contenido: input.contenido,
      adjuntoUrl: input.adjuntoUrl,
      autor: input.autor,
      createdAt: new Date().toISOString(),
    };
    store.reports.unshift(report);
    return report;
  },

  updateReport: async (
    id: string,
    patch: Partial<
      Pick<RefereeReport, "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl">
    >,
  ): Promise<RefereeReport | undefined> => {
    const report = getStore().reports.find((r) => r.id === id);
    if (!report) return undefined;
    Object.assign(report, patch);
    return report;
  },

  deleteReport: async (id: string): Promise<boolean> => {
    const store = getStore();
    const idx = store.reports.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    store.reports.splice(idx, 1);
    return true;
  },

  getJudgeProfile: async (
    refereeId: string,
  ): Promise<JudgeProfile | undefined> => {
    const referee = await memoryDataService.getReferee(refereeId);
    if (!referee) return undefined;
    const store = getStore();
    const [exams, reports] = await Promise.all([
      memoryDataService.getExams(refereeId),
      memoryDataService.getReports(refereeId),
    ]);
    const sanctions = store.sanctions.filter((s) => s.refereeId === refereeId);
    return computeJudgeProfile(
      referee,
      exams,
      reports,
      sanctions,
      buildMemoryCompetitionHistory(refereeId),
    );
  },

  listRefereeSanctions: async (refereeId: string) => {
    const store = getStore();
    return store.sanctions
      .filter((s) => s.refereeId === refereeId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  getActiveSanction: async (refereeId: string) => {
    const list = await memoryDataService.listRefereeSanctions(refereeId);
    const { isSanctionActive } = await import("@/lib/sanctions");
    return list.find((s) => isSanctionActive(s));
  },

  createRefereeSanction: async () => {
    throw new Error("Sanciones requieren Supabase configurado");
  },

  revokeRefereeSanction: async () => {
    throw new Error("Sanciones requieren Supabase configurado");
  },

  markSanctionDelegateNotified: async () => {
    throw new Error("Sanciones requieren Supabase configurado");
  },

  getSanctionAlerts: async () => [],

  expireStaleSanctions: async () => 0,

  importJudgesRegistry: async (
    parsed: ParsedJudgesRegistry,
    options?: { replace?: boolean },
  ): Promise<JudgesRegistryImportApplyResult> =>
    importJudgesRegistryToMemory(parsed, options),
};
