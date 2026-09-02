import { normalizeZoneInput } from "@/lib/aep-zones";
import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { listAdminUsers } from "@/server/services/admin-users";
import { USER_ROLES, type UserRole } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  try {
    const rows = await listAdminUsers();
    return jsonOk(rows);
  } catch (error) {
    return jsonServerError("admin.users.GET", error, "No se pudieron cargar los usuarios");
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  // Solo string: `String({})` daba la contraseña literal "[object Object]".
  const password = typeof body.password === "string" ? body.password : "";
  const nombre = String(body.nombre ?? "").trim();
  const rolLabel = String(body.rolLabel ?? "").trim();
  const role = body.role as UserRole;
  const zona = body.zona ? normalizeZoneInput(String(body.zona)) : null;

  if (!email || !password || !nombre || !rolLabel || !role) {
    return jsonError("Email, contraseña, nombre, rol y etiqueta son obligatorios", 400);
  }
  if (!USER_ROLES.includes(role)) {
    return jsonError("Rol no válido", 400);
  }
  if (role === "super_admin" && user.role !== "super_admin") {
    return jsonError("Solo Super Admin puede crear otro Super Admin", 403);
  }
  if (role === "delegado_zona" && !zona) {
    return jsonError("Los delegados de zona requieren zona", 400);
  }
  if (password.length < 8) {
    return jsonError("La contraseña debe tener al menos 8 caracteres", 400);
  }

  const iniciales = nombre
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Create auth user via Supabase Admin
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre, invited: true },
  });

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "No se pudo crear el usuario", 400);
  }

  const userId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    nombre,
    rol_label: rolLabel,
    iniciales,
    role,
    zona: role === "delegado_zona" ? zona : null,
    activo: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    return jsonServerError("admin.users.POST", profileError, "No se pudo crear el perfil del usuario");
  }

  // Devuelve la zona realmente guardada (solo delegado_zona la conserva).
  return jsonOk({
    id: userId,
    email,
    nombre,
    rol_label: rolLabel,
    iniciales,
    role,
    zona: role === "delegado_zona" ? zona : null,
    activo: true,
  });
}
