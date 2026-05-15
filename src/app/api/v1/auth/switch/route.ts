import { isDemoMode, switchToPersona } from "@/lib/auth/demo";
import { setSessionCookie } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return jsonError("Cambio de persona demo no disponible", 403);
  }

  const body = (await request.json()) as { userId?: string };
  if (!body.userId) return jsonError("userId requerido", 400);

  const user = switchToPersona(body.userId);
  if (!user) return jsonError("Persona demo no válida", 404);

  await setSessionCookie(user);
  return jsonOk({ user });
}
