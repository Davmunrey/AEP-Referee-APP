import { zonesMatch } from "@/lib/aep-zones";
import { isSafeExternalUrlOrEmpty } from "@/lib/safe-url";
import { canAdminJudges, canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
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
  if (typeof raw.adjuntoUrl === "string") {
    // Mismo criterio que el alta: el adjunto termina en un `href`.
    if (!isSafeExternalUrlOrEmpty(raw.adjuntoUrl)) {
      return jsonError("El enlace adjunto debe ser una URL http(s) válida", 400);
    }
    patch.adjuntoUrl = raw.adjuntoUrl;
  }

  const existing = await dataService.getReport(id);
  if (!existing) return jsonError("Informe no encontrado", 404);
  // `referee_reports.zona` es texto libre: la migración 013 no normalizó esta
  // tabla, así que un informe anterior guarda «MAD» o «Centro» y comparado en
  // crudo su propio delegado no podía tocarlo.
  // Fail-closed: un delegado de zona sin zona asignada no puede actuar. Con
  // `&& user.zona` la comprobación se saltaba entera y podía tocar cualquier
  // informe del país.
  if (user.role === "delegado_zona") {
    if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
    if (!zonesMatch(existing.zona, user.zona)) return jsonError("Fuera de tu zona", 403);
  }

  try {
    const updated = await dataService.updateReport(id, patch);
    // Ya comprobamos que existe: si ahora no está, lo borraron entre medias.
    if (!updated) return jsonError("Informe no encontrado", 404);
    return jsonOk(updated);
  } catch (err) {
    return jsonServerError("reports.PATCH", err, "No se pudo actualizar el informe");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canAdminJudges(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const existing = await dataService.getReport(id);
  if (!existing) return jsonError("Informe no encontrado", 404);
  // `referee_reports.zona` es texto libre: la migración 013 no normalizó esta
  // tabla, así que un informe anterior guarda «MAD» o «Centro» y comparado en
  // crudo su propio delegado no podía tocarlo.
  //
  // Aquí `canAdminJudges` ya deja fuera a los delegados de zona, así que esta
  // guarda no llega a decidir nada; se escribe igual que sus hermanas para que
  // las tres digan lo mismo si algún día ese permiso cambia.
  if (user.role === "delegado_zona") {
    if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
    if (!zonesMatch(existing.zona, user.zona)) return jsonError("Fuera de tu zona", 403);
  }

  try {
    const ok = await dataService.deleteReport(id);
    if (!ok) return jsonError("Informe no encontrado", 404);
    return jsonOk({ deleted: true });
  } catch (err) {
    // Un borrado que falla no es «ya no estaba»: seguía ahí.
    return jsonServerError("reports.DELETE", err, "No se pudo eliminar el informe");
  }
}
