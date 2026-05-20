import { canEditRoster } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const comp = await dataService.getCompetition(id);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso", 403);

  const proposal = await dataService.submitRoster(id, user.nombre);
  if (!proposal) return jsonError("No se pudo enviar", 400);
  return jsonOk({
    message: "Propuesta enviada a aprobación nacional",
    proposal,
  });
}
