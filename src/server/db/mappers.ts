import type {
  ActivityItem,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  PromotionRequest,
  Referee,
  RegulationRule,
  RosterHistoryEntry,
} from "@/lib/types";

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

export function assignmentsFromRows(
  rows: { slot_key: string; referee_id: string }[],
): AssignmentsMap {
  const map: AssignmentsMap = {};
  for (const row of rows) map[row.slot_key] = row.referee_id;
  return map;
}
