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
import { championshipDayCount } from "@/lib/judge-compensation/rates";

/**
 * Texto de una columna que el tipo declara obligatoria.
 *
 * `String(null)` produce el literal «null», y eso acaba impreso como si fuera
 * un dato: un juez llamado «null» en el cuadrante, un campeonato con sede
 * «null». Un hueco se enseña como hueco.
 */
function texto(raw: unknown, fallback = ""): string {
  if (raw == null) return fallback;
  const value = String(raw);
  return value === "null" || value === "undefined" ? fallback : value;
}

/**
 * Número de una columna que el tipo declara obligatoria.
 *
 * `Number(raw ?? 0)` solo cubre el nulo: una cadena no numérica —«120,50» con
 * coma decimal, un campo editado a mano, un resto de una versión anterior—
 * devuelve NaN, y NaN no se queda quieto. Contamina toda suma en la que entre
 * (los totales del hub, la analítica) y, lo que es peor, se cuela por los
 * guardas: `NaN <= 0` es `false`, así que un importe ilegible pasaba por
 * «importe positivo» y salía impreso en un recibo como «NaN€».
 */
function numero(raw: unknown, fallback = 0): number {
  const value = aNumeroFinito(raw);
  return value ?? fallback;
}

/** Como `numero`, pero para campos opcionales: un valor ilegible es ausencia. */
function numeroOpcional(raw: unknown): number | undefined {
  return aNumeroFinito(raw);
}

/**
 * `undefined` si el valor no es un número utilizable.
 *
 * La cadena vacía cuenta como ausencia, no como cero: `Number("")` es 0, y en
 * los km eso no es lo mismo —cero km es «sin desplazamiento facturable», un
 * dato resuelto que da la liquidación por completa.
 */
function aNumeroFinito(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

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
    id: texto(row.id),
    nombre: texto(row.nombre),
    zona: texto(row.zona),
    nivel: texto(row.nivel) as Referee["nivel"],
    estado: row.estado as Referee["estado"],
    eventos: numero(row.eventos),
    ultimo: texto(row.ultimo, "—"),
    disp: Boolean(row.disp),
    iniciales: texto(row.iniciales),
    userId: row.user_id ? String(row.user_id) : undefined,
    email: row.email ? String(row.email) : undefined,
    licencia: row.licencia ? String(row.licencia) : undefined,
    localidad: row.localidad ? String(row.localidad) : undefined,
    domicilio: row.domicilio ? String(row.domicilio) : undefined,
    // Unas coordenadas ilegibles son ausencia de coordenadas: con NaN, el
    // domicilio parecía geocodificado y la ruta a la sede salía sin sentido.
    domicilioLat: numeroOpcional(row.domicilio_lat),
    domicilioLng: numeroOpcional(row.domicilio_lng),
    telefono: row.telefono ? String(row.telefono) : undefined,
    genero: row.genero ? String(row.genero) : undefined,
    antiguedad: row.antiguedad ? String(row.antiguedad).slice(0, 10) : undefined,
    excelId: numeroOpcional(row.excel_id),
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
    id: texto(row.id),
    nombre: texto(row.nombre),
    tipo: row.tipo as Competition["tipo"],
    fecha: texto(row.fecha),
    // Guardas de nulos: String(null) produciría el literal "null". El tipo
    // declara ambos campos como string obligatorio, así que se usa el valor
    // neutro del dominio: sin fecha_fin ⇒ campeonato de un día (fecha) y sin
    // aprobacion ⇒ "Sin propuesta" (el valor por defecto en la creación).
    fechaFin: row.fecha_fin != null ? texto(row.fecha_fin) : texto(row.fecha),
    sede: texto(row.sede),
    sesiones: numero(row.sesiones),
    requeridos: numero(row.requeridos),
    confirmados: numero(row.confirmados),
    estado: row.estado as Competition["estado"],
    aprobacion: row.aprobacion != null ? String(row.aprobacion) : "Sin propuesta",
    zona: row.zona ? String(row.zona) : undefined,
    sedeDireccion: row.sede_direccion ? String(row.sede_direccion) : undefined,
    sedeLat: numeroOpcional(row.sede_lat),
    sedeLng: numeroOpcional(row.sede_lng),
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

/** `assignments` es JSONB: solo un objeto plano es utilizable como mapa. */
export function assignmentsFromJsonb(raw: unknown): AssignmentsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AssignmentsMap = {};
  for (const [slotKey, refereeId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof refereeId === "string" && refereeId) out[slotKey] = refereeId;
  }
  return out;
}

export function mapApproval(row: Record<string, unknown>): ApprovalProposal {
  return {
    id: texto(row.id),
    competitionId: texto(row.competition_id ?? row.event_id),
    competitionName: texto(row.competition_name ?? row.event_name),
    zona: texto(row.zona),
    submittedBy: texto(row.submitted_by),
    submittedById: row.submitted_by_id ? String(row.submitted_by_id) : undefined,
    submittedAt: texto(row.submitted_at),
    status: row.status as ApprovalProposal["status"],
    // El JSONB solo se guardaba contra el nulo. Una cadena o un array pasaban
    // tal cual, y `Object.entries` sobre ellos daba pares basura: el panel de
    // aprobaciones pintaba filas inventadas y la revisión intentaba insertar
    // asignaciones con claves numéricas.
    assignments: assignmentsFromJsonb(row.assignments),
    comment: row.comment ? String(row.comment) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedById: row.reviewed_by_id ? String(row.reviewed_by_id) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
  };
}

export function mapPromotion(row: Record<string, unknown>): PromotionRequest {
  return {
    id: texto(row.id),
    refereeId: texto(row.referee_id),
    refereeName: texto(row.referee_name),
    fromLevel: texto(row.from_level) as PromotionRequest["fromLevel"],
    toLevel: texto(row.to_level) as PromotionRequest["toLevel"],
    zona: texto(row.zona),
    status: row.status as PromotionRequest["status"],
    submittedAt: texto(row.submitted_at),
    eventosCompletados: numero(row.eventos_completados),
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
    actor: texto(row.actor),
    accion: texto(row.accion),
    evento: texto(row.evento),
    hace,
  };
}

export function mapHistory(row: Record<string, unknown>): RosterHistoryEntry {
  return {
    id: texto(row.id),
    competitionId: texto(row.competition_id ?? row.event_id),
    at: texto(row.at),
    actor: texto(row.actor),
    action: texto(row.action),
    detail: row.detail ? String(row.detail) : undefined,
  };
}

export function mapRegulation(row: Record<string, unknown>): RegulationRule {
  return {
    id: texto(row.id),
    rol: texto(row.rol),
    roleKey: row.role_key as RegulationRule["roleKey"],
    minLevel: texto(row.min_level) as RegulationRule["minLevel"],
    eventTypes: (row.event_types as string[]) as RegulationRule["eventTypes"],
    note: String(row.note ?? ""),
  };
}

export function mapExam(row: Record<string, unknown>): RefereeExam {
  return {
    id: texto(row.id),
    refereeId: texto(row.referee_id),
    refereeName: texto(row.referee_name),
    tipo: row.tipo as RefereeExam["tipo"],
    nivelObjetivo: texto(row.nivel_objetivo) as RefereeExam["nivelObjetivo"],
    fecha: texto(row.fecha),
    examinador: texto(row.examinador),
    puntuacion: numeroOpcional(row.puntuacion),
    puntuacionMaxima: numero(row.puntuacion_maxima, 100),
    resultado: row.resultado as RefereeExam["resultado"],
    notas: row.notas ? String(row.notas) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function mapReport(row: Record<string, unknown>): RefereeReport {
  return {
    id: texto(row.id),
    subjectType: (row.subject_type as RefereeReport["subjectType"]) ?? "juez",
    zona: row.zona ? String(row.zona) : undefined,
    refereeId: row.referee_id ? String(row.referee_id) : undefined,
    refereeName: row.referee_name ? String(row.referee_name) : undefined,
    competitionId: row.competition_id ? String(row.competition_id) : undefined,
    competitionName: row.competition_name ? String(row.competition_name) : undefined,
    titulo: texto(row.titulo),
    tipo: row.tipo as RefereeReport["tipo"],
    evento: row.evento ? String(row.evento) : undefined,
    contenido: texto(row.contenido),
    adjuntoUrl: row.adjunto_url ? String(row.adjunto_url) : undefined,
    autor: texto(row.autor),
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
    session: texto(row.session_label),
    roleKey: row.role_key ? (String(row.role_key) as import("@/lib/types").RoleKey) : undefined,
    roleLabel: row.role_label ? String(row.role_label) : undefined,
    unitAmount: numero(row.unit_amount),
    quantity: numero(row.quantity, 1),
    amount: numero(row.amount),
    slotKeys: Array.isArray(row.slot_keys) ? (row.slot_keys as string[]) : [],
  };
}

export function mapCompensationClaimRow(
  row: Record<string, unknown>,
  dutyLines: import("@/lib/judge-compensation/types").CompensationDutyLine[] = [],
  competition?: import("@/lib/types").Competition,
): import("@/lib/judge-compensation/types").CompensationClaim {
  const base = {
    id: texto(row.id),
    competitionId: texto(row.competition_id),
    refereeId: texto(row.referee_id),
    refereeName: texto(row.referee_name),
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
    // Unos km ilegibles son km sin resolver, no «cero km»: con NaN, la
    // liquidación se daba por completa y el importe de viaje se contaminaba.
    distanceKmOneWay: numeroOpcional(row.distance_km_one_way),
    distanceKmRoundTrip: numeroOpcional(row.distance_km_round_trip),
    distanceSource: row.distance_source as "osm" | "google_maps" | "manual" | undefined,
    travelAmountOverride: numeroOpcional(row.travel_amount_override),
    travelApproved: Boolean(row.travel_approved),
    travelNotes: row.travel_notes ? String(row.travel_notes) : undefined,
    isCompetitionManager: Boolean(row.is_competition_manager),
    competitionManagerPerDay: Boolean(row.competition_manager_per_day),
    isComputerSetup: Boolean(row.is_computer_setup),
    lodgingDaysOverride: numeroOpcional(row.lodging_days_override),
    lodgingEligibleOverride:
      row.lodging_eligible_override != null ? Boolean(row.lodging_eligible_override) : undefined,
    status: row.status as import("@/lib/judge-compensation/types").CompensationClaimStatus,
    reviewComment: row.review_comment ? String(row.review_comment) : undefined,
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
  };
  const totals = {
    dutiesAmount: numero(row.duties_amount),
    travelAmount: numero(row.travel_amount),
    lodgingAmount: numero(row.lodging_amount),
    competitionManagerAmount: numero(row.competition_manager_amount),
    computerSetupAmount: numero(row.computer_setup_amount),
    totalAmount: numero(row.total_amount),
    sessionCount: numero(row.session_count),
    pesajeCount: numero(row.pesaje_count),
    functionCount: numero(row.session_count) + numero(row.pesaje_count),
    // Recalculado desde las fechas del campeonato: el "1" fijo anterior
    // etiquetaba mal los claims multi-día recién cargados de BD.
    championshipDays: competition
      ? championshipDayCount(competition.fecha, competition.fechaFin)
      : 1,
    lodgingEligible: Boolean(row.lodging_eligible),
    lodgingDays: numero(row.lodging_days),
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
