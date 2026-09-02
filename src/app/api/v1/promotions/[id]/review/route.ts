import { canReviewPromotions } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canReviewPromotions(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const approve = Boolean(body?.approve);
  const comment =
    typeof body?.comment === "string" ? body.comment.trim() : undefined;

  // Comentario obligatorio al rechazar (paridad con aprobaciones de tarima).
  if (!approve && !comment) {
    return jsonError("El motivo de rechazo es obligatorio", 400);
  }

  // El servicio devuelve undefined tanto si la solicitud no existe como si ya
  // fue revisada: distingue 404 de 409 antes de escribir.
  const existing = (await dataService.getPromotions(user)).find((p) => p.id === id);
  if (!existing) return jsonError("Solicitud no encontrada", 404);
  if (existing.status !== "pendiente") {
    return jsonError("La solicitud ya fue revisada", 409);
  }

  const result = await dataService.reviewPromotion(id, approve, user.nombre, comment);
  if (!result) return jsonError("La solicitud ya fue revisada por otro usuario", 409);
  return jsonOk(result);
}
