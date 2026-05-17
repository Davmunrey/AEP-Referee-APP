import type {
  ActivityItem,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  PromotionRequest,
  Referee,
  RefereeArbitrajeStats,
  RefereeExam,
  RefereeReport,
  RegulationRule,
  RosterHistoryEntry,
} from "@/lib/types";

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
  if (patch.email !== undefined) row.email = patch.email ?? null;
  if (patch.licencia !== undefined) row.licencia = patch.licencia ?? null;
  if (patch.localidad !== undefined) row.localidad = patch.localidad ?? null;
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
    email: row.email ? String(row.email) : undefined,
    licencia: row.licencia ? String(row.licencia) : undefined,
    localidad: row.localidad ? String(row.localidad) : undefined,
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
  };
}

export function mapApproval(row: Record<string, unknown>): ApprovalProposal {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    zona: String(row.zona),
    submittedBy: String(row.submitted_by),
    submittedAt: String(row.submitted_at),
    status: row.status as ApprovalProposal["status"],
    assignments: (row.assignments ?? {}) as AssignmentsMap,
    comment: row.comment ? String(row.comment) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
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
    eventId: String(row.event_id),
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
    refereeId: String(row.referee_id),
    refereeName: String(row.referee_name),
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
