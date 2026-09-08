import {
  canAdministerUserWithRole,
  canManageUsers,
  restrictedRoleMessage,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { recordAccessChange } from "@/server/services/admin-audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Admin reset: cambia la contraseña de cualquier usuario sin conocer la actual. */
export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  // Solo string: `String({})` fijaba la contraseña literal "[object Object]".
  const password = body?.password;
  if (typeof password !== "string" || password.length < 8) {
    return jsonError("La contraseña debe tener al menos 8 caracteres", 400);
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, nombre")
    .eq("id", id)
    .maybeSingle();
  if (!target) return jsonError("Usuario no encontrado", 404);

  // El reseteo es el camino más silencioso de los tres: se apropia de una
  // cuenta que ya existe, así que ni siquiera cambia cuántas cuentas hay con
  // ese rol. Mismo criterio que el resto: las cuentas de super admin y de
  // responsable financiero solo las toca un super admin.
  if (!canAdministerUserWithRole(user, target.role as string)) {
    return jsonError(restrictedRoleMessage(String(target.role ?? "")), 403);
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return jsonError(`No se pudo actualizar la contraseña: ${error.message}`, 500);

  // Cambiar la contraseña de otra persona es tomar su acceso: consta.
  await recordAccessChange({
    tipo: "cambio",
    actor: user.nombre,
    accion: "restableció la contraseña de",
    evento: String(target.nombre ?? id),
    hace: "ahora",
  });

  return jsonOk({ updated: true });
}
