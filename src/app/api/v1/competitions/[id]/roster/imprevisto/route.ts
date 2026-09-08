import { canEditRoster } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  try {
    const result = await dataService.unlockRosterImprevisto(competitionId, user.nombre);
    if ("error" in result) return jsonError(result.error, 400);
    return jsonOk(result);
  } catch (err) {
    // La propuesta puede haberse retirado y el estado no haberse actualizado:
    // reintentar es seguro, pero antes esto salía como un 500 sin cuerpo y el
    // cliente enseñaba «Server error (500)».
    return jsonRouteError("roster.imprevisto", err, "No se pudo desbloquear la tarima. Vuelve a intentarlo.");
  }
}
