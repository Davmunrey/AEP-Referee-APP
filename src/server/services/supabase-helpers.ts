import { cache } from "react";
import {
  computeRosterCoverage,
  deriveCompetitionEstado,
} from "@/lib/roster-coverage";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type { CalendarDayEvent } from "@/lib/types";
import type {
  AssignmentsMap,
  Competition,
  FlagsMap,
  RosterHistoryEntry,
  RosterSession,
} from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assignmentsFromRows,
  flagsFromRows,
  mapActivity,
} from "@/server/db/mappers";
import { getZonesCached } from "@/server/cache/static-data";

export function db() {
  return createAdminClient();
}

let approvalCompetitionColumnPromise: Promise<boolean> | null = null;
let approvalSubmitterColumnPromise: Promise<boolean> | null = null;
let historyCompetitionColumnPromise: Promise<boolean> | null = null;
let compensationOverrideColumnPromise: Promise<boolean> | null = null;
let refereeDomicilioGeoColumnPromise: Promise<boolean> | null = null;

/**
 * Sonda de columna con caché a nivel de módulo. Solo se cachea un veredicto
 * fiable: "existe" (sin error) o "no existe" (42703 / undefined column). Un
 * error transitorio (red, timeout, caída de Supabase) NO debe cachearse como
 * "columna ausente" para toda la vida de la instancia — en ese caso se asume
 * el esquema moderno y se reintenta la sonda en la siguiente llamada.
 */
function probeColumns(
  table: string,
  columns: string,
  getCached: () => Promise<boolean> | null,
  setCached: (p: Promise<boolean> | null) => void,
): Promise<boolean> {
  const cached = getCached();
  if (cached) return cached;
  const probe = Promise.resolve(db().from(table).select(columns).limit(1)).then(({ error }) => {
    if (!error) return true;
    const isMissingColumn =
      error.code === "42703" || /column|columna/i.test(error.message ?? "");
    if (!isMissingColumn) {
      setCached(null); // transitorio: no cachear, reintentar la próxima vez
      return true;
    }
    return false;
  });
  setCached(probe);
  return probe;
}

export async function hasApprovalCompetitionColumns(): Promise<boolean> {
  return probeColumns(
    "approval_proposals",
    "competition_id, competition_name",
    () => approvalCompetitionColumnPromise,
    (p) => { approvalCompetitionColumnPromise = p; },
  );
}

/** ¿Existen las columnas submitted_by_id / reviewed_by_id? (migración 022) */
export async function hasApprovalSubmitterColumns(): Promise<boolean> {
  return probeColumns(
    "approval_proposals",
    "submitted_by_id, reviewed_by_id",
    () => approvalSubmitterColumnPromise,
    (p) => { approvalSubmitterColumnPromise = p; },
  );
}

export async function hasHistoryCompetitionColumn(): Promise<boolean> {
  return probeColumns(
    "roster_history",
    "competition_id",
    () => historyCompetitionColumnPromise,
    (p) => { historyCompetitionColumnPromise = p; },
  );
}

/** ¿Existe judge_compensation_claims.travel_amount_override? (migración 034) */
export async function hasCompensationOverrideColumn(): Promise<boolean> {
  return probeColumns(
    "judge_compensation_claims",
    "travel_amount_override",
    () => compensationOverrideColumnPromise,
    (p) => { compensationOverrideColumnPromise = p; },
  );
}

/** ¿Existen referees.domicilio_lat / domicilio_lng? (migración 034) */
export async function hasRefereeDomicilioGeoColumns(): Promise<boolean> {
  return probeColumns(
    "referees",
    "domicilio_lat, domicilio_lng",
    () => refereeDomicilioGeoColumnPromise,
    (p) => { refereeDomicilioGeoColumnPromise = p; },
  );
}

export { parseSlotKey } from "@/lib/roster-template";

export async function getCompetitionTemplate(competitionId: string): Promise<RosterSession[] | undefined> {
  const supabase = db();
  const { data, error } = await supabase
    .from("competitions")
    .select("template, tipo")
    .eq("id", competitionId)
    .single();
  // PGRST116 = cero filas con .single(): la competición no existe → undefined.
  // Cualquier otro error se propaga: antes se tragaba y syncCompetitionCoverage
  // recalculaba contra una plantilla vacía y escribía «0 confirmados / Borrador»
  // sobre una tarima completa.
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return undefined;
    throw new Error(`competitions.template: ${error.message}`);
  }
  if (!data) return undefined;
  return normalizeCompetitionTemplate(
    (data.template as RosterSession[] | null) ?? null,
    data.tipo as Competition["tipo"],
  );
}

export async function persistCompetitionTemplate(competitionId: string, template: RosterSession[]) {
  const supabase = db();
  const { error } = await supabase.from("competitions").update({ template }).eq("id", competitionId);
  // Si la escritura falla hay que PARAR: saveCompetitionTemplate seguía
  // adelante y podaba asignaciones vivas calculadas contra la plantilla nueva
  // aunque la BD conservase la antigua (pérdida de datos sin plantilla guardada).
  if (error) throw new Error(`competitions.template: ${error.message}`);
}

export async function getCalendarEvents(
  getCompetitions: () => Promise<Competition[]>,
): Promise<Record<string, CalendarDayEvent[]>> {
  const competitions = await getCompetitions();
  return calendarEventsFromCompetitions(competitions);
}

export async function getZones() {
  return getZonesCached();
}

export async function loadAssignments(competitionId: string): Promise<AssignmentsMap> {
  const { assignments } = await loadRosterAssignmentData(competitionId);
  return assignments;
}

/** Una sola consulta para asignaciones, flags y cross-zone de una tarima. */
export async function loadRosterAssignmentData(competitionId: string): Promise<{
  assignments: AssignmentsMap;
  flags: FlagsMap;
  crossZoneMap: import("@/lib/types").CrossZoneMap;
  crossZoneReasons: Record<string, string>;
}> {
  const supabase = db();
  const { data, error } = await supabase
    .from("roster_assignments")
    .select("slot_key, referee_id, flags, cross_zone, cross_zone_reason")
    .eq("competition_id", competitionId);
  // Mismo criterio que loadAllAssignments: un fallo de red devolvía un mapa
  // vacío que syncCompetitionCoverage persistía como «0 confirmados / Borrador».
  if (error) throw new Error(`roster_assignments: ${error.message}`);
  const rows = data ?? [];
  const crossZoneMap: import("@/lib/types").CrossZoneMap = {};
  const crossZoneReasons: Record<string, string> = {};
  for (const row of rows) {
    if (row.cross_zone) crossZoneMap[String(row.slot_key)] = true;
    if (row.cross_zone_reason) crossZoneReasons[String(row.slot_key)] = String(row.cross_zone_reason);
  }
  return {
    assignments: assignmentsFromRows(rows),
    flags: flagsFromRows(rows),
    crossZoneMap,
    crossZoneReasons,
  };
}

export function yearFromIso(date: string): number | null {
  const year = Number(String(date).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export async function loadFlags(competitionId: string): Promise<FlagsMap> {
  const { flags } = await loadRosterAssignmentData(competitionId);
  return flags;
}

export async function loadCrossZoneMap(
  competitionId: string,
): Promise<import("@/lib/types").CrossZoneMap> {
  const { crossZoneMap } = await loadRosterAssignmentData(competitionId);
  return crossZoneMap;
}

/**
 * Carga TODAS las asignaciones de roster y las agrupa por `competition_id` en
 * memoria. Evita el patrón N+1 de llamar a `loadAssignments(competitionId)` una
 * vez por competición.
 *
 * Va PAGINADA a propósito. PostgREST recorta toda respuesta a `max_rows` (1000
 * por defecto en Supabase) sin avisar de ninguna forma: no hay error, solo
 * faltan filas. Y aquí eso no se queda en un listado incompleto — como
 * `applyCoverageToCompetition` recalcula `confirmados` y `estado` a partir de
 * este mapa, los campeonatos que quedan fuera del corte se pintan como
 * «Crítico / 0 confirmados» aunque tengan la tarima llena, y el resumen de
 * compensación devuelve vacío para ellos. Con los presets reales (27-48 filas
 * por campeonato) el tope se alcanza hacia el campeonato 20-35.
 *
 * El orden es explícito porque sin ORDER BY las páginas pueden solaparse o
 * saltarse filas entre consultas.
 */
const ASSIGNMENTS_PAGE_SIZE = 1000;

export async function loadAllAssignments(): Promise<Map<string, AssignmentsMap>> {
  const supabase = db();
  const rows: { competition_id: unknown; slot_key: string; referee_id: string }[] = [];
  for (let from = 0; ; from += ASSIGNMENTS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("roster_assignments")
      .select("competition_id, slot_key, referee_id")
      .order("competition_id", { ascending: true })
      .order("slot_key", { ascending: true })
      .range(from, from + ASSIGNMENTS_PAGE_SIZE - 1);
    // Antes se descartaba el error: un fallo de red devolvía un mapa vacío que
    // la app interpretaba como «ningún juez asignado en toda la temporada».
    if (error) throw new Error(`roster_assignments: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < ASSIGNMENTS_PAGE_SIZE) break;
  }
  const grouped = new Map<string, { slot_key: string; referee_id: string }[]>();
  for (const row of rows) {
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

/** Dedup por petición SSR (layout + página comparten la misma carga). */
export const cachedLoadAllAssignments = cache(loadAllAssignments);

export async function syncCompetitionCoverage(competitionId: string) {
  const supabase = db();
  // Las tres lecturas son independientes: en paralelo ahorran dos round-trips
  // en la ruta de mutación más caliente (cada asignación de juez pasa por aquí).
  const [templateResult, assignments, { data: row }] = await Promise.all([
    getCompetitionTemplate(competitionId),
    loadAssignments(competitionId),
    supabase.from("competitions").select("requeridos").eq("id", competitionId).maybeSingle(),
  ]);
  const template = templateResult ?? [];
  const fallbackRequeridos = row?.requeridos != null ? Number(row.requeridos) : 0;
  const coverage = computeRosterCoverage(template, assignments, fallbackRequeridos);
  const estado = deriveCompetitionEstado(coverage);
  await supabase
    .from("competitions")
    .update({
      confirmados: coverage.confirmados,
      requeridos: coverage.requeridos,
      estado,
    })
    .eq("id", competitionId);
}

export async function pushActivity(item: Omit<import("@/lib/types").ActivityItem, never>) {
  const supabase = db();
  await supabase.from("activity_log").insert({
    tipo: item.tipo,
    actor: item.actor,
    accion: item.accion,
    evento: item.evento,
    hace: item.hace,
  });
}

export async function pushHistory(entry: Omit<RosterHistoryEntry, "id">) {
  const supabase = db();
  const competitionColumn = (await hasHistoryCompetitionColumn())
    ? "competition_id"
    : "event_id";
  // randomUUID en vez de Date.now(): dos mutaciones en el mismo milisegundo
  // colisionaban en PK y el insert fallaba en silencio (historial perdido).
  await supabase.from("roster_history").insert({
    id: `hist-${crypto.randomUUID()}`,
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
export async function applyHealthHistory(
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

export { mapActivity };

// PostgREST recorta toda respuesta a `max_rows` (1000) sin error ni señal, así
// que cualquier lectura que pueda superar esa cifra tiene que paginar con un
// ORDER BY estable. Además, un `.in(...)` con miles de ids revienta la longitud
// de la URL, de modo que la lista se trocea antes de consultar.
export const POSTGREST_PAGE_SIZE = 1000;
export const IN_FILTER_CHUNK = 300;

export function chunkList<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Lee todas las filas de `table` cuyo `column` esté en `ids`, paginando y
 * troceando el filtro. Propaga el error en vez de devolver filas de menos. */
export async function fetchAllRowsIn(
  table: string,
  column: string,
  ids: string[],
  orderColumn = "id",
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const supabase = db();
  const rows: Record<string, unknown>[] = [];
  for (const idsChunk of chunkList(ids, IN_FILTER_CHUNK)) {
    for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .in(column, idsChunk)
        .order(orderColumn, { ascending: true })
        .range(from, from + POSTGREST_PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const page = (data ?? []) as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < POSTGREST_PAGE_SIZE) break;
    }
  }
  return rows;
}
