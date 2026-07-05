import type {
  ActivityItem,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  PromotionRequest,
  Referee,
  RefereeArbitrajeStats,
  RefereeArbitrajeStatsByYear,
  RefereeExam,
  RefereeReport,
  RegulationRule,
  RosterHistoryEntry,
} from "@/lib/types";
import { isClaimTravelResolved } from "@/lib/judge-compensation/readiness";

function mapArbitrajeStats(raw: unknown): RefereeArbitrajeStats | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    aep1: (o.aep1 as Record<string, number>) ?? {},
    aep2: (o.aep2 as Record<string, number>) ?? {},
    aep3: (o.aep3 as Record<string, number>) ?? {},
    ipf: Number(o.ipf ?? 0),
    total: Number(o.total ?? 0),
  };
}

function mapArbitrajeStatsByYear(
  raw: unknown,
): RefereeArbitrajeStatsByYear | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: RefereeArbitrajeStatsByYear = {};
  for (const [year, stats] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year)) continue;
    const mapped = mapArbitrajeStats(stats);
    if (mapped) out[year] = mapped;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Convierte ficha de juez (app) → columnas Postgres. */
export function refereeToDbRow(
  patch: Partial<Referee> & { id?: string; iniciales?: string },
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.id != null) row.id = patch.id;
  if (patch.nombre != null) row.nombre = patch.nombre;
  if (patch.zona != null) row.zona = patch.zona;
  if (patch.nivel != null) row.nivel = patch.nivel;
  if (patch.estado != null) row.estado = patch.estado;
  if (patch.eventos != null) row.eventos = patch.eventos;
  if (patch.ultimo != null) row.ultimo = patch.ultimo;
  if (patch.disp != null) row.disp = patch.disp;
  if (patch.iniciales != null) row.iniciales = patch.iniciales;
  if (patch.userId !== undefined) row.user_id = patch.userId ?? null;
  if (patch.email !== undefined) row.email = patch.email ?? null;
  if (patch.licencia !== undefined) row.licencia = patch.licencia ?? null;
  if (patch.localidad !== undefined) row.localidad = patch.localidad ?? null;
  if (patch.domicilio !== undefined) {
    const trimmed = typeof patch.domicilio === "string" ? patch.domicilio.trim() : "";
    row.domicilio = trimmed || null;
    if (!trimmed) {
      row.domicilio_lat = null;
      row.domicilio_lng = null;
    }
  }
  if (patch.domicilioLat !== undefined) row.domicilio_lat = patch.domicilioLat ?? null;
  if (patch.domicilioLng !== undefined) row.domicilio_lng = patch.domicilioLng ?? null;
  if (patch.telefono !== undefined) row.telefono = patch.telefono ?? null;
  if (patch.genero !== undefined) row.genero = patch.genero ?? null;
  if (patch.antiguedad !== undefined) row.antiguedad = patch.antiguedad ?? null;
  if (patch.excelId !== undefined) row.excel_id = patch.excelId ?? null;
  if (patch.notas !== undefined) row.notas = patch.notas ?? null;
  if (patch.ultimoFecha !== undefined) row.ultimo_fecha = patch.ultimoFecha ?? null;
  if (patch.excelMacroZone !== undefined) row.excel_macro_zone = patch.excelMacroZone ?? null;
  if (patch.arbitrajeStats !== undefined) {
    row.arbitraje_stats = patch.arbitrajeStats ?? null;
  }
  if (patch.arbitrajeStatsByYear !== undefined) {
    row.arbitraje_stats_by_year = patch.arbitrajeStatsByYear ?? null;
  }
  return row;
}

export function mapReferee(row: Record<string, unknown>): Referee {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    zona: String(row.zona),
    nivel: String(row.nivel) as Referee["nivel"],
    estado: row.estado as Referee["estado"],
    eventos: Number(row.eventos),
    ultimo: String(row.ultimo),
    disp: Boolean(row.disp),
    iniciales: String(row.iniciales),
    userId: row.user_id ? String(row.user_id) : undefined,
    email: row.email ? String(row.email) : undefined,
    licencia: row.licencia ? String(row.licencia) : undefined,
    localidad: row.localidad ? String(row.localidad) : undefined,
    domicilio: row.domicilio ? String(row.domicilio) : undefined,
    domicilioLat: row.domicilio_lat != null ? Number(row.domicilio_lat) : undefined,
    domicilioLng: row.domicilio_lng != null ? Number(row.domicilio_lng) : undefined,
    telefono: row.telefono ? String(row.telefono) : undefined,
    genero: row.genero ? String(row.genero) : undefined,
    antiguedad: row.antiguedad ? String(row.antiguedad).slice(0, 10) : undefined,
    excelId: row.excel_id != null ? Number(row.excel_id) : undefined,
    notas: row.notas ? String(row.notas) : undefined,
    ultimoFecha: row.ultimo_fecha
      ? String(row.ultimo_fecha).slice(0, 10)
      : undefined,
    excelMacroZone: row.excel_macro_zone
      ? String(row.excel_macro_zone)
      : undefined,
    arbitrajeStats: mapArbitrajeStats(row.arbitraje_stats),
    arbitrajeStatsByYear: mapArbitrajeStatsByYear(row.arbitraje_stats_by_year),
  };
}

export function mapCompetition(row: Record<string, unknown>): Competition {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    tipo: row.tipo as Competition["tipo"],
    fecha: String(row.fecha),
    fechaFin: String(row.fecha_fin),
    sede: String(row.sede),
    sesiones: Number(row.sesiones),
    requeridos: Number(row.requeridos),
    confirmados: Number(row.confirmados),
    estado: row.estado as Competition["estado"],
    aprobacion: String(row.aprobacion),
    zona: row.zona ? String(row.zona) : undefined,
    sedeDireccion: row.sede_direccion ? String(row.sede_direccion) : undefined,
    sedeLat: row.sede_lat != null ? Number(row.sede_lat) : undefined,
    sedeLng: row.sede_lng != null ? Number(row.sede_lng) : undefined,
    ambito: row.ambito ? (String(row.ambito) as Competition["ambito"]) : undefined,
    compensationOrganizer: row.compensation_organizer
      ? (String(row.compensation_organizer) as Competition["compensationOrganizer"])
      : undefined,
    compensationClubName: row.compensation_club_name
      ? String(row.compensation_club_name)
      : undefined,
    compensationClubEmail: row.compensation_club_email
      ? String(row.compensation_club_email)
      : undefined,
    compensationVolunteer: row.compensation_volunteer != null
      ? Boolean(row.compensation_volunteer)
      : undefined,
    compensationClubs: parseCompensationClubs(row.compensation_clubs),
  };
}

function parseCompensationClubs(raw: unknown): import("@/lib/judge-compensation/types").CompensationClubContact[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const clubs = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      const emails = Array.isArray(rec.emails)
        ? rec.emails.map((e) => String(e).trim()).filter((e) => e.includes("@"))
        : [];
      if (!name) return null;
      return { name, emails };
    })
    .filter(Boolean) as import("@/lib/judge-compensation/types").CompensationClubContact[];
  return clubs.length > 0 ? clubs : undefined;
}

export function mapApproval(row: Record<string, unknown>): ApprovalProposal {
  return {
    id: String(row.id),
    competitionId: String(row.competition_id ?? row.event_id),
    competitionName: String(row.competition_name ?? row.event_name),
    zona: String(row.zona),
    submittedBy: String(row.submitted_by),
    submittedById: row.submitted_by_id ? String(row.submitted_by_id) : undefined,
    submittedAt: String(row.submitted_at),
    status: row.status as ApprovalProposal["status"],
    assignments: (row.assignments ?? {}) as AssignmentsMap,
    comment: row.comment ? String(row.comment) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedById: row.reviewed_by_id ? String(row.reviewed_by_id) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
  };
}

export function mapPromotion(row: Record<string, unknown>): PromotionRequest {
  return {
    id: String(row.id),
    refereeId: String(row.referee_id),
    refereeName: String(row.referee_name),
    fromLevel: String(row.from_level) as PromotionRequest["fromLevel"],
    toLevel: String(row.to_level) as PromotionRequest["toLevel"],
    zona: String(row.zona),
    status: row.status as PromotionRequest["status"],
    submittedAt: String(row.submitted_at),
    eventosCompletados: Number(row.eventos_completados),
    motivo: row.motivo ? String(row.motivo) : undefined,
    reviewComment: row.review_comment ? String(row.review_comment) : undefined,
  };
}

export function mapActivity(row: Record<string, unknown>): ActivityItem {
  const createdAt = row.created_at as string | undefined;
  let hace: string;
  if (createdAt) {
    const diffMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diffMin < 1) hace = "ahora";
    else if (diffMin < 60) hace = `hace ${diffMin}min`;
    else if (diffMin < 1440) hace = `hace ${Math.floor(diffMin / 60)}h`;
    else hace = `hace ${Math.floor(diffMin / 1440)}d`;
  } else {
    hace = String(row.hace ?? "—");
  }
  return {
    tipo: row.tipo as ActivityItem["tipo"],
    actor: String(row.actor),
    accion: String(row.accion),
    evento: String(row.evento),
    hace,
  };
}

export function mapHistory(row: Record<string, unknown>): RosterHistoryEntry {
  return {
    id: String(row.id),
    competitionId: String(row.competition_id ?? row.event_id),
    at: String(row.at),
    actor: String(row.actor),
    action: String(row.action),
    detail: row.detail ? String(row.detail) : undefined,
  };
}

export function mapRegulation(row: Record<string, unknown>): RegulationRule {
  return {
    id: String(row.id),
    rol: String(row.rol),
    roleKey: row.role_key as RegulationRule["roleKey"],
    minLevel: String(row.min_level) as RegulationRule["minLevel"],
    eventTypes: (row.event_types as string[]) as RegulationRule["eventTypes"],
    note: String(row.note ?? ""),
  };
}

export function mapExam(row: Record<string, unknown>): RefereeExam {
  return {
    id: String(row.id),
    refereeId: String(row.referee_id),
    refereeName: String(row.referee_name),
    tipo: row.tipo as RefereeExam["tipo"],
    nivelObjetivo: String(row.nivel_objetivo) as RefereeExam["nivelObjetivo"],
    fecha: String(row.fecha),
    examinador: String(row.examinador),
    puntuacion: row.puntuacion != null ? Number(row.puntuacion) : undefined,
    puntuacionMaxima: Number(row.puntuacion_maxima ?? 100),
    resultado: row.resultado as RefereeExam["resultado"],
    notas: row.notas ? String(row.notas) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function mapReport(row: Record<string, unknown>): RefereeReport {
  return {
    id: String(row.id),
    subjectType: (row.subject_type as RefereeReport["subjectType"]) ?? "juez",
    zona: row.zona ? String(row.zona) : undefined,
    refereeId: row.referee_id ? String(row.referee_id) : undefined,
    refereeName: row.referee_name ? String(row.referee_name) : undefined,
    competitionId: row.competition_id ? String(row.competition_id) : undefined,
    competitionName: row.competition_name ? String(row.competition_name) : undefined,
    titulo: String(row.titulo),
    tipo: row.tipo as RefereeReport["tipo"],
    evento: row.evento ? String(row.evento) : undefined,
    contenido: String(row.contenido),
    adjuntoUrl: row.adjunto_url ? String(row.adjunto_url) : undefined,
    autor: String(row.autor),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function assignmentsFromRows(
  rows: { slot_key: string; referee_id: string }[],
): AssignmentsMap {
  const map: AssignmentsMap = {};
  for (const row of rows) map[row.slot_key] = row.referee_id;
  return map;
}

export function flagsFromRows(
  rows: { slot_key: string; flags: Record<string, unknown> | null }[],
): import("@/lib/types").FlagsMap {
  const map: import("@/lib/types").FlagsMap = {};
  for (const row of rows) {
    const f = row.flags;
    if (f && typeof f === "object" && (f.compartido || f.intercambio)) {
      map[row.slot_key] = {
        compartido: Boolean(f.compartido),
        intercambio: Boolean(f.intercambio),
      };
    }
  }
  return map;
}

export function mapCompensationDutyLine(
  row: Record<string, unknown>,
): import("@/lib/judge-compensation/types").CompensationDutyLine {
  return {
    dutyType: row.duty_type as import("@/lib/judge-compensation/types").CompensationDutyType,
    session: String(row.session_label),
    roleKey: row.role_key ? (String(row.role_key) as import("@/lib/types").RoleKey) : undefined,
    roleLabel: row.role_label ? String(row.role_label) : undefined,
    unitAmount: Number(row.unit_amount ?? 0),
    quantity: Number(row.quantity ?? 1),
    amount: Number(row.amount ?? 0),
    slotKeys: Array.isArray(row.slot_keys) ? (row.slot_keys as string[]) : [],
  };
}

export function mapCompensationClaimRow(
  row: Record<string, unknown>,
  dutyLines: import("@/lib/judge-compensation/types").CompensationDutyLine[] = [],
  competition?: import("@/lib/types").Competition,
): import("@/lib/judge-compensation/types").CompensationClaim {
  const base = {
    id: String(row.id),
    competitionId: String(row.competition_id),
    refereeId: String(row.referee_id),
    refereeName: String(row.referee_name),
    tipo: (competition?.tipo ?? "AEP-3") as import("@/lib/types").EventType,
    ambito: (competition?.ambito === "epf" || competition?.ambito === "ipf"
      ? competition.ambito
      : "nacional") as import("@/lib/judge-compensation/types").CompetitionAmbito,
    fecha: competition?.fecha ?? "",
    fechaFin: competition?.fechaFin ?? "",
    dutyLines,
    // Normaliza modos retirados/desconocidos (p. ej. `fuel_receipt` heredado) a
    // `km_rate` para que el cálculo parta de un modo soportado.
    travelMode: ((): import("@/lib/judge-compensation/types").CompensationTravelMode => {
      const m = row.travel_mode;
      return m === "shared_vehicle_passenger" || m === "none" ? m : "km_rate";
    })(),
    distanceKmOneWay: row.distance_km_one_way != null ? Number(row.distance_km_one_way) : undefined,
    distanceKmRoundTrip:
      row.distance_km_round_trip != null ? Number(row.distance_km_round_trip) : undefined,
    distanceSource: row.distance_source as "osm" | "google_maps" | "manual" | undefined,
    travelApproved: Boolean(row.travel_approved),
    travelNotes: row.travel_notes ? String(row.travel_notes) : undefined,
    isCompetitionManager: Boolean(row.is_competition_manager),
    competitionManagerPerDay: Boolean(row.competition_manager_per_day),
    isComputerSetup: Boolean(row.is_computer_setup),
    lodgingDaysOverride:
      row.lodging_days_override != null ? Number(row.lodging_days_override) : undefined,
    lodgingEligibleOverride:
      row.lodging_eligible_override != null ? Boolean(row.lodging_eligible_override) : undefined,
    status: row.status as import("@/lib/judge-compensation/types").CompensationClaimStatus,
    reviewComment: row.review_comment ? String(row.review_comment) : undefined,
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
  };
  const totals = {
    dutiesAmount: Number(row.duties_amount ?? 0),
    travelAmount: Number(row.travel_amount ?? 0),
    lodgingAmount: Number(row.lodging_amount ?? 0),
    competitionManagerAmount: Number(row.competition_manager_amount ?? 0),
    computerSetupAmount: Number(row.computer_setup_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    pesajeCount: Number(row.pesaje_count ?? 0),
    functionCount: Number(row.session_count ?? 0) + Number(row.pesaje_count ?? 0),
    championshipDays: 1,
    lodgingEligible: Boolean(row.lodging_eligible),
    lodgingDays: Number(row.lodging_days ?? 0),
    financialComplete: isClaimTravelResolved({
      travelMode: base.travelMode,
      distanceKmRoundTrip: base.distanceKmRoundTrip,
      distanceKmOneWay: base.distanceKmOneWay,
    }),
  };
  return { ...base, ...totals };
}

export function competitionPatchToDb(
  patch: Partial<import("@/lib/types").Competition>,
): Record<string, unknown> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.nombre != null) dbPatch.nombre = patch.nombre;
  if (patch.tipo != null) dbPatch.tipo = patch.tipo;
  if (patch.fecha != null) dbPatch.fecha = patch.fecha;
  if (patch.fechaFin != null) dbPatch.fecha_fin = patch.fechaFin;
  if (patch.sede != null) dbPatch.sede = patch.sede;
  if (patch.zona != null) dbPatch.zona = patch.zona;
  if (patch.sesiones != null) dbPatch.sesiones = patch.sesiones;
  if (patch.requeridos != null) dbPatch.requeridos = patch.requeridos;
  if (patch.sedeDireccion !== undefined) dbPatch.sede_direccion = patch.sedeDireccion ?? null;
  if (patch.sedeLat !== undefined) dbPatch.sede_lat = patch.sedeLat ?? null;
  if (patch.sedeLng !== undefined) dbPatch.sede_lng = patch.sedeLng ?? null;
  if (patch.ambito !== undefined) dbPatch.ambito = patch.ambito ?? null;
  if (patch.compensationOrganizer !== undefined) {
    dbPatch.compensation_organizer = patch.compensationOrganizer ?? null;
  }
  if (patch.compensationClubName !== undefined) {
    dbPatch.compensation_club_name = patch.compensationClubName ?? null;
  }
  if (patch.compensationClubEmail !== undefined) {
    dbPatch.compensation_club_email = patch.compensationClubEmail ?? null;
  }
  if (patch.compensationVolunteer !== undefined) {
    dbPatch.compensation_volunteer = patch.compensationVolunteer;
  }
  if (patch.compensationClubs !== undefined) {
    dbPatch.compensation_clubs = patch.compensationClubs ?? [];
    const primary = patch.compensationClubs?.[0];
    if (primary) {
      dbPatch.compensation_club_name = primary.name;
      dbPatch.compensation_club_email = primary.emails[0] ?? null;
    }
  }
  return dbPatch;
}

export function claimToDbRow(
  claim: import("@/lib/judge-compensation/types").CompensationClaim,
): Record<string, unknown> {
  return {
    id: claim.id,
    competition_id: claim.competitionId,
    referee_id: claim.refereeId,
    referee_name: claim.refereeName,
    status: claim.status,
    travel_mode: claim.travelMode,
    distance_km_one_way: claim.distanceKmOneWay ?? null,
    distance_km_round_trip: claim.distanceKmRoundTrip ?? null,
    distance_source: claim.distanceSource ?? null,
    travel_amount: claim.travelAmount,
    travel_approved: claim.travelApproved,
    travel_notes: claim.travelNotes ?? null,
    is_competition_manager: claim.isCompetitionManager,
    competition_manager_per_day: claim.competitionManagerPerDay,
    is_computer_setup: claim.isComputerSetup,
    computer_setup_amount: claim.computerSetupAmount,
    lodging_days: claim.lodgingDays,
    lodging_eligible: claim.lodgingEligible,
    lodging_eligible_override: claim.lodgingEligibleOverride ?? null,
    lodging_days_override: claim.lodgingDaysOverride ?? null,
    duties_amount: claim.dutiesAmount,
    lodging_amount: claim.lodgingAmount,
    competition_manager_amount: claim.competitionManagerAmount,
    total_amount: claim.totalAmount,
    session_count: claim.sessionCount,
    pesaje_count: claim.pesajeCount,
    submitted_at: claim.submittedAt ?? null,
    reviewed_at: claim.reviewedAt ?? null,
    reviewed_by: claim.reviewedBy ?? null,
    review_comment: claim.reviewComment ?? null,
    updated_at: new Date().toISOString(),
  };
}
