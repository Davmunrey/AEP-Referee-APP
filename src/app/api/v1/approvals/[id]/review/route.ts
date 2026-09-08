import { canApprove } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { ApprovalReviewError } from "@/lib/competitions/service-types";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
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
    // Solo el motivo pensado para el revisor viaja al cliente (juez borrado del
    // censo, acta que no se pudo guardar). Antes salía el mensaje de CUALQUIER
    // excepción —incluido el texto de Postgres, con nombres de tabla y de
    // restricción— y encima disfrazado de conflicto.
    if (err instanceof ApprovalReviewError) return jsonError(err.message, 409);
    return jsonServerError("approvals.review", err, "No se pudo revisar la propuesta");
  }
  if (!result) return jsonError("La propuesta ya fue revisada por otro usuario", 409);
  return jsonOk(result);
}
