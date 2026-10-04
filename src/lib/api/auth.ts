import { getJudgeSession, getSession } from "@/lib/auth/session";
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
    // Un juez tiene sesión, pero no de gestión: con 401 su navegador entendería
    // «tu sesión ha caducado» y le mandaría a entrar otra vez, en bucle.
    if (await getJudgeSession().catch(() => null)) {
      return jsonError("Esta función no está disponible en el portal del juez", 403);
    }
    return jsonError("No autenticado", 401);
  }
  return user;
}

/**
 * Puerta de la API del portal (`/api/v1/portal/*`): solo jueces con ficha
 * enlazada. El personal de gestión no la usa —tiene sus propias rutas—, así
 * que no pasa: el portal habla siempre en nombre del juez de la sesión.
 */
export async function requireJudgeUser(): Promise<(SessionUser & { refereeId: string }) | Response> {
  let user: SessionUser | null;
  try {
    user = await getJudgeSession();
  } catch (err) {
    if (err instanceof SessionProfileReadError) {
      console.error("[api.auth.juez]", err.message);
      return jsonError("No se pudo comprobar tu sesión. Vuelve a intentarlo.", 503);
    }
    throw err;
  }
  if (!user?.refereeId) return jsonError("No autenticado", 401);
  return user as SessionUser & { refereeId: string };
}

export function isSessionUser(value: SessionUser | Response): value is SessionUser {
  return "id" in value && "email" in value;
}

/**
 * Cualquier cuenta activa, de gestión o de juez: para lo que es de cada
 * persona y no depende del rol (la campana de avisos).
 */
export async function requireAnyUser(): Promise<SessionUser | Response> {
  try {
    const user = (await getSession()) ?? (await getJudgeSession());
    if (!user) return jsonError("No autenticado", 401);
    return user;
  } catch (err) {
    if (err instanceof SessionProfileReadError) {
      console.error("[api.auth.any]", err.message);
      return jsonError("No se pudo comprobar tu sesión. Vuelve a intentarlo.", 503);
    }
    throw err;
  }
}
