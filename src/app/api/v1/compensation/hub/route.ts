import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  try {
    return jsonOk(await dataService.getCompensationHub(user));
  } catch (err) {
    return jsonRouteError("compensation.hub.GET", err, "No se pudo cargar el hub de compensación");
  }
}
