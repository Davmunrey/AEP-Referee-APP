import type { RefereeSanction, SanctionDelegateNotify, SanctionStatus } from "@/lib/types";

function mapDelegateNotify(raw: unknown): SanctionDelegateNotify {
  if (!raw || typeof raw !== "object") {
    return { delegates: [], mailtoUrl: "" };
  }
  const o = raw as Record<string, unknown>;
  const delegates = Array.isArray(o.delegates)
    ? o.delegates
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
        .map((d) => ({
          id: String(d.id ?? ""),
          nombre: String(d.nombre ?? ""),
          email: String(d.email ?? ""),
        }))
        .filter((d) => d.email)
    : [];
  return {
    delegates,
    mailtoUrl: typeof o.mailtoUrl === "string" ? o.mailtoUrl : "",
    notifiedAt: typeof o.notifiedAt === "string" ? o.notifiedAt : undefined,
  };
}

export function mapSanction(row: Record<string, unknown>): RefereeSanction {
  return {
    id: String(row.id),
    refereeId: String(row.referee_id),
    refereeName: String(row.referee_name),
    zona: String(row.zona),
    motivo: String(row.motivo),
    fechaInicio: String(row.fecha_inicio).slice(0, 10),
    fechaFin: String(row.fecha_fin).slice(0, 10),
    status: String(row.status) as SanctionStatus,
    impuestaPorId: row.impuesta_por_id ? String(row.impuesta_por_id) : undefined,
    impuestaPorNombre: String(row.impuesta_por_nombre),
    revocadaPorNombre: row.revocada_por_nombre
      ? String(row.revocada_por_nombre)
      : undefined,
    revocadaAt: row.revocada_at ? String(row.revocada_at) : undefined,
    notas: row.notas ? String(row.notas) : undefined,
    delegateNotify: mapDelegateNotify(row.delegate_notify),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function sanctionToDbRow(
  input: Partial<RefereeSanction> & { delegateNotify?: SanctionDelegateNotify },
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.refereeId !== undefined) row.referee_id = input.refereeId;
  if (input.refereeName !== undefined) row.referee_name = input.refereeName;
  if (input.zona !== undefined) row.zona = input.zona;
  if (input.motivo !== undefined) row.motivo = input.motivo;
  if (input.fechaInicio !== undefined) row.fecha_inicio = input.fechaInicio;
  if (input.fechaFin !== undefined) row.fecha_fin = input.fechaFin;
  if (input.status !== undefined) row.status = input.status;
  if (input.impuestaPorId !== undefined) row.impuesta_por_id = input.impuestaPorId;
  if (input.impuestaPorNombre !== undefined) {
    row.impuesta_por_nombre = input.impuestaPorNombre;
  }
  if (input.revocadaPorNombre !== undefined) {
    row.revocada_por_nombre = input.revocadaPorNombre;
  }
  if (input.revocadaAt !== undefined) row.revocada_at = input.revocadaAt;
  if (input.notas !== undefined) row.notas = input.notas ?? null;
  if (input.delegateNotify !== undefined) {
    row.delegate_notify = input.delegateNotify;
  }
  row.updated_at = new Date().toISOString();
  return row;
}
