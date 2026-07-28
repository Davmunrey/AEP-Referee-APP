import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const visibleExam = (await dataService.getExams(undefined, user)).find((exam) => exam.id === id);
  if (!visibleExam) return jsonError("Examen no encontrado", 404);
  const body = (await request.json().catch(() => null)) as {
    resultado?: ExamResult;
    puntuacion?: number;
    notas?: string;
    fecha?: string;
    examinador?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  if (body.puntuacion != null) {
    if (typeof body.puntuacion !== "number" || Number.isNaN(body.puntuacion)) {
      return jsonError("Puntuación inválida", 400);
    }
    // Clampa contra la puntuación máxima configurada en el examen (no un 100
    // fijo): los exámenes tienen `puntuacionMaxima` configurable.
    const maxScore = visibleExam.puntuacionMaxima > 0 ? visibleExam.puntuacionMaxima : 100;
    body.puntuacion = Math.min(maxScore, Math.max(0, Math.round(body.puntuacion)));
  }
  const updated = await dataService.updateExam(id, body);
  if (!updated) return jsonError("Examen no encontrado", 404);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role !== "super_admin" && user.role !== "delegado_jueces")
    return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const visibleExam = (await dataService.getExams(undefined, user)).find((exam) => exam.id === id);
  if (!visibleExam) return jsonError("Examen no encontrado", 404);
  const ok = await dataService.deleteExam(id);
  if (!ok) return jsonError("Examen no encontrado", 404);
  return jsonOk({ deleted: true });
}
