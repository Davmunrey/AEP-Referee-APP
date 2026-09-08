import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const competition = await dataService.getCompetition(id);
  if (!competition) return jsonError("Competición no encontrada", 404);

  try {
    return jsonOk(await dataService.recalculateCompensation(id));
  } catch (err) {
    return jsonRouteError("compensation.recalculate", err, "No se pudo recalcular la compensación");
  }
}
