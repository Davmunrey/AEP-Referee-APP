import {
  canAttemptLogin,
  MAX_LOGIN_EMAIL_LENGTH,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "check" | "fail" | "success";
    email?: string;
  } | null;
  const action = body?.action ?? "check";
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return jsonError("Email obligatorio", 400);
  if (email.length > MAX_LOGIN_EMAIL_LENGTH) return jsonError("Email no válido", 400);

  if (action === "fail" || action === "success") {
    return jsonError("Acción no permitida. Usa POST /auth/login.", 403);
  }

  const limit = canAttemptLogin(requestIp(request), email);
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }
  return jsonOk({ allowed: true });
}
