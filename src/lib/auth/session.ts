import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { profileToSessionUser, type ProfileRow } from "@/lib/auth/profile";
import type { SessionUser } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

function initialsFrom(name: string, email: string): string {
  const letters = name.replace(/[^a-zA-Z ]/g, "").trim();
  if (letters) {
    const parts = letters.split(/\s+/);
    const ini = parts.map((p) => p[0]).join("").slice(0, 2);
    if (ini) return ini.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** Crea el perfil de la app para un usuario auth recién registrado. */
async function ensureProfile(admin: AdminClient, user: User): Promise<ProfileRow | null> {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const nombre = String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? "Usuario");

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  const isFirst = (count ?? 0) === 0;

  await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        nombre,
        rol_label: isFirst ? "AEP Nacional" : "Pendiente de asignación",
        iniciales: initialsFrom(nombre, email),
        role: isFirst ? "nacional" : "lectura",
        zona: null,
        activo: true,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  const { data } = await admin
    .from("profiles")
    .select("id, email, nombre, rol_label, iniciales, role, zona, activo")
    .eq("id", user.id)
    .single();

  return (data as ProfileRow) ?? null;
}

export async function getSession(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  let { data: profile } = await admin
    .from("profiles")
    .select("id, email, nombre, rol_label, iniciales, role, zona, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    profile = await ensureProfile(admin, user);
  }

  if (!profile || !(profile as ProfileRow).activo) return null;
  return profileToSessionUser(profile as ProfileRow);
}

export function canEditRoster(user: SessionUser, eventZona?: string): boolean {
  if (user.role === "lectura") return false;
  if (user.role === "nacional") return true;
  return user.zona === eventZona;
}

export function canApprove(user: SessionUser): boolean {
  return user.role === "nacional";
}

export function canManageUsers(user: SessionUser): boolean {
  return user.role === "nacional";
}
