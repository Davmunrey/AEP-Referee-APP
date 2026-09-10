import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  // Vía `requireApiUser` y no `getSession()` a pelo: así un fallo al leer el
  // perfil sale como 503 «vuelve a intentarlo» y no como un 401 que le dice a
  // quien acaba de entrar que su sesión ha caducado.
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  try {
    return jsonOk(await dataService.getMeta(user));
  } catch (err) {
    return jsonRouteError("auth.me", err, "No se pudo cargar tu sesión");
  }
}
