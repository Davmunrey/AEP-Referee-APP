import { normalizeZoneInput } from "@/lib/aep-zones";
import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { USER_ROLES, type UserRole } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, zona")
    .eq("id", id)
    .maybeSingle();
  if (!target) return jsonError("Usuario no encontrado", 404);
  const targetRole = String(target.role ?? "");
  if (targetRole === "super_admin" && user.role !== "super_admin") {
    return jsonError("Solo Super Admin puede modificar a otro Super Admin", 403);
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.activo === "boolean") {
    // Evita que un admin se desactive a sí mismo y se bloquee.
    if (body.activo === false && id === user.id) {
      return jsonError("No puedes desactivar tu propia cuenta", 400);
    }
    patch.activo = body.activo;
  }
  if (body.role !== undefined) {
    if (!USER_ROLES.includes(body.role as UserRole)) {
      return jsonError("Rol no válido", 400);
    }
    // Evita que un admin se quite a sí mismo el rol super_admin.
    if (id === user.id && body.role !== "super_admin") {
      return jsonError("No puedes cambiar tu propio rol", 400);
    }
    if (body.role === "super_admin" && user.role !== "super_admin") {
      return jsonError("Solo Super Admin puede asignar rol Super Admin", 403);
    }
    patch.role = body.role;
  }
  if (body.zona !== undefined) {
    if (body.zona) {
      // Una zona no reconocida se guardaba como null en silencio y dejaba a un
      // delegado de zona sin zona → 403 en todo el scoping (bloqueo de cuenta).
      const zona = normalizeZoneInput(String(body.zona));
      if (!zona) return jsonError("Zona no válida", 400);
      patch.zona = zona;
    } else {
      patch.zona = null;
    }
  }
  if (typeof body.nombre === "string" && body.nombre.trim()) {
    patch.nombre = body.nombre.trim();
  }
  if (typeof body.rolLabel === "string" && body.rolLabel.trim()) {
    patch.rol_label = body.rolLabel.trim();
  }

  // Misma regla que el POST: un delegado de zona siempre necesita zona.
  const effectiveRole = (patch.role as string | undefined) ?? targetRole;
  const effectiveZona = patch.zona !== undefined ? patch.zona : (target.zona ?? null);
  if (effectiveRole === "delegado_zona" && !effectiveZona) {
    return jsonError("Los delegados de zona requieren zona", 400);
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Nada que actualizar", 400);
  }

  const { data, error } = await admin.from("profiles").update(patch).eq("id", id).select().single();
  if (error) {
    // PGRST116 = cero filas con .single(): el usuario ya no existe → 404.
    // Cualquier otro error es un fallo real de la base de datos → 500.
    if ((error as { code?: string }).code === "PGRST116") {
      return jsonError("Usuario no encontrado", 404);
    }
    return jsonServerError("admin.users.PATCH", error, "No se pudo actualizar el usuario");
  }
  if (!data) return jsonError("Usuario no encontrado", 404);
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
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (!target) return jsonError("Usuario no encontrado", 404);
  if (String(target.role ?? "") === "super_admin" && user.role !== "super_admin") {
    return jsonError("Solo Super Admin puede eliminar a otro Super Admin", 403);
  }

  // Borra el usuario de auth y verifica el resultado.
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return jsonError(`No se pudo eliminar el usuario: ${authError.message}`, 500);
  }
  // Elimina el perfil explícitamente (no se asume FK ON DELETE CASCADE) y
  // comprueba el resultado: un perfil huérfano seguía apareciendo en el listado.
  const { error: profileError } = await admin.from("profiles").delete().eq("id", id);
  if (profileError) {
    return jsonServerError(
      "admin.users.DELETE",
      profileError,
      "Se eliminó el acceso pero no se pudo borrar el perfil",
    );
  }

  return jsonOk({ deleted: true });
}
