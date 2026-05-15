import { getSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";
import { jsonError } from "./route-utils";

export async function requireApiUser(): Promise<SessionUser | Response> {
  const user = await getSession();
  if (!user) {
    return jsonError("No autenticado", 401);
  }
  return user;
}

export function isSessionUser(value: SessionUser | Response): value is SessionUser {
  return "id" in value && "email" in value;
}
