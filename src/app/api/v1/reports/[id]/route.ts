import { canAdminJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canAdminJudges(user)) return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const ok = await dataService.deleteReport(id);
  if (!ok) return jsonError("Informe no encontrado", 404);
  return jsonOk({ deleted: true });
}
