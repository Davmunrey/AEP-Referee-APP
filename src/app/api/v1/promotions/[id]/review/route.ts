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
  if (!canApprove(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json();
  const result = await dataService.reviewPromotion(id, Boolean(body.approve), user.nombre);
  if (!result) return jsonError("Solicitud no encontrada", 404);
  return jsonOk(result);
}
