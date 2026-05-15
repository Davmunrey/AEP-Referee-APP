import { findUserByEmail, toSessionUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return jsonError("Credenciales incorrectas", 401);
  }
  const session = toSessionUser(user);
  await setSessionCookie(session);
  return jsonOk({ user: session });
}
