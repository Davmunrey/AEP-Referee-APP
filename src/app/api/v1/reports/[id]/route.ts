import { canAdminJudges, canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { RefereeReport, ReportType } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_TIPOS: ReadonlyArray<ReportType> = [
  "General",
  "Competición",
  "Juez",
  "Incidencia",
  "Evaluación",
];

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const patch: Partial<
    Pick<RefereeReport, "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl">
  > = {};
  if (typeof raw.titulo === "string") patch.titulo = raw.titulo;
  // Un `tipo` desconocido es un 400, no se descarta en silencio (el cliente
  // creía haber cambiado el tipo y el informe seguía igual).
  if (raw.tipo !== undefined) {
    if (typeof raw.tipo !== "string" || !ALLOWED_TIPOS.includes(raw.tipo as ReportType)) {
      return jsonError("Tipo de informe no válido", 400);
    }
    patch.tipo = raw.tipo as ReportType;
  }
  if (typeof raw.evento === "string") patch.evento = raw.evento;
  if (typeof raw.contenido === "string") patch.contenido = raw.contenido;
  if (typeof raw.adjuntoUrl === "string") patch.adjuntoUrl = raw.adjuntoUrl;

  const existing = await dataService.getReport(id);
  if (!existing) return jsonError("Informe no encontrado", 404);
  if (user.role === "delegado_zona" && user.zona && existing.zona !== user.zona) {
    return jsonError("Fuera de tu zona", 403);
  }

  const updated = await dataService.updateReport(id, patch);
  // Ya comprobamos que existe: un `undefined` aquí es un fallo de escritura.
  if (!updated) return jsonError("No se pudo actualizar el informe", 500);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canAdminJudges(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const existing = await dataService.getReport(id);
  if (!existing) return jsonError("Informe no encontrado", 404);
  if (user.role === "delegado_zona" && user.zona && existing.zona !== user.zona) {
    return jsonError("Fuera de tu zona", 403);
  }

  const ok = await dataService.deleteReport(id);
  if (!ok) return jsonError("Informe no encontrado", 404);
  return jsonOk({ deleted: true });
}
