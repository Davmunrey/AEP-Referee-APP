import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const scopeErr = await assertCompetitionInUserZone(user, id);
  if (scopeErr) return scopeErr;
  try {
    if (!(await dataService.getCompetition(id))) {
      return jsonError("Competición no encontrada", 404);
    }
    return jsonOk(await dataService.getRosterHistory(id));
  } catch (err) {
    return jsonRouteError("roster.history", err, "No se pudo cargar el historial de la tarima");
  }
}
