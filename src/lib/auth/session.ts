import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "aep_session";

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function canEditRoster(
  user: SessionUser,
  eventZona?: string,
): boolean {
  if (user.role === "lectura") return false;
  if (user.role === "nacional") return true;
  return user.zona === eventZona;
}

export function canApprove(user: SessionUser): boolean {
  return user.role === "nacional";
}
