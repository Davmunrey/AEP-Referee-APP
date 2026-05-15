import { countOpenSlots, validateAssignment } from "@/lib/roster-rules";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  Competition,
  DashboardKpi,
  DashboardPayload,
  PromotionRequest,
  Referee,
  RegulationRule,
  RoleKey,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
} from "@/lib/types";
import { REGULATION_RULES, getCalendarEvents, getLevels, getRosterTemplate, getStore, getZones, pushActivity, pushHistory } from "@/server/store";

function parseSlotKey(slotKey: string): { session: string; roleKey: string } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  return { session: parts[0]!, roleKey: parts[1]! };
}

function syncCompetitionCoverage(eventId: string) {
  const store = getStore();
  const comp = store.competitions.find((c) => c.id === eventId);
  if (!comp) return;
  const assignments = store.assignments.get(eventId) ?? {};
  const filled = Object.values(assignments).filter(Boolean).length;
  comp.confirmados = filled;
  const open = countOpenSlots(getRosterTemplate(), assignments);
  if (open === 0) comp.estado = "Completo";
  else if (filled === 0) comp.estado = "Borrador";
  else if (open > 5) comp.estado = "Crítico";
  else comp.estado = "Incompleto";
}

function buildKpis(): DashboardKpi[] {
  const store = getStore();
  const active = store.referees.filter((r) => r.estado === "Activo").length;
  const pending = store.approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  for (const c of store.competitions) {
    openSlots += countOpenSlots(
      getRosterTemplate(),
      store.assignments.get(c.id) ?? {},
    );
  }
  const critical = store.competitions.filter((c) => c.estado === "Crítico").length;

  return [
    {
      label: "Árbitros Activos",
      value: String(active),
      sub: `/ ${store.referees.length} federados`,
      trend: "cuota operativa 2026",
      trendDir: "up",
      accent: "neutral",
    },
    {
      label: "Próximas Competiciones",
      value: String(store.competitions.length),
      sub: "campeonatos en calendario",
      trend: "3 AEP-1 · 1 AEP-2 · 2 AEP-3",
      trendDir: "up",
      accent: "red",
    },
    {
      label: "Plazas sin cubrir",
      value: String(openSlots),
      sub: `en ${store.competitions.length} eventos`,
      trend: `${critical} eventos en estado crítico`,
      trendDir: critical > 0 ? "warn" : "flat",
      accent: "yellow",
    },
    {
      label: "Aprobaciones Pendientes",
      value: String(pending),
      sub: "propuestas regionales",
      trend: "esperan 36 h de media",
      trendDir: "flat",
      accent: "blue",
    },
  ];
}

export const dataService = {
  getMeta: (user: SessionUser): AppMeta => ({
    zones: getZones(),
    levels: getLevels(),
    currentUser: user,
  }),

  getDashboard: (user: SessionUser): DashboardPayload => {
    const store = getStore();
    const competitions = [...store.competitions].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
    return {
      kpis: buildKpis(),
      activity: store.activity,
      calendar: getCalendarEvents(),
      upcomingCompetitions: competitions.slice(0, 6),
      currentUser: user,
    };
  },

  getReferees: (params?: {
    zona?: string;
    nivel?: string;
    estado?: string;
    q?: string;
    user?: SessionUser;
  }): Referee[] => {
    const store = getStore();
    return store.referees.filter((r) => {
      if (params?.user?.role === "regional" && params.user.zona && r.zona !== params.user.zona) {
        return false;
      }
      if (params?.zona && params.zona !== "TODAS" && r.zona !== params.zona) return false;
      if (params?.nivel && params.nivel !== "TODOS" && r.nivel !== params.nivel) return false;
      if (params?.estado && params.estado !== "TODOS" && r.estado !== params.estado) return false;
      if (params?.q && !r.nombre.toLowerCase().includes(params.q.toLowerCase())) return false;
      return true;
    });
  },

  getReferee: (id: string) => getStore().referees.find((r) => r.id === id),

  createReferee: (input: Omit<Referee, "id" | "iniciales">): Referee => {
    const store = getStore();
    const id = `j${String(store.referees.length + 1).padStart(3, "0")}`;
    const iniciales = input.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const referee: Referee = { ...input, id, iniciales };
    store.referees.push(referee);
    pushActivity({
      tipo: "cambio",
      actor: "Sistema",
      accion: "registró al árbitro",
      evento: referee.nombre,
      hace: "ahora",
    });
    return referee;
  },

  updateReferee: (id: string, patch: Partial<Referee>): Referee | undefined => {
    const store = getStore();
    const idx = store.referees.findIndex((r) => r.id === id);
    if (idx < 0) return undefined;
    store.referees[idx] = { ...store.referees[idx]!, ...patch };
    return store.referees[idx];
  },

  getCompetitions: (user?: SessionUser): Competition[] => {
    const list = getStore().competitions;
    if (user?.role === "regional" && user.zona) {
      return list.filter((c) => c.zona === user.zona);
    }
    return list;
  },

  getCompetition: (id: string) => getStore().competitions.find((c) => c.id === id),

  createCompetition: (
    input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
  ): Competition => {
    const store = getStore();
    const id = `evt-${String(store.competitions.length + 1).padStart(3, "0")}`;
    const comp: Competition = {
      ...input,
      id,
      confirmados: 0,
      estado: "Borrador",
      aprobacion: "Sin propuesta",
    };
    store.competitions.push(comp);
    store.assignments.set(id, {});
    return comp;
  },

  updateCompetition: (id: string, patch: Partial<Competition>): Competition | undefined => {
    const store = getStore();
    const idx = store.competitions.findIndex((c) => c.id === id);
    if (idx < 0) return undefined;
    store.competitions[idx] = { ...store.competitions[idx]!, ...patch };
    return store.competitions[idx];
  },

  getRoster: (
    eventId: string,
  ): { template: RosterSession[]; assignments: AssignmentsMap } | undefined => {
    if (!dataService.getCompetition(eventId)) return undefined;
    const store = getStore();
    if (!store.assignments.has(eventId)) store.assignments.set(eventId, {});
    return {
      template: getRosterTemplate(),
      assignments: { ...store.assignments.get(eventId)! },
    };
  },

  validateAssign: (
    eventId: string,
    slotKey: string,
    refereeId: string,
  ): AssignValidation => {
    const comp = dataService.getCompetition(eventId);
    const referee = dataService.getReferee(refereeId);
    if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
    const parsed = parseSlotKey(slotKey);
    if (!parsed) return { ok: false, error: "Slot inválido" };
    return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
  },

  assignReferee: (
    eventId: string,
    slotKey: string,
    refereeId: string,
    actor: string,
  ): { assignments?: AssignmentsMap; error?: string } => {
    const validation = dataService.validateAssign(eventId, slotKey, refereeId);
    if (!validation.ok) return { error: validation.error };

    const store = getStore();
    const assignments = { ...(store.assignments.get(eventId) ?? {}) };
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === refereeId) delete assignments[key];
    }
    assignments[slotKey] = refereeId;
    store.assignments.set(eventId, assignments);
    syncCompetitionCoverage(eventId);
    pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Asignación",
      detail: `${slotKey} → ${refereeId}`,
    });
    return { assignments: { ...assignments } };
  },

  clearSlot: (
    eventId: string,
    slotKey: string,
    actor: string,
  ): AssignmentsMap | undefined => {
    const store = getStore();
    const assignments = { ...(store.assignments.get(eventId) ?? {}) };
    delete assignments[slotKey];
    store.assignments.set(eventId, assignments);
    syncCompetitionCoverage(eventId);
    pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Liberó slot",
      detail: slotKey,
    });
    return { ...assignments };
  },

  submitRoster: (eventId: string, actor: string): ApprovalProposal | undefined => {
    const comp = dataService.getCompetition(eventId);
    if (!comp) return undefined;
    const store = getStore();
    const assignments = { ...(store.assignments.get(eventId) ?? {}) };
    const existing = store.approvals.find(
      (a) => a.eventId === eventId && a.status === "pendiente",
    );
    if (existing) {
      existing.assignments = assignments;
      existing.submittedAt = new Date().toISOString();
      existing.submittedBy = actor;
    } else {
      store.approvals.unshift({
        id: `apr-${Date.now()}`,
        eventId,
        eventName: comp.nombre,
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
    return store.approvals.find((a) => a.eventId === eventId && a.status === "pendiente");
  },

  saveDraft: (eventId: string, actor: string) => {
    const comp = dataService.getCompetition(eventId);
    if (comp && comp.estado === "Borrador") comp.estado = "Incompleto";
    pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Guardó borrador",
    });
  },

  getApprovals: (user?: SessionUser): ApprovalProposal[] => {
    const list = getStore().approvals;
    if (user?.role === "regional" && user.zona) {
      return list.filter((a) => a.zona === user.zona);
    }
    return list;
  },

  reviewApproval: (
    id: string,
    approve: boolean,
    reviewer: string,
    comment?: string,
  ): ApprovalProposal | undefined => {
    const store = getStore();
    const proposal = store.approvals.find((a) => a.id === id);
    if (!proposal || proposal.status !== "pendiente") return undefined;

    proposal.status = approve ? "aprobado" : "rechazado";
    proposal.reviewedBy = reviewer;
    proposal.reviewedAt = new Date().toISOString();
    proposal.comment = comment;

    const comp = store.competitions.find((c) => c.id === proposal.eventId);
    if (comp) {
      if (approve) {
        store.assignments.set(proposal.eventId, { ...proposal.assignments });
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
      evento: proposal.eventName,
      hace: "ahora",
    });
    return proposal;
  },

  getPromotions: (user?: SessionUser): PromotionRequest[] => {
    const list = getStore().promotions;
    if (user?.role === "regional" && user.zona) {
      return list.filter((p) => p.zona === user.zona);
    }
    return list;
  },

  reviewPromotion: (
    id: string,
    approve: boolean,
    reviewer: string,
  ): PromotionRequest | undefined => {
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

  getRegulations: (): RegulationRule[] => REGULATION_RULES,

  getAnalytics: (user?: SessionUser): AnalyticsPayload => {
    const store = getStore();
    const competitions = dataService.getCompetitions(user);
    let openSlots = 0;
    for (const c of competitions) {
      openSlots += countOpenSlots(
        getRosterTemplate(),
        store.assignments.get(c.id) ?? {},
      );
    }
    const coverageByZone = getZones().map((z) => {
      const inZone = store.referees.filter((r) => r.zona === z.code && r.estado === "Activo");
      const assigned = inZone.filter((r) => r.eventos > 0).length;
      const pct = inZone.length ? Math.round((assigned / inZone.length) * 100) : 0;
      return { zona: z.code, name: z.name, pct, eventos: inZone.reduce((a, r) => a + r.eventos, 0) };
    });
    const topReferees = [...store.referees]
      .sort((a, b) => b.eventos - a.eventos)
      .slice(0, 5)
      .map((r) => ({ id: r.id, nombre: r.nombre, eventos: r.eventos, nivel: r.nivel }));

    return {
      coverageByZone,
      topReferees,
      rejectionRate: 8,
      criticalEvents: competitions.filter((c) => c.estado === "Crítico"),
      totals: {
        activeReferees: store.referees.filter((r) => r.estado === "Activo").length,
        totalReferees: store.referees.length,
        pendingApprovals: store.approvals.filter((a) => a.status === "pendiente").length,
        openSlots,
      },
    };
  },

  getRosterHistory: (eventId: string): RosterHistoryEntry[] =>
    getStore().history.filter((h) => h.eventId === eventId),

  exportRoster: (eventId: string) => {
    const roster = dataService.getRoster(eventId);
    const comp = dataService.getCompetition(eventId);
    if (!roster || !comp) return null;
    const store = getStore();
    const lines: string[] = [
      `AEP TARIMA — Plantilla arbitral`,
      `Evento: ${comp.nombre}`,
      `Fechas: ${comp.fecha} – ${comp.fechaFin}`,
      `Sede: ${comp.sede}`,
      `Tipo: ${comp.tipo}`,
      "",
    ];
    for (const session of roster.template) {
      lines.push(`## ${session.sesion} — ${session.nombre}`);
      for (const role of session.roles) {
        for (let i = 0; i < role.slots; i++) {
          const key = `${session.sesion}_${role.key}_${i}`;
          const refId = roster.assignments[key];
          const ref = refId ? store.referees.find((r) => r.id === refId) : undefined;
          lines.push(`- ${role.rol} ${i + 1}: ${ref?.nombre ?? "— VACÍO"} (${ref?.nivel ?? ""})`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  },

  getNavCounts: (user?: SessionUser): { events: number; approvals: number } => {
    const events = dataService.getCompetitions(user).length;
    const approvals = dataService
      .getApprovals(user)
      .filter((a) => a.status === "pendiente").length;
    return { events, approvals };
  },
};
