import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const roster = dataService.getRoster(id);
  if (!roster) return jsonError("Competición no encontrada", 404);
  return jsonOk(roster);
}
