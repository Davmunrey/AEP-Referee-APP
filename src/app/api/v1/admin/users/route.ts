import { clerkClient } from "@clerk/nextjs/server";
import { canManageUsers } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isClerkConfigured } from "@/lib/clerk/env";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { UserRole } from "@/lib/types";

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
  if (!isClerkConfigured()) return jsonError("Clerk no configurado", 503);
  if (!isSupabaseConfigured()) return jsonError("Supabase no configurado", 503);

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const nombre = String(body.nombre ?? "").trim();
  const rolLabel = String(body.rolLabel ?? "").trim();
  const role = body.role as UserRole;
  const zona = body.zona ? String(body.zona) : null;

  if (!email || !password || !nombre || !rolLabel || !role) {
    return jsonError("Email, contraseña, nombre, rol y etiqueta son obligatorios", 400);
  }
  if (role === "regional" && !zona) {
    return jsonError("Los usuarios regionales requieren zona", 400);
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

  const nameParts = nombre.split(" ");
  const firstName = nameParts[0] ?? nombre;
  const lastName = nameParts.slice(1).join(" ") || undefined;

  const clerk = await clerkClient();
  let clerkUserId: string;
  try {
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName,
      lastName,
      skipPasswordChecks: false,
    });
    clerkUserId = clerkUser.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el usuario en Clerk";
    return jsonError(message, 400);
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").insert({
    id: clerkUserId,
    email,
    nombre,
    rol_label: rolLabel,
    iniciales,
    role,
    zona: role === "nacional" ? null : zona,
    activo: true,
  });

  if (profileError) {
    try {
      await clerk.users.deleteUser(clerkUserId);
    } catch {
      // rollback best-effort
    }
    return jsonError(profileError.message, 500);
  }

  return jsonOk({
    id: clerkUserId,
    email,
    nombre,
    rol_label: rolLabel,
    iniciales,
    role,
    zona,
    activo: true,
  });
}
