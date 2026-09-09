import { canReviewPromotions } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { PromotionReviewError } from "@/lib/competitions/service-types";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
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
  // `Boolean("false")` es true: solo el booleano literal aprueba, igual que en
  // la revisión de tarima.
  const approve = body?.approve === true;
  const comment =
    typeof body?.comment === "string" ? body.comment.trim() : undefined;

  // Comentario obligatorio al rechazar (paridad con aprobaciones de tarima).
  if (!approve && !comment) {
    return jsonError("El motivo de rechazo es obligatorio", 400);
  }

  // El servicio devuelve undefined tanto si la solicitud no existe como si ya
  // fue revisada: distingue 404 de 409 antes de escribir. Y por eso va antes
  // del `try`, así que sin cubrirla un fallo de lectura salía de Next como un
  // 500 sin cuerpo JSON.
  const bandeja = await readOrError("promotions.review.bandeja", "No se pudo cargar la solicitud", () =>
    dataService.getPromotions(user),
  );
  if (bandeja instanceof Response) return bandeja;
  const existing = bandeja.find((p) => p.id === id);
  if (!existing) return jsonError("Solicitud no encontrada", 404);
  if (existing.status !== "pendiente") {
    return jsonError("La solicitud ya fue revisada", 409);
  }

  // Sin `try/catch` cualquier excepción salía como un 500 sin texto: los
  // motivos que el servicio se molesta en escribir —el juez desaparecido del
  // censo, el nivel que no llegó a cambiar— no llegaban nunca al revisor.
  let result;
  try {
    result = await dataService.reviewPromotion(id, approve, user.nombre, comment);
  } catch (err) {
    if (err instanceof PromotionReviewError) return jsonError(err.message, 409);
    return jsonServerError("promotions.review", err, "No se pudo revisar la solicitud");
  }
  if (!result) return jsonError("La solicitud ya fue revisada por otro usuario", 409);
  return jsonOk(result);
}
