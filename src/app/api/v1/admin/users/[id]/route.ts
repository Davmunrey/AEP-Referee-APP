import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const { id } = await context.params;
  const body = await request.json();
  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (typeof body.activo === "boolean") patch.activo = body.activo;
  if (body.role) patch.role = body.role;
  if (body.zona !== undefined) patch.zona = body.zona ?? null;

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
  const admin = createAdminClient();

  // Delete from auth + profiles (profiles has ON DELETE CASCADE)
  await admin.auth.admin.deleteUser(id).catch(() => null);

  return jsonOk({ deleted: true });
}
