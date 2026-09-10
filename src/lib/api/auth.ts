import { getSession } from "@/lib/auth/session";
import { SessionProfileReadError } from "@/lib/auth/session-errors";
import type { SessionUser } from "@/lib/types";
import { jsonError } from "./route-utils";

export async function requireApiUser(): Promise<SessionUser | Response> {
  let user: SessionUser | null;
  try {
    user = await getSession();
  } catch (err) {
    // No haber podido LEER el perfil no es no estar autenticado. Con un 401 el
    // cliente enseña «Tu sesión ha caducado. Vuelve a entrar.» —lo dice
    // `mensajeDeEstado`— y manda a hacer login a quien ya lo había hecho. 503
    // es lo que de verdad pasa: vuelve a intentarlo dentro de un momento.
    if (err instanceof SessionProfileReadError) {
      console.error("[api.auth]", err.message);
      return jsonError("No se pudo comprobar tu sesión. Vuelve a intentarlo.", 503);
    }
    throw err;
  }
  if (!user) {
    return jsonError("No autenticado", 401);
  }
  return user;
}

export function isSessionUser(value: SessionUser | Response): value is SessionUser {
  return "id" in value && "email" in value;
}
