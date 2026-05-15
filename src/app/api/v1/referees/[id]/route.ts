import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const referee = await dataService.getReferee(id);
  if (!referee) return jsonError("Árbitro no encontrado", 404);
  return jsonOk(referee);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "lectura") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json();
  const updated = await dataService.updateReferee(id, body);
  if (!updated) return jsonError("Árbitro no encontrado", 404);
  return jsonOk(updated);
}
