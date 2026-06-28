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

export async function hasApprovalCompetitionColumns(): Promise<boolean> {
  approvalCompetitionColumnPromise ??= Promise.resolve(
    db()
      .from("approval_proposals")
      .select("competition_id, competition_name")
      .limit(1),
  ).then(({ error }) => !error);
  return approvalCompetitionColumnPromise;
}

/** ¿Existen las columnas submitted_by_id / reviewed_by_id? (migración 022) */
export async function hasApprovalSubmitterColumns(): Promise<boolean> {
  approvalSubmitterColumnPromise ??= Promise.resolve(
    db()
      .from("approval_proposals")
      .select("submitted_by_id, reviewed_by_id")
      .limit(1),
  ).then(({ error }) => !error);
  return approvalSubmitterColumnPromise;
}

export async function hasHistoryCompetitionColumn(): Promise<boolean> {
  historyCompetitionColumnPromise ??= Promise.resolve(
    db()
      .from("roster_history")
      .select("competition_id")
      .limit(1),
  ).then(({ error }) => !error);
  return historyCompetitionColumnPromise;
}

export { parseSlotKey } from "@/lib/roster-template";

export async function getCompetitionTemplate(competitionId: string): Promise<RosterSession[] | undefined> {
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

export async function persistCompetitionTemplate(competitionId: string, template: RosterSession[]) {
  const supabase = db();
  await supabase.from("competitions").update({ template }).eq("id", competitionId);
}

export async function getCalendarEvents(
  getCompetitions: () => Promise<Competition[]>,
): Promise<Record<string, CalendarDayEvent>> {
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
}> {
  const supabase = db();
  const { data } = await supabase
    .from("roster_assignments")
    .select("slot_key, referee_id, flags, cross_zone")
    .eq("competition_id", competitionId);
  const rows = data ?? [];
  const crossZoneMap: import("@/lib/types").CrossZoneMap = {};
  for (const row of rows) {
    if (row.cross_zone) crossZoneMap[String(row.slot_key)] = true;
  }
  return {
    assignments: assignmentsFromRows(rows),
    flags: flagsFromRows(rows),
    crossZoneMap,
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
 * Carga TODAS las asignaciones de roster en una sola consulta y las agrupa por
 * `competition_id` en memoria. Evita el patrón N+1 de llamar a
 * `loadAssignments(competitionId)` una vez por competición.
 */
export async function loadAllAssignments(): Promise<Map<string, AssignmentsMap>> {
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

/** Dedup por petición SSR (layout + página comparten la misma carga). */
export const cachedLoadAllAssignments = cache(loadAllAssignments);

export async function syncCompetitionCoverage(competitionId: string) {
  const supabase = db();
  const template = (await getCompetitionTemplate(competitionId)) ?? [];
  const assignments = await loadAssignments(competitionId);
  const { data: row } = await supabase
    .from("competitions")
    .select("requeridos")
    .eq("id", competitionId)
    .maybeSingle();
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
