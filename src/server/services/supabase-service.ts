import { countOpenSlots, validateAssignment } from "@/lib/roster-rules";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import { CALENDAR_EVENTS, LEVELS, ROSTER_TEMPLATE } from "@/lib/mock-data";
import type { CalendarDayEvent } from "@/lib/types";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  Competition,
  DashboardKpi,
  DashboardPayload,
  ExamResult,
  ExamType,
  JudgeProfile,
  PromotionRequest,
  Referee,
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
import { computeJudgeProfile } from "@/lib/judge-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assignmentsFromRows,
  mapActivity,
  mapApproval,
  mapCompetition,
  mapExam,
  mapHistory,
  mapPromotion,
  mapReferee,
  mapRegulation,
  mapReport,
} from "@/server/db/mappers";

function db() {
  return createAdminClient();
}

function parseSlotKey(slotKey: string): { session: string; roleKey: string } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  return { session: parts[0]!, roleKey: parts[1]! };
}

async function getRosterTemplate(): Promise<RosterSession[]> {
  const supabase = db();
  const { data } = await supabase.from("app_config").select("value").eq("key", "roster_template").single();
  if (data?.value) return data.value as RosterSession[];
  return ROSTER_TEMPLATE;
}

async function getCalendarEvents(): Promise<Record<string, CalendarDayEvent>> {
  const supabase = db();
  const { data } = await supabase.from("app_config").select("value").eq("key", "calendar_events").single();
  if (data?.value) return data.value as Record<string, CalendarDayEvent>;
  return CALENDAR_EVENTS;
}

async function getZones() {
  const supabase = db();
  const { data } = await supabase.from("zones").select("code, name").order("code");
  return (data ?? []).map((z) => ({ code: z.code, name: z.name }));
}

async function loadAssignments(eventId: string): Promise<AssignmentsMap> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("slot_key, referee_id")
    .eq("competition_id", eventId);
  return assignmentsFromRows(data ?? []);
}

/**
 * Carga TODAS las asignaciones de roster en una sola consulta y las agrupa por
 * `competition_id` en memoria. Evita el patrón N+1 de llamar a
 * `loadAssignments(eventId)` una vez por competición.
 */
async function loadAllAssignments(): Promise<Map<string, AssignmentsMap>> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("competition_id, slot_key, referee_id");
  const grouped = new Map<string, { slot_key: string; referee_id: string }[]>();
  for (const row of data ?? []) {
    const id = String(row.competition_id);
    const bucket = grouped.get(id);
    if (bucket) bucket.push(row);
    else grouped.set(id, [row]);
  }
  const result = new Map<string, AssignmentsMap>();
  for (const [id, rows] of grouped) {
    result.set(id, assignmentsFromRows(rows));
  }
  return result;
}

async function syncCompetitionCoverage(eventId: string) {
  const supabase = db();
  const template = await getRosterTemplate();
  const assignments = await loadAssignments(eventId);
  const filled = Object.values(assignments).filter(Boolean).length;
  const open = countOpenSlots(template, assignments);
  let estado: Competition["estado"] = "Incompleto";
  if (open === 0) estado = "Completo";
  else if (filled === 0) estado = "Borrador";
  else if (open > 5) estado = "Crítico";
  await supabase.from("competitions").update({ confirmados: filled, estado }).eq("id", eventId);
}

async function pushActivity(item: Omit<import("@/lib/types").ActivityItem, never>) {
  const supabase = db();
  await supabase.from("activity_log").insert({
    tipo: item.tipo,
    actor: item.actor,
    accion: item.accion,
    evento: item.evento,
    hace: item.hace,
  });
}

async function pushHistory(entry: Omit<RosterHistoryEntry, "id">) {
  const supabase = db();
  await supabase.from("roster_history").insert({
    id: `hist-${Date.now()}`,
    event_id: entry.eventId,
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail ?? null,
  });
}

/**
 * Retroalimentación temporal: registra el índice de salud y lo compara con la
 * última captura. Si la tabla `health_snapshots` aún no existe, degrada sin
 * romper (Supabase devuelve error en data, no lanza excepción).
 */
async function applyHealthHistory(
  health: import("@/lib/types").OperationalHealth,
): Promise<void> {
  const supabase = db();
  const { data: last, error } = await supabase
    .from("health_snapshots")
    .select("score, captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return;
  if (last && typeof last.score === "number") {
    health.previousScore = last.score;
    health.delta = health.score - last.score;
  }
  const lastMs = last?.captured_at ? new Date(last.captured_at).getTime() : 0;
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  if (Date.now() - lastMs > SIX_HOURS) {
    await supabase.from("health_snapshots").insert({
      score: health.score,
      status: health.status,
      factors: health.factors,
    });
  }
}

/**
 * Datos pre-cargados que `buildKpis` puede recibir para evitar consultas
 * duplicadas. Cuando se omite, `buildKpis` los obtiene por sí mismo.
 */
type KpiInput = {
  referees: { estado: string }[];
  competitions: { id: string; estado: string }[];
  approvals: { status: string }[];
  /** Plazas sin cubrir por competición; clave = id de competición. */
  openSlotsByCompetition: Map<string, number>;
};

async function buildKpis(input?: KpiInput): Promise<DashboardKpi[]> {
  let referees: { estado: string }[];
  let competitions: { id: string; estado: string }[];
  let approvals: { status: string }[];
  let openSlotsByCompetition: Map<string, number>;

  if (input) {
    ({ referees, competitions, approvals, openSlotsByCompetition } = input);
  } else {
    const supabase = db();
    const template = await getRosterTemplate();
    const [refRes, compRes, apprRes, assignmentsByComp] = await Promise.all([
      supabase.from("referees").select("estado"),
      supabase.from("competitions").select("id, estado"),
      supabase.from("approval_proposals").select("status"),
      loadAllAssignments(),
    ]);
    referees = refRes.data ?? [];
    competitions = compRes.data ?? [];
    approvals = apprRes.data ?? [];
    openSlotsByCompetition = new Map(
      competitions.map((c) => [
        c.id,
        countOpenSlots(template, assignmentsByComp.get(c.id) ?? {}),
      ]),
    );
  }

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  for (const c of competitions) {
    openSlots += openSlotsByCompetition.get(c.id) ?? 0;
  }
  const critical = competitions.filter((c) => c.estado === "Crítico").length;
  const refereesLength = referees.length;
  const competitionsLength = competitions.length;

  return [
    {
      label: "Árbitros Activos",
      value: String(active),
      sub: `/ ${refereesLength} federados`,
      trend: "cuota operativa 2026",
      trendDir: "up",
      accent: "neutral",
    },
    {
      label: "Próximas Competiciones",
      value: String(competitionsLength),
      sub: "campeonatos en calendario",
      trend: "AEP-1 · AEP-2 · AEP-3",
      trendDir: "up",
      accent: "red",
    },
    {
      label: "Plazas sin cubrir",
      value: String(openSlots),
      sub: `en ${competitionsLength} eventos`,
      trend: `${critical} eventos en estado crítico`,
      trendDir: critical > 0 ? "warn" : "flat",
      accent: "yellow",
    },
    {
      label: "Aprobaciones Pendientes",
      value: String(pending),
      sub: "propuestas regionales",
      trend: "esperan revisión nacional",
      trendDir: "flat",
      accent: "blue",
    },
  ];
}

export const supabaseDataService = {
  getMeta: async (user: SessionUser): Promise<AppMeta> => ({
    zones: await getZones(),
    levels: LEVELS,
    currentUser: user,
  }),

  getDashboard: async (user: SessionUser): Promise<DashboardPayload> => {
    const supabase = db();
    const isZoneScoped = user.role === "delegado_zona" && !!user.zona;
    let query = supabase.from("competitions").select("*").order("fecha", { ascending: true });
    if (isZoneScoped) {
      query = query.eq("zona", user.zona!);
    }
    const template = await getRosterTemplate();
    const [
      { data: competitionRows },
      { data: activity },
      { data: referees },
      { data: approvals },
      { data: promotions },
      assignmentsByComp,
    ] = await Promise.all([
      query,
      supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("referees").select("estado, disp"),
      supabase.from("approval_proposals").select("status"),
      supabase.from("promotion_requests").select("status"),
      loadAllAssignments(),
    ]);

    const competitions = (competitionRows ?? []).map((r) =>
      mapCompetition(r as Record<string, unknown>),
    );
    const coverage = competitions.map((c) => {
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const filled = Object.values(assignments).filter(Boolean).length;
      const open = countOpenSlots(template, assignments);
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
    const activityItems = (activity ?? []).map((r) =>
      mapActivity(r as Record<string, unknown>),
    );
    const { health, insights } = buildIntelligence({
      referees: (referees ?? []) as { estado: string; disp?: boolean }[],
      competitions,
      approvals: (approvals ?? []) as { status: string }[],
      promotions: (promotions ?? []) as { status: string }[],
      coverage,
      activity: activityItems,
    });
    await applyHealthHistory(health);

    // Las KPIs reflejan SIEMPRE el total nacional de competiciones, no el
    // subconjunto filtrado por zona. Si la vista está acotada por zona,
    // recuperamos la lista completa (solo `id, estado`).
    let kpiCompetitions: { id: string; estado: string }[];
    if (isZoneScoped) {
      const { data: allComps } = await supabase
        .from("competitions")
        .select("id, estado");
      kpiCompetitions = (allComps ?? []) as { id: string; estado: string }[];
    } else {
      kpiCompetitions = competitions.map((c) => ({ id: c.id, estado: c.estado }));
    }
    const kpiOpenSlots = new Map<string, number>(
      kpiCompetitions.map((c) => [
        c.id,
        countOpenSlots(template, assignmentsByComp.get(c.id) ?? {}),
      ]),
    );

    return {
      kpis: await buildKpis({
        referees: (referees ?? []) as { estado: string }[],
        competitions: kpiCompetitions,
        approvals: (approvals ?? []) as { status: string }[],
        openSlotsByCompetition: kpiOpenSlots,
      }),
      activity: activityItems,
      calendar: await getCalendarEvents(),
      upcomingCompetitions: competitions.slice(0, 6),
      currentUser: user,
      health,
      insights,
      coverage,
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
    const supabase = db();
    const { data } = await supabase.from("referees").select("*").order("nombre");
    return (data ?? [])
      .map((r) => mapReferee(r as Record<string, unknown>))
      .filter((r) => {
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

  getReferee: async (id: string) => {
    const supabase = db();
    const { data } = await supabase.from("referees").select("*").eq("id", id).single();
    return data ? mapReferee(data as Record<string, unknown>) : undefined;
  },

  createReferee: async (input: Omit<Referee, "id" | "iniciales">): Promise<Referee> => {
    const supabase = db();
    const { count } = await supabase.from("referees").select("*", { count: "exact", head: true });
    const id = `j${String((count ?? 0) + 1).padStart(3, "0")}`;
    const iniciales = input.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const row = { ...input, id, iniciales };
    const { data, error } = await supabase.from("referees").insert(row).select().single();
    if (error) throw error;
    await pushActivity({
      tipo: "cambio",
      actor: "Sistema",
      accion: "registró al árbitro",
      evento: input.nombre,
      hace: "ahora",
    });
    return mapReferee(data as Record<string, unknown>);
  },

  updateReferee: async (id: string, patch: Partial<Referee>): Promise<Referee | undefined> => {
    const supabase = db();
    const { data, error } = await supabase
      .from("referees")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
    return mapReferee(data as Record<string, unknown>);
  },

  getCompetitions: async (user?: SessionUser): Promise<Competition[]> => {
    const supabase = db();
    let query = supabase.from("competitions").select("*").order("fecha");
    if (user?.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapCompetition(r as Record<string, unknown>));
  },

  getCompetition: async (id: string) => {
    const supabase = db();
    const { data } = await supabase.from("competitions").select("*").eq("id", id).single();
    return data ? mapCompetition(data as Record<string, unknown>) : undefined;
  },

  createCompetition: async (
    input: Omit<Competition, "id" | "confirmados" | "estado" | "aprobacion">,
  ): Promise<Competition> => {
    const supabase = db();
    const { count } = await supabase.from("competitions").select("*", { count: "exact", head: true });
    const id = `evt-${String((count ?? 0) + 1).padStart(3, "0")}`;
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
      zona: input.zona ?? null,
    };
    const { data, error } = await supabase.from("competitions").insert(row).select().single();
    if (error) throw error;
    return mapCompetition(data as Record<string, unknown>);
  },

  updateCompetition: async (id: string, patch: Partial<Competition>): Promise<Competition | undefined> => {
    const supabase = db();
    const dbPatch: Record<string, unknown> = { ...patch };
    if (patch.fechaFin) {
      dbPatch.fecha_fin = patch.fechaFin;
      delete dbPatch.fechaFin;
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

  getRoster: async (eventId: string) => {
    if (!(await supabaseDataService.getCompetition(eventId))) return undefined;
    return {
      template: await getRosterTemplate(),
      assignments: await loadAssignments(eventId),
    };
  },

  validateAssign: async (
    eventId: string,
    slotKey: string,
    refereeId: string,
  ): Promise<AssignValidation> => {
    const comp = await supabaseDataService.getCompetition(eventId);
    const referee = await supabaseDataService.getReferee(refereeId);
    if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
    const parsed = parseSlotKey(slotKey);
    if (!parsed) return { ok: false, error: "Slot inválido" };
    return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
  },

  assignReferee: async (
    eventId: string,
    slotKey: string,
    refereeId: string,
    actor: string,
  ): Promise<{ assignments?: AssignmentsMap; error?: string }> => {
    const validation = await supabaseDataService.validateAssign(eventId, slotKey, refereeId);
    if (!validation.ok) return { error: validation.error };

    const supabase = db();
    const assignments = await loadAssignments(eventId);
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === refereeId) {
        await supabase
          .from("roster_assignments")
          .delete()
          .eq("competition_id", eventId)
          .eq("slot_key", key);
        delete assignments[key];
      }
    }
    await supabase.from("roster_assignments").upsert({
      competition_id: eventId,
      slot_key: slotKey,
      referee_id: refereeId,
    });
    assignments[slotKey] = refereeId;
    await syncCompetitionCoverage(eventId);
    await pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Asignación",
      detail: `${slotKey} → ${refereeId}`,
    });
    return { assignments: { ...assignments } };
  },

  clearSlot: async (eventId: string, slotKey: string, actor: string) => {
    const supabase = db();
    await supabase
      .from("roster_assignments")
      .delete()
      .eq("competition_id", eventId)
      .eq("slot_key", slotKey);
    const assignments = await loadAssignments(eventId);
    await syncCompetitionCoverage(eventId);
    await pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Liberó slot",
      detail: slotKey,
    });
    return { ...assignments };
  },

  submitRoster: async (eventId: string, actor: string) => {
    const comp = await supabaseDataService.getCompetition(eventId);
    if (!comp) return undefined;
    const assignments = await loadAssignments(eventId);
    const supabase = db();
    const { data: existing } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq("event_id", eventId)
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
        event_id: eventId,
        event_name: comp.nombre,
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
      .eq("id", eventId);
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
      .eq("event_id", eventId)
      .eq("status", "pendiente")
      .single();
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  saveDraft: async (eventId: string, actor: string) => {
    const comp = await supabaseDataService.getCompetition(eventId);
    if (comp?.estado === "Borrador") {
      const supabase = db();
      await supabase.from("competitions").update({ estado: "Incompleto" }).eq("id", eventId);
    }
    await pushHistory({
      eventId,
      at: new Date().toISOString(),
      actor,
      action: "Guardó borrador",
    });
  },

  getApprovals: async (user?: SessionUser): Promise<ApprovalProposal[]> => {
    const supabase = db();
    let query = supabase.from("approval_proposals").select("*").order("submitted_at", { ascending: false });
    if (user?.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapApproval(r as Record<string, unknown>));
  },

  reviewApproval: async (
    id: string,
    approve: boolean,
    reviewer: string,
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
      .update({
        status,
        reviewed_by: reviewer,
        reviewed_at: now,
        comment: comment ?? null,
      })
      .eq("id", id);

    const comp = await supabaseDataService.getCompetition(proposal.event_id);
    if (comp) {
      if (approve) {
        await supabase.from("roster_assignments").delete().eq("competition_id", proposal.event_id);
        const assignments = proposal.assignments as AssignmentsMap;
        const rows = Object.entries(assignments).map(([slot_key, referee_id]) => ({
          competition_id: proposal.event_id,
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
          .eq("id", proposal.event_id);
      } else {
        await supabase
          .from("competitions")
          .update({ aprobacion: "Rechazado" })
          .eq("id", proposal.event_id);
      }
    }

    await pushActivity({
      tipo: approve ? "aprobacion" : "rechazo",
      actor: reviewer,
      accion: approve ? "aprobó roster para" : "rechazó propuesta para",
      evento: proposal.event_name,
      hace: "ahora",
    });

    const { data } = await supabase.from("approval_proposals").select("*").eq("id", id).single();
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  getPromotions: async (user?: SessionUser): Promise<PromotionRequest[]> => {
    const supabase = db();
    let query = supabase.from("promotion_requests").select("*");
    if (user?.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapPromotion(r as Record<string, unknown>));
  },

  reviewPromotion: async (id: string, approve: boolean, reviewer: string) => {
    const supabase = db();
    const { data: req } = await supabase.from("promotion_requests").select("*").eq("id", id).single();
    if (!req || req.status !== "pendiente") return undefined;

    const status = approve ? "aprobado" : "rechazado";
    await supabase.from("promotion_requests").update({ status }).eq("id", id);
    if (approve) {
      await supabase.from("referees").update({ nivel: req.to_level }).eq("id", req.referee_id);
    }
    await pushActivity({
      tipo: "ascenso",
      actor: reviewer,
      accion: approve ? "aprobó ascenso a" : "rechazó ascenso a",
      evento: req.to_level,
      hace: "ahora",
    });
    const { data } = await supabase.from("promotion_requests").select("*").eq("id", id).single();
    return data ? mapPromotion(data as Record<string, unknown>) : undefined;
  },

  getRegulations: async (): Promise<RegulationRule[]> => {
    const supabase = db();
    const { data } = await supabase.from("regulation_rules").select("*");
    return (data ?? []).map((r) => mapRegulation(r as Record<string, unknown>));
  },

  getAnalytics: async (user?: SessionUser): Promise<AnalyticsPayload> => {
    const competitions = await supabaseDataService.getCompetitions(user);
    const template = await getRosterTemplate();
    const assignmentsByComp = await loadAllAssignments();
    let openSlots = 0;
    for (const c of competitions) {
      openSlots += countOpenSlots(template, assignmentsByComp.get(c.id) ?? {});
    }
    const supabase = db();
    const { data: referees } = await supabase.from("referees").select("*");
    const zones = await getZones();
    const coverageByZone = zones.map((z) => {
      const inZone = (referees ?? [])
        .map((r) => mapReferee(r as Record<string, unknown>))
        .filter((r) => r.zona === z.code && r.estado === "Activo");
      const assigned = inZone.filter((r) => r.eventos > 0).length;
      const pct = inZone.length ? Math.round((assigned / inZone.length) * 100) : 0;
      return { zona: z.code, name: z.name, pct, eventos: inZone.reduce((a, r) => a + r.eventos, 0) };
    });
    const topReferees = [...(referees ?? []).map((r) => mapReferee(r as Record<string, unknown>))]
      .sort((a, b) => b.eventos - a.eventos)
      .slice(0, 5)
      .map((r) => ({ id: r.id, nombre: r.nombre, eventos: r.eventos, nivel: r.nivel }));
    const { data: approvals } = await supabase.from("approval_proposals").select("status");

    const reviewed = (approvals ?? []).filter((a) => a.status !== "pendiente").length;
    const rejected = (approvals ?? []).filter((a) => a.status === "rechazado").length;
    const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;

    return {
      coverageByZone,
      topReferees,
      rejectionRate,
      criticalEvents: competitions.filter((c) => c.estado === "Crítico"),
      totals: {
        activeReferees: (referees ?? []).filter((r) => r.estado === "Activo").length,
        totalReferees: referees?.length ?? 0,
        pendingApprovals: (approvals ?? []).filter((a) => a.status === "pendiente").length,
        openSlots,
      },
    };
  },

  getRosterHistory: async (eventId: string): Promise<RosterHistoryEntry[]> => {
    const supabase = db();
    const { data } = await supabase
      .from("roster_history")
      .select("*")
      .eq("event_id", eventId)
      .order("at", { ascending: false });
    return (data ?? []).map((r) => mapHistory(r as Record<string, unknown>));
  },

  exportRoster: async (eventId: string) => {
    const roster = await supabaseDataService.getRoster(eventId);
    const comp = await supabaseDataService.getCompetition(eventId);
    if (!roster || !comp) return null;
    const supabase = db();
    const { data: referees } = await supabase.from("referees").select("id, nombre, nivel");
    const refMap = new Map((referees ?? []).map((r) => [r.id, r]));

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
          const ref = refId ? refMap.get(refId) : undefined;
          lines.push(`- ${role.rol} ${i + 1}: ${ref?.nombre ?? "— VACÍO"} (${ref?.nivel ?? ""})`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  },

  deleteReferee: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referees").delete().eq("id", id);
    return !error;
  },

  deleteCompetition: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    return !error;
  },

  createPromotion: async (input: {
    refereeId: string;
    toLevel: import("@/lib/types").RefereeLevel;
    zona: string;
    motivo?: string;
  }): Promise<import("@/lib/types").PromotionRequest> => {
    const supabase = db();
    const { data: referee } = await supabase
      .from("referees")
      .select("nombre, nivel, eventos")
      .eq("id", input.refereeId)
      .single();
    if (!referee) throw new Error("Árbitro no encontrado");
    const LEVEL_ORDER = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
    const fromIdx = LEVEL_ORDER.indexOf(referee.nivel as string);
    const toIdx = LEVEL_ORDER.indexOf(input.toLevel);
    if (toIdx <= fromIdx) throw new Error(`El nivel destino (${input.toLevel}) debe ser superior al actual (${referee.nivel})`);
    const id = `pro-${Date.now()}`;
    const row = {
      id,
      referee_id: input.refereeId,
      referee_name: referee.nombre,
      from_level: referee.nivel,
      to_level: input.toLevel,
      zona: input.zona,
      status: "pendiente",
      submitted_at: new Date().toISOString().split("T")[0],
      eventos_completados: referee.eventos,
      motivo: input.motivo ?? null,
    };
    const { data, error } = await supabase.from("promotion_requests").insert(row).select().single();
    if (error) throw error;
    return mapPromotion(data as Record<string, unknown>);
  },

  getNavCounts: async (user?: SessionUser) => {
    const events = (await supabaseDataService.getCompetitions(user)).length;
    const approvals = (await supabaseDataService.getApprovals(user)).filter(
      (a) => a.status === "pendiente",
    ).length;
    return { events, approvals };
  },

  getExams: async (refereeId?: string): Promise<RefereeExam[]> => {
    const supabase = db();
    let query = supabase
      .from("referee_exams")
      .select("*")
      .order("fecha", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    const { data } = await query;
    return (data ?? []).map((r) => mapExam(r as Record<string, unknown>));
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
    const supabase = db();
    const { data: ref } = await supabase
      .from("referees")
      .select("nombre")
      .eq("id", input.refereeId)
      .single();
    if (!ref) throw new Error("Árbitro no encontrado");
    const row = {
      id: `exam-${Date.now()}`,
      referee_id: input.refereeId,
      referee_name: ref.nombre,
      tipo: input.tipo,
      nivel_objetivo: input.nivelObjetivo,
      fecha: input.fecha,
      examinador: input.examinador,
      puntuacion: input.puntuacion ?? null,
      puntuacion_maxima: input.puntuacionMaxima ?? 100,
      resultado: input.resultado ?? "Pendiente",
      notas: input.notas ?? null,
    };
    const { data, error } = await supabase
      .from("referee_exams")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    await pushActivity({
      tipo: "cambio",
      actor: input.examinador,
      accion: `registró examen ${input.tipo} de`,
      evento: ref.nombre,
      hace: "ahora",
    });
    return mapExam(data as Record<string, unknown>);
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
    const supabase = db();
    const dbPatch: Record<string, unknown> = {};
    if (patch.resultado !== undefined) dbPatch.resultado = patch.resultado;
    if (patch.puntuacion !== undefined) dbPatch.puntuacion = patch.puntuacion;
    if (patch.notas !== undefined) dbPatch.notas = patch.notas;
    if (patch.fecha !== undefined) dbPatch.fecha = patch.fecha;
    if (patch.examinador !== undefined) dbPatch.examinador = patch.examinador;
    const { data, error } = await supabase
      .from("referee_exams")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
    return mapExam(data as Record<string, unknown>);
  },

  deleteExam: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referee_exams").delete().eq("id", id);
    return !error;
  },

  getReports: async (refereeId?: string): Promise<RefereeReport[]> => {
    const supabase = db();
    let query = supabase
      .from("referee_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    const { data } = await query;
    return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
  },

  createReport: async (input: {
    refereeId: string;
    titulo: string;
    tipo: ReportType;
    evento?: string;
    contenido: string;
    adjuntoUrl?: string;
    autor: string;
  }): Promise<RefereeReport> => {
    const supabase = db();
    const { data: ref } = await supabase
      .from("referees")
      .select("nombre")
      .eq("id", input.refereeId)
      .single();
    if (!ref) throw new Error("Árbitro no encontrado");
    const row = {
      id: `rep-${Date.now()}`,
      referee_id: input.refereeId,
      referee_name: ref.nombre,
      titulo: input.titulo,
      tipo: input.tipo,
      evento: input.evento ?? null,
      contenido: input.contenido,
      adjunto_url: input.adjuntoUrl ?? null,
      autor: input.autor,
    };
    const { data, error } = await supabase
      .from("referee_reports")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    await pushActivity({
      tipo: "cambio",
      actor: input.autor,
      accion: `subió el informe «${input.titulo}» de`,
      evento: ref.nombre,
      hace: "ahora",
    });
    return mapReport(data as Record<string, unknown>);
  },

  deleteReport: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase
      .from("referee_reports")
      .delete()
      .eq("id", id);
    return !error;
  },

  getJudgeProfile: async (
    refereeId: string,
  ): Promise<JudgeProfile | undefined> => {
    const referee = await supabaseDataService.getReferee(refereeId);
    if (!referee) return undefined;
    const [exams, reports] = await Promise.all([
      supabaseDataService.getExams(refereeId),
      supabaseDataService.getReports(refereeId),
    ]);
    return computeJudgeProfile(referee, exams, reports);
  },
};
