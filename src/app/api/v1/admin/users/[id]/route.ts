import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { UserRole } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_ROLES: UserRole[] = [
  "super_admin",
  "delegado_jueces",
  "delegado_zona",
  "solo_ver",
];

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (typeof body.activo === "boolean") {
    // Evita que un admin se desactive a sí mismo y se bloquee.
    if (body.activo === false && id === user.id) {
      return jsonError("No puedes desactivar tu propia cuenta", 400);
    }
    patch.activo = body.activo;
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as UserRole)) {
      return jsonError("Rol no válido", 400);
    }
    // Evita que un admin se quite a sí mismo el rol super_admin.
    if (id === user.id && body.role !== "super_admin") {
      return jsonError("No puedes cambiar tu propio rol", 400);
    }
    patch.role = body.role;
  }
  if (body.zona !== undefined) patch.zona = body.zona ? String(body.zona) : null;

  if (Object.keys(patch).length === 0) {
    return jsonError("Nada que actualizar", 400);
  }

  const { data, error } = await admin.from("profiles").update(patch).eq("id", id).select().single();
  if (error || !data) return jsonError("Usuario no encontrado", 404);
  return jsonOk(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const { id } = await context.params;
  if (id === user.id) {
    return jsonError("No puedes eliminar tu propia cuenta", 400);
  }
  const admin = createAdminClient();

  // Borra el usuario de auth y verifica el resultado.
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return jsonError(`No se pudo eliminar el usuario: ${authError.message}`, 500);
  }
  // Elimina el perfil explícitamente (no se asume FK ON DELETE CASCADE).
  await admin.from("profiles").delete().eq("id", id);

  return jsonOk({ deleted: true });
}
