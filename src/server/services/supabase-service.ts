import { countOpenSlots, validateAssignment, validateRosterOperation } from "@/lib/roster-rules";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import type { ParsedJudgesRegistry } from "@/lib/judges-registry";
import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import type { JudgesRegistryImportApplyResult } from "@/lib/types";
import {
  importJudgesRegistryToSupabase,
} from "@/server/services/import-judges-registry";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import {
  competitionDedupKey,
  competitionsToRemoveInGroup,
  groupCompetitionDuplicates,
} from "@/lib/competition-dedup";
import { LEVELS } from "@/lib/mock-data";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import {
  enumerateSlotKeys,
  normalizeCompetitionTemplate,
  pruneAssignments,
} from "@/lib/roster-template";
import type { CalendarDayEvent } from "@/lib/types";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  AssignValidation,
  FlagsMap,
  Competition,
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
import { computeJudgeProfile } from "@/lib/judge-stats";
import {
  createRefereeSanction,
  expireStaleSanctions,
  getActiveSanction,
  getSanctionAlerts,
  listRefereeSanctions,
  markSanctionDelegateNotified,
  revokeRefereeSanction,
} from "@/server/services/referee-sanctions";
import { formatRosterExport } from "@/lib/roster-export";
import { buildRefereeCompetitionHistory } from "@/lib/referee-competition-history";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assignmentsFromRows,
  flagsFromRows,
  mapActivity,
  mapApproval,
  mapCompetition,
  mapExam,
  mapHistory,
  mapPromotion,
  mapReferee,
  mapRegulation,
  mapReport,
  refereeToDbRow,
} from "@/server/db/mappers";

function db() {
  return createAdminClient();
}

let approvalCompetitionColumnPromise: Promise<boolean> | null = null;
let historyCompetitionColumnPromise: Promise<boolean> | null = null;

async function hasApprovalCompetitionColumns(): Promise<boolean> {
  approvalCompetitionColumnPromise ??= Promise.resolve(
    db()
      .from("approval_proposals")
      .select("competition_id, competition_name")
      .limit(1),
  ).then(({ error }) => !error);
  return approvalCompetitionColumnPromise;
}

async function hasHistoryCompetitionColumn(): Promise<boolean> {
  historyCompetitionColumnPromise ??= Promise.resolve(
    db()
      .from("roster_history")
      .select("competition_id")
      .limit(1),
  ).then(({ error }) => !error);
  return historyCompetitionColumnPromise;
}

function parseSlotKey(slotKey: string): { session: string; roleKey: string } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  return { session: parts[0]!, roleKey: parts[1]! };
}

async function getCompetitionTemplate(competitionId: string): Promise<RosterSession[] | undefined> {
  const supabase = db();
  const { data } = await supabase
    .from("competitions")
    .select("template, tipo")
    .eq("id", competitionId)
    .single();
  if (!data) return undefined;
  return normalizeCompetitionTemplate(
    (data.template as RosterSession[] | null) ?? null,
    data.tipo as Competition["tipo"],
  );
}

async function persistCompetitionTemplate(competitionId: string, template: RosterSession[]) {
  const supabase = db();
  await supabase.from("competitions").update({ template }).eq("id", competitionId);
}

async function getCalendarEvents(): Promise<Record<string, CalendarDayEvent>> {
  const competitions = await supabaseDataService.getCompetitions();
  return calendarEventsFromCompetitions(competitions);
}

async function getZones() {
  const supabase = db();
  const { data } = await supabase.from("zones").select("code, name").order("code");
  return (data ?? []).map((z) => ({ code: z.code, name: z.name }));
}

async function loadAssignments(competitionId: string): Promise<AssignmentsMap> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("slot_key, referee_id")
    .eq("competition_id", competitionId);
  return assignmentsFromRows(data ?? []);
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

async function loadRefereeCompetitionHistory(
  refereeId: string,
): Promise<RefereeCompetitionHistoryItem[]> {
  const supabase = db();
  const { data: assignmentRows } = await supabase
    .from("roster_assignments")
    .select("competition_id, slot_key, flags")
    .eq("referee_id", refereeId);

  const assignments = (assignmentRows ?? []).map((row) => ({
    competitionId: String(row.competition_id),
    slotKey: String(row.slot_key),
    flags: row.flags as Record<string, unknown> | null,
  }));
  const ids = [...new Set(assignments.map((row) => row.competitionId))];
  if (ids.length === 0) return [];

  const { data: competitionRows } = await supabase
    .from("competitions")
    .select("id, nombre, tipo, fecha, fecha_fin, sede, estado, aprobacion")
    .in("id", ids);

  const competitions = (competitionRows ?? []).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre),
    tipo: row.tipo as Competition["tipo"],
    fecha: String(row.fecha),
    fechaFin: String(row.fecha_fin),
    sede: String(row.sede),
    sesiones: 0,
    requeridos: 0,
    confirmados: 0,
    estado: row.estado as Competition["estado"],
    aprobacion: String(row.aprobacion),
  }));

  return buildRefereeCompetitionHistory(competitions, assignments);
}

async function loadFlags(competitionId: string): Promise<FlagsMap> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("slot_key, flags")
    .eq("competition_id", competitionId);
  return flagsFromRows(data ?? []);
}

async function loadCrossZoneMap(
  competitionId: string,
): Promise<import("@/lib/types").CrossZoneMap> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("slot_key, cross_zone")
    .eq("competition_id", competitionId);
  const map: import("@/lib/types").CrossZoneMap = {};
  for (const row of data ?? []) {
    if (row.cross_zone) map[String(row.slot_key)] = true;
  }
  return map;
}

/**
 * Carga TODAS las asignaciones de roster en una sola consulta y las agrupa por
 * `competition_id` en memoria. Evita el patrón N+1 de llamar a
 * `loadAssignments(competitionId)` una vez por competición.
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

async function syncCompetitionCoverage(competitionId: string) {
  const supabase = db();
  const template = (await getCompetitionTemplate(competitionId)) ?? [];
  const assignments = await loadAssignments(competitionId);
  const filled = Object.values(assignments).filter(Boolean).length;
  const open = countOpenSlots(template, assignments);
  let estado: Competition["estado"] = "Incompleto";
  if (open === 0) estado = "Completo";
  else if (filled === 0) estado = "Borrador";
  else if (open > 5) estado = "Crítico";
  await supabase.from("competitions").update({ confirmados: filled, estado }).eq("id", competitionId);
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
  const competitionColumn = (await hasHistoryCompetitionColumn())
    ? "competition_id"
    : "event_id";
  await supabase.from("roster_history").insert({
    id: `hist-${Date.now()}`,
    [competitionColumn]: entry.competitionId,
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
  competitions: { id: string; estado: string; template?: unknown; tipo?: string }[];
  approvals: { status: string }[];
  /** Plazas sin cubrir por competición; clave = id de competición. */
  openSlotsByCompetition: Map<string, number>;
};

async function buildKpis(input?: KpiInput): Promise<DashboardKpi[]> {
  let referees: { estado: string }[];
  let competitions: { id: string; estado: string; template?: unknown; tipo?: string }[];
  let approvals: { status: string }[];
  let openSlotsByCompetition: Map<string, number>;

  if (input) {
    ({ referees, competitions, approvals, openSlotsByCompetition } = input);
  } else {
    const supabase = db();
    const [refRes, compRes, apprRes, assignmentsByComp] = await Promise.all([
      supabase.from("referees").select("estado"),
      supabase.from("competitions").select("id, estado, template, tipo"),
      supabase.from("approval_proposals").select("status"),
      loadAllAssignments(),
    ]);
    referees = refRes.data ?? [];
    competitions = compRes.data ?? [];
    approvals = apprRes.data ?? [];
    openSlotsByCompetition = new Map(
      competitions.map((c) => {
        const tpl = normalizeCompetitionTemplate(
          c.template as RosterSession[] | null,
          c.tipo as Competition["tipo"],
        );
        return [c.id, countOpenSlots(tpl, assignmentsByComp.get(c.id) ?? {})];
      }),
    );
  }

  const active = referees.filter((r) => r.estado === "Activo").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  let openSlots = 0;
  let requiredSlots = 0;
  for (const c of competitions) {
    const tpl = normalizeCompetitionTemplate(
      c.template as RosterSession[] | null,
      c.tipo as Competition["tipo"],
    );
    openSlots += openSlotsByCompetition.get(c.id) ?? 0;
    requiredSlots += enumerateSlotKeys(tpl).length;
  }
  const filledSlots = requiredSlots - openSlots;
  const coveragePct = requiredSlots > 0 ? Math.round((filledSlots / requiredSlots) * 100) : 0;
  const critical = competitions.filter((c) => c.estado === "Crítico").length;
  const refereesLength = referees.length;
  const competitionsLength = competitions.length;

  return [
    {
      label: "Jueces Activos",
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
      sub: `en ${competitionsLength} campeonatos`,
      trend: `${critical} campeonatos en estado crítico`,
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
    {
      label: "Cobertura Nacional",
      value: `${coveragePct}%`,
      sub: `${filledSlots} / ${requiredSlots} plazas`,
      trend: coveragePct >= 80 ? "cobertura óptima" : coveragePct >= 50 ? "cobertura parcial" : "cobertura baja",
      trendDir: coveragePct >= 80 ? "up" : coveragePct >= 50 ? "warn" : "down",
      accent: coveragePct >= 80 ? "blue" : coveragePct >= 50 ? "yellow" : "red",
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
    await expireStaleSanctions();
    const supabase = db();
    const isZoneScoped = user.role === "delegado_zona" && !!user.zona;
    const userZone = isZoneScoped ? resolveZoneCode(user.zona) : undefined;
    const query = supabase.from("competitions").select("*").order("fecha", { ascending: true });
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

    const competitions = (competitionRows ?? [])
      .map((r) => mapCompetition(r as Record<string, unknown>))
      .filter((c) => !userZone || resolveZoneCode(c.zona) === userZone);
    const templateByComp = new Map(
      (competitionRows ?? []).map((r) => {
        const row = r as { id: string; template: RosterSession[] | null; tipo: string };
        const tpl = normalizeCompetitionTemplate(
          row.template,
          row.tipo as Competition["tipo"],
        );
        return [row.id, tpl] as const;
      }),
    );
    const coverage = competitions.map((c) => {
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const filled = Object.values(assignments).filter(Boolean).length;
      const tpl = templateByComp.get(c.id) ?? [];
      const open = countOpenSlots(tpl, assignments);
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
    let kpiCompetitions: {
      id: string;
      estado: string;
      template: RosterSession[] | null;
      tipo: string;
    }[];
    if (isZoneScoped) {
      const { data: allComps } = await supabase
        .from("competitions")
        .select("id, estado, template, tipo");
      kpiCompetitions = (allComps ?? []) as {
        id: string;
        estado: string;
        template: RosterSession[] | null;
        tipo: string;
      }[];
    } else {
      kpiCompetitions = (competitionRows ?? []) as {
        id: string;
        estado: string;
        template: RosterSession[] | null;
        tipo: string;
      }[];
    }
    const kpiOpenSlots = new Map<string, number>(
      kpiCompetitions.map((c) => {
        const tpl = normalizeCompetitionTemplate(
          c.template,
          c.tipo as Competition["tipo"],
        );
        return [c.id, countOpenSlots(tpl, assignmentsByComp.get(c.id) ?? {})];
      }),
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
      sanctionAlerts: await getSanctionAlerts(user),
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
    await expireStaleSanctions();
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
    const row = refereeToDbRow({
      ...input,
      id,
      iniciales,
      zona: normalizeZoneInput(input.zona) ?? input.zona,
    });
    const { data, error } = await supabase.from("referees").insert(row).select().single();
    if (error) throw error;
    await pushActivity({
      tipo: "cambio",
      actor: "Sistema",
      accion: "registró al juez",
      evento: input.nombre,
      hace: "ahora",
    });
    return mapReferee(data as Record<string, unknown>);
  },

  updateReferee: async (id: string, patch: Partial<Referee>): Promise<Referee | undefined> => {
    const supabase = db();
    const merged = { ...patch };
    if (patch.zona !== undefined) {
      merged.zona = normalizeZoneInput(patch.zona) ?? patch.zona;
    }
    if (typeof merged.nombre === "string" && merged.nombre.trim()) {
      merged.iniciales = merged.nombre
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    const dbPatch = refereeToDbRow(merged);
    const { data, error } = await supabase
      .from("referees")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
    return mapReferee(data as Record<string, unknown>);
  },

  getCompetitions: async (user?: SessionUser): Promise<Competition[]> => {
    const supabase = db();
    const { data } = await supabase.from("competitions").select("*").order("fecha");
    const list = (data ?? []).map((r) => mapCompetition(r as Record<string, unknown>));
    if (user?.role === "delegado_zona" && user.zona) {
      const userZone = resolveZoneCode(user.zona);
      return list.filter((c) => resolveZoneCode(c.zona) === userZone);
    }
    return list;
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
    const existing = await supabase.from("competitions").select("id, nombre, fecha, tipo");
    const key = competitionDedupKey(input);
    const dupe = (existing.data ?? []).find(
      (r) =>
        competitionDedupKey({
          nombre: String(r.nombre),
          fecha: String(r.fecha),
          tipo: String(r.tipo),
        }) === key,
    );
    if (dupe) {
      throw new Error(
        `Ya existe un campeonato igual (${String(dupe.nombre)}, ${String(dupe.fecha)}). Id: ${String(dupe.id)}`,
      );
    }
    const maxNum = (existing.data ?? []).reduce((max, row) => {
      const m = /^evt-(\d+)$/i.exec(String(row.id));
      const n = m ? Number.parseInt(m[1]!, 10) : 0;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const id = `evt-${String(maxNum + 1).padStart(3, "0")}`;
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
      zona: normalizeZoneInput(input.zona),
      template: [],
    };
    const { data, error } = await supabase.from("competitions").insert(row).select().single();
    if (error) throw error;
    return mapCompetition(data as Record<string, unknown>);
  },

  updateCompetition: async (id: string, patch: Partial<Competition>): Promise<Competition | undefined> => {
    const supabase = db();
    const dbPatch: Record<string, unknown> = { ...patch };
    if (patch.zona !== undefined) {
      dbPatch.zona = normalizeZoneInput(patch.zona);
    }
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

  getRoster: async (competitionId: string) => {
    if (!(await supabaseDataService.getCompetition(competitionId))) return undefined;
    const template = await getCompetitionTemplate(competitionId);
    const [assignments, flags, crossZoneMap] = await Promise.all([
      loadAssignments(competitionId),
      loadFlags(competitionId),
      loadCrossZoneMap(competitionId),
    ]);
    return {
      template: template ?? [],
      assignments,
      flags,
      crossZoneMap,
    };
  },

  saveCompetitionTemplate: async (
    competitionId: string,
    template: RosterSession[],
    actor: string,
  ): Promise<
    | { template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }
    | undefined
  > => {
    const comp = await supabaseDataService.getCompetition(competitionId);
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
    const payload =
      merged.compartido || merged.intercambio ? merged : {};
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
  ): Promise<AssignValidation> => {
    const comp = await supabaseDataService.getCompetition(competitionId);
    const referee = await supabaseDataService.getReferee(refereeId);
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
    crossZoneReason?: string,
  ): Promise<{ assignments?: AssignmentsMap; flags?: FlagsMap; crossZoneMap?: import("@/lib/types").CrossZoneMap; error?: string }> => {
    const [validation, comp, referee] = await Promise.all([
      supabaseDataService.validateAssign(competitionId, slotKey, refereeId),
      supabaseDataService.getCompetition(competitionId),
      supabaseDataService.getReferee(refereeId),
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
        ? {
            compartido: Boolean(slotFlags.compartido),
            intercambio: Boolean(slotFlags.intercambio),
          }
        : existingFlags[slotKey] ?? {};

    const isCrossZone =
      !!comp?.zona && !!referee?.zona && comp.zona !== referee.zona;

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
      detail: `${slotKey} → ${refereeId}${isCrossZone ? ` (${referee.zona})` : ""}`,
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
  ): Promise<{ assignments: AssignmentsMap; flags: FlagsMap } | undefined> => {
    const comp = await supabaseDataService.getCompetition(competitionId);
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

  submitRoster: async (competitionId: string, actor: string) => {
    const comp = await supabaseDataService.getCompetition(competitionId);
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

  saveDraft: async (competitionId: string, actor: string) => {
    const comp = await supabaseDataService.getCompetition(competitionId);
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

    const proposalCompetitionId = String(proposal.competition_id ?? proposal.event_id);
    const proposalCompetitionName = String(proposal.competition_name ?? proposal.event_name);
    const comp = await supabaseDataService.getCompetition(proposalCompetitionId);
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
    const assignmentsByComp = await loadAllAssignments();
    const supabase = db();
    const { data: compTemplates } = await supabase
      .from("competitions")
      .select("id, template, tipo");
    const templateById = new Map(
      (compTemplates ?? []).map((row) => {
        const r = row as { id: string; template: RosterSession[] | null; tipo: string };
        return [r.id, normalizeCompetitionTemplate(r.template, r.tipo as Competition["tipo"])] as const;
      }),
    );
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
      const tpl = templateById.get(c.id) ?? [];
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const requiredSlots = enumerateSlotKeys(tpl).length;
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
    const { data: referees } = await supabase.from("referees").select("*");
    const mappedReferees = (referees ?? []).map((r) => mapReferee(r as Record<string, unknown>));
    const scopedReferees =
      user?.role === "delegado_zona" && user.zona
        ? mappedReferees.filter((r) => r.zona === user.zona)
        : mappedReferees;
    const zones = await getZones();
    const activityByZone = zones.map((z) => {
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
    const { data: approvals } = await supabase
      .from("approval_proposals")
      .select("status, submitted_at");

    const approvalsForYear = (approvals ?? []).filter(
      (a) => yearFromIso(String(a.submitted_at ?? "")) === selectedYear,
    );
    const reviewed = approvalsForYear.filter((a) => a.status !== "pendiente").length;
    const rejected = approvalsForYear.filter((a) => a.status === "rechazado").length;
    const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;
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
    const selectedYearAgg = yearAgg.get(selectedYear);

    // Cross-zone assignment stats for the selected year
    const selectedYearCompetitionIds = competitions
      .filter((c) => yearFromIso(c.fecha) === selectedYear)
      .map((c) => c.id);

    const { data: crossZoneRows } = selectedYearCompetitionIds.length > 0
      ? await supabase
          .from("roster_assignments")
          .select("competition_id")
          .eq("cross_zone", true)
          .in("competition_id", selectedYearCompetitionIds)
      : { data: [] };

    const crossZoneByComp = new Map<string, number>();
    for (const row of crossZoneRows ?? []) {
      const id = String(row.competition_id);
      crossZoneByComp.set(id, (crossZoneByComp.get(id) ?? 0) + 1);
    }

    const crossZoneByZone = new Map<string, number>();
    for (const c of competitions) {
      if (yearFromIso(c.fecha) !== selectedYear || !c.zona) continue;
      const count = crossZoneByComp.get(c.id) ?? 0;
      if (count > 0) crossZoneByZone.set(c.zona, (crossZoneByZone.get(c.zona) ?? 0) + count);
    }

    const totalCrossZoneSlots = [...crossZoneByZone.values()].reduce((a, n) => a + n, 0);
    const filledForYear = selectedYearAgg?.filledSlots ?? 0;

    const activityByZoneWithCrossZone = activityByZone.map((z) => ({
      ...z,
      crossZoneSlots: crossZoneByZone.get(z.zona) ?? 0,
    }));

    return {
      availableYears: years,
      selectedYear,
      yearlyHistory,
      activityByZone: activityByZoneWithCrossZone,
      topReferees,
      rejectionRate,
      criticalEvents: competitions.filter(
        (c) => c.estado === "Crítico" && yearFromIso(c.fecha) === selectedYear,
      ),
      crossZoneSummary: {
        totalCrossZoneSlots,
        pctOfFilledSlots: filledForYear > 0 ? Math.round((totalCrossZoneSlots / filledForYear) * 100) : 0,
      },
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

  getRosterHistory: async (competitionId: string): Promise<RosterHistoryEntry[]> => {
    const supabase = db();
    const competitionColumn = (await hasHistoryCompetitionColumn()) ? "competition_id" : "event_id";
    const { data } = await supabase
      .from("roster_history")
      .select("*")
      .eq(competitionColumn, competitionId)
      .order("at", { ascending: false });
    return (data ?? []).map((r) => mapHistory(r as Record<string, unknown>));
  },

  exportRoster: async (competitionId: string) => {
    const roster = await supabaseDataService.getRoster(competitionId);
    const comp = await supabaseDataService.getCompetition(competitionId);
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

  deleteReferee: async (id: string): Promise<boolean> => {
    const supabase = db();
    const { error } = await supabase.from("referees").delete().eq("id", id);
    return !error;
  },

  getCompetitionAvailability: async (competitionId: string): Promise<string[]> => {
    const supabase = db();
    const { data } = await supabase
      .from("competition_availability")
      .select("referee_id")
      .eq("competition_id", competitionId);
    return (data ?? []).map((row) => String(row.referee_id));
  },

  addCompetitionAvailability: async (competitionId: string, refereeId: string, actor: string): Promise<void> => {
    const supabase = db();
    const { error } = await supabase.from("competition_availability").upsert(
      { competition_id: competitionId, referee_id: refereeId, created_by: actor },
      { onConflict: "competition_id,referee_id" },
    );
    if (error) throw new Error(error.message);
  },

  removeCompetitionAvailability: async (competitionId: string, refereeId: string): Promise<void> => {
    const supabase = db();
    const { error } = await supabase
      .from("competition_availability")
      .delete()
      .eq("competition_id", competitionId)
      .eq("referee_id", refereeId);
    if (error) throw new Error(error.message);
  },

  deleteCompetition: async (id: string): Promise<boolean> => {
    const supabase = db();
    const approvalCompetitionColumn = (await hasApprovalCompetitionColumns())
      ? "competition_id"
      : "event_id";
    const historyCompetitionColumn = (await hasHistoryCompetitionColumn())
      ? "competition_id"
      : "event_id";
    await supabase.from("roster_assignments").delete().eq("competition_id", id);
    await supabase.from("approval_proposals").delete().eq(approvalCompetitionColumn, id);
    await supabase.from("roster_history").delete().eq(historyCompetitionColumn, id);
    const { data, error } = await supabase
      .from("competitions")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("[deleteCompetition]", id, error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  },

  findCompetitionDuplicates: async (user?: SessionUser) => {
    const list = await supabaseDataService.getCompetitions(user);
    return groupCompetitionDuplicates(list);
  },

  removeDuplicateCompetitions: async (user?: SessionUser) => {
    const groups = await supabaseDataService.findCompetitionDuplicates(user);
    const removed: string[] = [];
    const kept: string[] = [];
    for (const group of groups) {
      const toDrop = competitionsToRemoveInGroup(group.competitions);
      const keep = group.competitions.find((e) => !toDrop.some((d) => d.id === e.id));
      if (keep) kept.push(keep.id);
      for (const c of toDrop) {
        const ok = await supabaseDataService.deleteCompetition(c.id);
        if (ok) removed.push(c.id);
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
    const supabase = db();
    const { data: referee } = await supabase
      .from("referees")
      .select("nombre, nivel, eventos")
      .eq("id", input.refereeId)
      .single();
    if (!referee) throw new Error("Juez no encontrado");
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
      zona: normalizeZoneInput(input.zona) ?? input.zona,
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
    const competitions = await supabaseDataService.getCompetitions(user);
    const approvals = (await supabaseDataService.getApprovals(user)).filter(
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
    const supabase = db();
    let query = supabase
      .from("referee_exams")
      .select("*")
      .order("fecha", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    // Scoping por zona para delegado_zona: limitar a jueces de su zona.
    if (user && user.role === "delegado_zona" && user.zona) {
      const { data: zoneRefs } = await supabase
        .from("referees")
        .select("id")
        .eq("zona", user.zona);
      const ids = (zoneRefs ?? []).map((r) => (r as { id: string }).id);
      if (ids.length === 0) return [];
      query = query.in("referee_id", ids);
    }
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
      .select("nombre, nivel")
      .eq("id", input.refereeId)
      .single();
    if (!ref) throw new Error("Juez no encontrado");
    validateExamLevel(input.tipo, input.nivelObjetivo, ref.nivel as RefereeLevel);
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

  getReport: async (id: string): Promise<RefereeReport | undefined> => {
    const supabase = db();
    const { data } = await supabase
      .from("referee_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapReport(data as Record<string, unknown>) : undefined;
  },

  getReports: async (
    refereeId?: string,
    user?: SessionUser,
  ): Promise<RefereeReport[]> => {
    const supabase = db();
    let query = supabase
      .from("referee_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (refereeId) query = query.eq("referee_id", refereeId);
    if (user && user.role === "delegado_zona" && user.zona) query = query.eq("zona", user.zona);
    const { data } = await query;
    return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
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
    const supabase = db();
    let refereeName: string | null = null;
    let competitionName: string | null = null;
    let zona = input.zona;
    if (input.subjectType === "juez") {
      if (!input.refereeId) throw new Error("Juez obligatorio");
      const { data: ref } = await supabase
        .from("referees")
        .select("nombre, zona")
        .eq("id", input.refereeId)
        .single();
      if (!ref) throw new Error("Juez no encontrado");
      refereeName = String(ref.nombre);
      zona = String(ref.zona ?? zona);
    } else {
      if (!input.competitionId) throw new Error("Competición obligatoria");
      const { data: comp } = await supabase
        .from("competitions")
        .select("nombre, zona")
        .eq("id", input.competitionId)
        .single();
      if (!comp) throw new Error("Competición no encontrada");
      competitionName = String(comp.nombre);
      zona = String(comp.zona ?? zona);
    }
    const row = {
      id: `rep-${Date.now()}`,
      subject_type: input.subjectType,
      zona,
      referee_id: input.refereeId ?? null,
      referee_name: refereeName,
      competition_id: input.competitionId ?? null,
      competition_name: competitionName,
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
      accion: `subió informe «${input.titulo}» de`,
      evento: refereeName ?? competitionName ?? "competición",
      hace: "ahora",
    });
    return mapReport(data as Record<string, unknown>);
  },

  updateReport: async (
    id: string,
    patch: Partial<
      Pick<RefereeReport, "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl">
    >,
  ): Promise<RefereeReport | undefined> => {
    const supabase = db();
    const dbPatch: Record<string, unknown> = {};
    if (patch.titulo !== undefined) dbPatch.titulo = patch.titulo;
    if (patch.tipo !== undefined) dbPatch.tipo = patch.tipo;
    if (patch.evento !== undefined) dbPatch.evento = patch.evento;
    if (patch.contenido !== undefined) dbPatch.contenido = patch.contenido;
    if (patch.adjuntoUrl !== undefined) dbPatch.adjunto_url = patch.adjuntoUrl;
    const { data, error } = await supabase
      .from("referee_reports")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return undefined;
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
    const [exams, reports, sanctions, competitionHistory] = await Promise.all([
      supabaseDataService.getExams(refereeId),
      supabaseDataService.getReports(refereeId),
      listRefereeSanctions(refereeId),
      loadRefereeCompetitionHistory(refereeId),
    ]);
    return computeJudgeProfile(referee, exams, reports, sanctions, competitionHistory);
  },

  listRefereeSanctions,
  getActiveSanction,
  createRefereeSanction,
  revokeRefereeSanction,
  markSanctionDelegateNotified,
  getSanctionAlerts,
  expireStaleSanctions,

  importJudgesRegistry: async (
    parsed: ParsedJudgesRegistry,
    options?: { replace?: boolean },
  ): Promise<JudgesRegistryImportApplyResult> =>
    importJudgesRegistryToSupabase(parsed, options),
};
