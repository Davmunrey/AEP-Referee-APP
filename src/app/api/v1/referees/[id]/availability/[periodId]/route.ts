import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string; periodId: string }>;
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { periodId } = await context.params;
  const ok = await dataService.removeRefereeUnavailability(periodId);
  if (!ok) return jsonError("No se pudo eliminar el período", 400);
  return jsonOk({ ok: true });
}
