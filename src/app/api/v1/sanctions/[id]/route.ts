import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { canManageSanctions } from "@/lib/permissions";
import { getRefereeSanction } from "@/server/services/referee-sanctions";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: string }).action : "";

  if (action === "revoke") {
    // Sin `try`, un fallo de lectura o de escritura salía como un 500 sin
    // cuerpo JSON. Y las dos cosas se confundían antes con «no encontrada»: la
    // sanción seguía activa mientras la pantalla decía que ya no estaba.
    try {
      const sanction = await getRefereeSanction(id);
      if (!sanction) return jsonError("Sanción no encontrada", 404);
      if (!canManageSanctions(user, sanction.zona)) {
        return jsonError("Sin permiso en esta zona", 403);
      }
      const motivo = String((body as { motivo?: string }).motivo ?? "").trim();
      const updated = await dataService.revokeRefereeSanction(id, user, motivo);
      if (!updated) return jsonError("Sanción no encontrada", 404);
      return jsonOk(updated);
    } catch (err) {
      return jsonRouteError("sanctions.PATCH", err, "No se pudo revocar la sanción");
    }
  }

  return jsonError("Acción no reconocida", 400);
}
