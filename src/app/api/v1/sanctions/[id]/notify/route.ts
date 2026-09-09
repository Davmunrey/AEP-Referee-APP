import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { canManageSanctions } from "@/lib/permissions";
import { getRefereeSanction } from "@/server/services/referee-sanctions";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  try {
    // La lectura estaba fuera del `try`, así que un fallo suyo salía como un
    // 500 sin cuerpo. Y ahora puede fallar diciéndolo, en vez de fingir que la
    // sanción no existe.
    const sanction = await getRefereeSanction(id);
    if (!sanction) return jsonError("Sanción no encontrada", 404);
    if (!canManageSanctions(user, sanction.zona)) {
      return jsonError("Sin permiso en esta zona", 403);
    }
    const updated = await dataService.markSanctionDelegateNotified(id);
    if (!updated) return jsonError("Sanción no encontrada", 404);
    return jsonOk(updated);
  } catch (err) {
    return jsonRouteError("sanctions.notify", err, "No se pudo marcar el aviso");
  }
}
