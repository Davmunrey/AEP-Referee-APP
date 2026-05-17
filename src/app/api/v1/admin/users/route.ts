import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = [
  "super_admin",
  "delegado_jueces",
  "delegado_zona",
  "solo_ver",
];

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageUsers(user)) return jsonError("Sin permiso", 403);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, nombre, rol_label, iniciales, role, zona, activo, created_at")
    .order("nombre");

  if (error) return jsonError(error.message, 500);
  return jsonOk(data ?? []);
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
  const password = String(body.password ?? "");
  const nombre = String(body.nombre ?? "").trim();
  const rolLabel = String(body.rolLabel ?? "").trim();
  const role = body.role as UserRole;
  const zona = body.zona ? String(body.zona) : null;

  if (!email || !password || !nombre || !rolLabel || !role) {
    return jsonError("Email, contraseña, nombre, rol y etiqueta son obligatorios", 400);
  }
  if (!VALID_ROLES.includes(role)) {
    return jsonError("Rol no válido", 400);
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
    user_metadata: { full_name: nombre },
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
    return jsonError(profileError.message, 500);
  }

  return jsonOk({ id: userId, email, nombre, rol_label: rolLabel, iniciales, role, zona, activo: true });
}
