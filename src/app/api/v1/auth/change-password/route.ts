import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTokenClient } from "@/lib/supabase/token";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (newPassword.length < 8) {
    return jsonError("La nueva contraseña debe tener al menos 8 caracteres", 400);
  }
  if (newPassword === currentPassword) {
    return jsonError("La nueva contraseña debe ser distinta de la actual", 400);
  }
  if (!user.email) return jsonError("La cuenta no tiene email asociado", 400);

  // Verifica la contraseña actual con un cliente sin sesión (stateless), válido
  // tanto para la web (cookie) como para el cliente nativo (Bearer).
  const verifier = createTokenClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return jsonError("La contraseña actual no es correcta", 400);

  // Actualiza por id con la service role: funciona aunque no haya cookie (móvil).
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updateError) return jsonError(`No se pudo actualizar: ${updateError.message}`, 500);

  return jsonOk({ updated: true });
}
