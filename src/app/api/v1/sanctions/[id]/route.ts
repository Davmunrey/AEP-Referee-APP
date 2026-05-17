import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
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
    const motivo = String((body as { motivo?: string }).motivo ?? "").trim();
    const updated = await dataService.revokeRefereeSanction(id, user, motivo);
    if (!updated) return jsonError("Sanción no encontrada", 404);
    return jsonOk(updated);
  }

  return jsonError("Acción no reconocida", 400);
}
