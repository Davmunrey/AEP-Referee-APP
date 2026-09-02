import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult, RefereeExam } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const EXAM_RESULTS: ReadonlyArray<ExamResult> = ["Aprobado", "Suspenso", "Pendiente"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  // Lista blanca validada: antes el body se reenviaba tal cual al servicio, así
  // que un `resultado` inventado se persistía y una `fecha` no ISO fallaba en
  // la BD y se reportaba como 404 de un examen que acabamos de encontrar.
  const patch: Partial<
    Pick<RefereeExam, "resultado" | "puntuacion" | "notas" | "fecha" | "examinador">
  > = {};
  if (body.resultado !== undefined) {
    if (!EXAM_RESULTS.includes(body.resultado)) return jsonError("Resultado no válido", 400);
    patch.resultado = body.resultado;
  }
  if (body.fecha !== undefined) {
    if (typeof body.fecha !== "string" || !ISO_DATE_RE.test(body.fecha)) {
      return jsonError("La fecha debe tener formato AAAA-MM-DD", 400);
    }
    patch.fecha = body.fecha;
  }
  if (body.examinador !== undefined) {
    if (typeof body.examinador !== "string" || !body.examinador.trim()) {
      return jsonError("Examinador no válido", 400);
    }
    patch.examinador = body.examinador.trim();
  }
  if (body.notas !== undefined) {
    if (typeof body.notas !== "string") return jsonError("Notas no válidas", 400);
    patch.notas = body.notas;
  }
  if (body.puntuacion != null) {
    if (typeof body.puntuacion !== "number" || !Number.isFinite(body.puntuacion)) {
      return jsonError("Puntuación inválida", 400);
    }
    // Clampa contra la puntuación máxima configurada en el examen (no un 100
    // fijo): los exámenes tienen `puntuacionMaxima` configurable.
    const maxScore = visibleExam.puntuacionMaxima > 0 ? visibleExam.puntuacionMaxima : 100;
    patch.puntuacion = Math.min(maxScore, Math.max(0, Math.round(body.puntuacion)));
  }
  if (Object.keys(patch).length === 0) return jsonError("Nada que actualizar", 400);

  const updated = await dataService.updateExam(id, patch);
  // Ya comprobamos que existe: un `undefined` aquí es un fallo de escritura.
  if (!updated) return jsonError("No se pudo actualizar el examen", 500);
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
