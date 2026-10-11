import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  try {
    // En paralelo: el resumen ya devuelve uno vacío si el campeonato no
    // existe, y el 404 lo sigue decidiendo esta comprobación. En serie, cada
    // carga de la pantalla pagaba un viaje entero solo para saber que existía.
    const [competition, summary] = await Promise.all([
      dataService.getCompetition(id),
      dataService.getCompensationSummary(id),
    ]);
    if (!competition) return jsonError("Competición no encontrada", 404);
    return jsonOk(summary);
  } catch (err) {
    return jsonRouteError("compensation.GET", err, "No se pudo cargar la compensación");
  }
}
