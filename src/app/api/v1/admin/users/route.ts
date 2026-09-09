import { normalizeZoneInput } from "@/lib/aep-zones";
import { canAssignRole, canManageUsers, restrictedRoleMessage } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_LOGIN_PASSWORD_LENGTH } from "@/lib/api/login-rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { listAdminUsers } from "@/server/services/admin-users";
import { recordAccessChange } from "@/server/services/admin-audit";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/types";

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
  // Camino 1: crear la cuenta directamente con el rol y la contraseña elegidas.
  if (!canAssignRole(user, role)) {
    return jsonError(restrictedRoleMessage(role), 403);
  }
  if (role === "delegado_zona" && !zona) {
    return jsonError("Los delegados de zona requieren zona", 400);
  }
  if (password.length < 8) {
    return jsonError("La contraseña debe tener al menos 8 caracteres", 400);
  }
  // El mismo tope que `/auth/login` y `/auth/change-password`: bcrypt solo usa
  // los primeros 72 bytes y sin cota se puede hacer hashear megabytes por
  // petición. Aquí faltaba.
  if (password.length > MAX_LOGIN_PASSWORD_LENGTH) {
    return jsonError("Contraseña no válida", 400);
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
    // Sin `invited`: `user_metadata` lo escribe el propio usuario, así que no
    // puede sostener nada de autorización. Y no hacía falta — el perfil se crea
    // aquí mismo con `activo: true`, tres líneas más abajo.
    user_metadata: { full_name: nombre },
  });

  if (authError || !authData.user) {
    // El único motivo que quien da de alta puede arreglar es que el e-mail ya
    // tenga cuenta: ese se dice, y como 409. El resto del texto del proveedor
    // de identidad se queda en el log (CWE-209), como ya hacían el reseteo y
    // el borrado de esta misma carpeta; aquí salía tal cual, y con un 400 que
    // culpaba a la petición de un fallo del proveedor.
    const codigo = (authError as { code?: string } | null)?.code ?? "";
    const yaExiste =
      codigo === "email_exists" || /already (been )?registered|already exists/i.test(authError?.message ?? "");
    if (yaExiste) return jsonError("Ya existe una cuenta con ese e-mail", 409);
    return jsonServerError("admin.users.POST.auth", authError, "No se pudo crear el usuario");
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

  // Las altas de cuenta no dejaban ningún rastro: quién creó qué acceso, y con
  // qué rol, no constaba en ninguna parte.
  await recordAccessChange({
    tipo: "cambio",
    actor: user.nombre,
    accion: "creó la cuenta de",
    evento: `${nombre} (${ROLE_LABELS[role]})`,
    hace: "ahora",
  });

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
