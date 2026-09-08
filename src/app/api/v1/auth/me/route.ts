import { getSession } from "@/lib/auth/session";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await getSession();
  if (!user) return jsonError("No autenticado", 401);
  try {
    return jsonOk(await dataService.getMeta(user));
  } catch (err) {
    return jsonRouteError("auth.me", err, "No se pudo cargar tu sesión");
  }
}
