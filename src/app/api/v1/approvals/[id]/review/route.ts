import { canApprove } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canApprove(user)) return jsonError("Sin permiso para aprobar", 403);

  const { id } = await context.params;
  // `null` es JSON válido y no dispara el .catch: `body.approve` reventaba con
  // TypeError → 500. Y Boolean("false") era true: solo `true` literal aprueba.
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const approve = body.approve === true;
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 500) || undefined : undefined;

  // El servicio devuelve undefined tanto si la propuesta no existe como si ya
  // fue revisada (o si otro revisor ganó la carrera): distingue 404 de 409.
  const existing = (await dataService.getApprovals(user)).find((a) => a.id === id);
  if (!existing) return jsonError("Propuesta no encontrada", 404);
  if (existing.status !== "pendiente") {
    return jsonError("La propuesta ya fue revisada", 409);
  }

  let result;
  try {
    result = await dataService.reviewApproval(id, approve, user.nombre, user.id, comment);
  } catch (err) {
    // reviewApproval lanza con un mensaje claro cuando la aprobación no puede
    // completarse de forma segura (juez borrado del censo, fallo al guardar el acta).
    return jsonError(err instanceof Error ? err.message : "No se pudo revisar la propuesta", 409);
  }
  if (!result) return jsonError("La propuesta ya fue revisada por otro usuario", 409);
  return jsonOk(result);
}
