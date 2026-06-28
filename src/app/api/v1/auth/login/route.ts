import {
  canAttemptLogin,
  clearLoginAttempts,
  loginRateLimitKey,
  recordFailedLogin,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Login con rate-limit en servidor; registra fallos sin exponer acciones públicas. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email) return jsonError("Email obligatorio", 400);
  if (!password) return jsonError("Contraseña obligatoria", 400);

  const key = loginRateLimitKey(requestIp(request), email);
  const limit = canAttemptLogin(key);
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    recordFailedLogin(key);
    return jsonError("Email o contraseña incorrectos.", 401);
  }

  clearLoginAttempts(key);
  return jsonOk({ ok: true });
}
