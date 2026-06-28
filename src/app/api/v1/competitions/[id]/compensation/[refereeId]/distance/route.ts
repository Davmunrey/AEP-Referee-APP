import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string; refereeId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id, refereeId } = await context.params;
  try {
    const claim = await dataService.calculateCompensationDistance(id, refereeId);
    if (!claim) return jsonError("Juez o campeonato no encontrado", 404);
    return jsonOk(claim);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo calcular la ruta";
    return jsonError(msg, 422);
  }
}
