import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

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
  const password = String(body?.password ?? "");
  if (password.length < 8) return jsonError("La contraseña debe tener al menos 8 caracteres", 400);

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (!target) return jsonError("Usuario no encontrado", 404);

  // Solo un Super Admin puede resetear la contraseña de otro Super Admin.
  if (String(target.role ?? "") === "super_admin" && user.role !== "super_admin") {
    return jsonError("Solo Super Admin puede resetear la contraseña de otro Super Admin", 403);
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return jsonError(`No se pudo actualizar la contraseña: ${error.message}`, 500);

  return jsonOk({ updated: true });
}
