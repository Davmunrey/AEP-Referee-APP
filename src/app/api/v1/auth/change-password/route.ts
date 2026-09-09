import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import {
  canAttemptLogin,
  clearLoginAttempts,
  MAX_LOGIN_PASSWORD_LENGTH,
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
  // El mismo tope que `/auth/login`, que lo lleva porque bcrypt solo usa los
  // primeros 72 bytes y sin cota se puede hacer hashear megabytes por petición.
  // Aquí faltaba, y son DOS contraseñas las que salen hacia el proveedor.
  if (
    newPassword.length > MAX_LOGIN_PASSWORD_LENGTH ||
    currentPassword.length > MAX_LOGIN_PASSWORD_LENGTH
  ) {
    return jsonError("Contraseña no válida", 400);
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
  if (updateError) {
    // El detalle del proveedor de identidad se queda en el log; y una
    // contraseña rechazada por la política no es un error del servidor.
    console.error("[auth.change-password]", user.id, updateError.message);
    const debil = updateError.status === 422 || updateError.code === "weak_password";
    return jsonError(
      debil
        ? "La contraseña no cumple la política de seguridad. Prueba con una más larga o menos común."
        : "No se pudo actualizar la contraseña. Vuelve a intentarlo.",
      debil ? 400 : 500,
    );
  }

  // Cambiar la contraseña tiene que echar a quien esté dentro con la anterior.
  // Sin esto, una sesión robada —un portátil compartido, un token filtrado—
  // seguía viva después del cambio: el usuario cree que ha cerrado la puerta y
  // la puerta sigue abierta hasta que caduque el refresh token.
  // `scope: "others"` conserva la sesión desde la que se hace el cambio.
  let otrasSesionesCerradas = true;
  try {
    const sesion = await createServerClient();
    const { error: signOutError } = await sesion.auth.signOut({ scope: "others" });
    if (signOutError) {
      otrasSesionesCerradas = false;
      console.error("[auth.change-password.signOut]", user.id, signOutError.message);
    }
  } catch (err) {
    otrasSesionesCerradas = false;
    console.error("[auth.change-password.signOut]", user.id, err);
  }

  // La contraseña YA está cambiada: fallar aquí sería mentir al revés. Se
  // devuelve el dato para que la pantalla pueda avisar de que conviene cerrar
  // sesión en el resto de dispositivos a mano.
  return jsonOk({ updated: true, otrasSesionesCerradas });
}
