import {
  canAttemptLogin,
  clearLoginAttempts,
  loginRateLimitKey,
  recordFailedLogin,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "check" | "fail" | "success";
    email?: string;
  } | null;
  const action = body?.action ?? "check";
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return jsonError("Email obligatorio", 400);

  const key = loginRateLimitKey(requestIp(request), email);
  if (action === "fail") {
    recordFailedLogin(key);
    return jsonOk({ allowed: true });
  }
  if (action === "success") {
    clearLoginAttempts(key);
    return jsonOk({ allowed: true });
  }

  const limit = canAttemptLogin(key);
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }
  return jsonOk({ allowed: true });
}
