import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { profileToSessionUser, type ProfileRow } from "@/lib/auth/profile";
import { resolveZoneCode } from "@/lib/aep-zones";
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
  const invited = meta.invited === true;

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  const isFirst = (count ?? 0) === 0;
  const activo = isFirst || invited;

  await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        nombre,
        rol_label: isFirst ? "Super Admin" : "Pendiente de asignación",
        iniciales: initialsFrom(nombre, email),
        role: isFirst ? "super_admin" : "solo_ver",
        zona: null,
        activo,
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

/**
 * RBAC. Cuatro roles:
 *  - super_admin      — control total.
 *  - delegado_jueces  — jefe nacional de jueces; autoridad total (igual que super_admin).
 *  - delegado_zona    — gestiona campeonatos, tarimas y jueces de SU zona.
 *  - solo_ver         — solo lectura.
 */

/** Campeonatos y tarima: crear, editar, asignar. */
export function canEditRoster(user: SessionUser, eventZona?: string): boolean {
  if (user.role === "super_admin" || user.role === "delegado_jueces") return true;
  if (user.role === "delegado_zona") {
    const userZone = resolveZoneCode(user.zona);
    const eventZone = resolveZoneCode(eventZona);
    return !!userZone && userZone === eventZone;
  }
  return false;
}

/** Alias semántico para gestión de campeonatos. */
export const canManageCompetitions = canEditRoster;

/** Aprobar propuestas de tarima. */
export function canApprove(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/** Gestión de cuentas de usuario. */
export function canManageUsers(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/** Crear/editar jueces, exámenes e informes. */
export function canManageJudges(user: SessionUser): boolean {
  return user.role !== "solo_ver";
}

/** Eliminar jueces, exámenes o informes. */
export function canAdminJudges(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/** Revisar (aprobar/rechazar) solicitudes de ascenso. */
export function canReviewPromotions(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}
