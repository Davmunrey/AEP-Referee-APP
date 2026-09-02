import { createClient } from "@supabase/supabase-js";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import {
  canAttemptLogin,
  clearLoginAttempts,
  recordFailedLogin,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

/**
 * Self-service: el usuario autenticado cambia SU PROPIA contraseña.
 * Requiere sesión (requireApiUser) pero no lleva guard RBAC a propósito —
 * solo actúa sobre la cuenta del propio llamante, verificando antes la
 * contraseña actual. Listada como self-service en el readiness check.
 */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;
  // Solo strings: `String({})` daba contraseñas literales "[object Object]".
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return jsonError("La nueva contraseña debe tener al menos 8 caracteres", 400);
  }
  if (newPassword === currentPassword) {
    return jsonError("La nueva contraseña debe ser distinta de la actual", 400);
  }
  if (!user.email) return jsonError("La cuenta no tiene email asociado", 400);

  // La verificación con signInWithPassword es un intento de login a efectos
  // prácticos: pasa por el mismo rate-limit que /auth/login para impedir
  // fuerza bruta sobre la contraseña actual desde una sesión abierta.
  const ip = requestIp(request);
  const limit = canAttemptLogin(ip, user.email);
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }

  // Verifica la contraseña actual con un cliente sin sesión persistente.
  const verifier = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    recordFailedLogin(ip, user.email);
    return jsonError("La contraseña actual no es correcta", 400);
  }
  clearLoginAttempts(ip, user.email);

  // Actualiza por id con la service role.
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updateError) return jsonError(`No se pudo actualizar: ${updateError.message}`, 500);

  return jsonOk({ updated: true });
}
