import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { profileToSessionUser, type ProfileRow } from "@/lib/auth/profile";
import { SessionProfileReadError } from "@/lib/auth/session-errors";
import { resolveZoneCode } from "@/lib/aep-zones";
import { DOCS_CAPTURE_SESSION, isDocsCaptureMode } from "@/lib/auth/docs-capture";
import { ensureDocsCaptureSeed } from "@/server/services/docs-capture-seed";
import {
  ROLE_LABELS,
  SUPER_ADMIN_ONLY_ROLES,
  type SessionUser,
  type UserRole,
} from "@/lib/types";

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
/**
 * Da de alta el perfil de un usuario de auth que todavía no lo tiene.
 *
 * Solo llega aquí quien se ha autenticado SIN que un administrador le haya
 * creado la cuenta: el alta desde «Gestión de cuentas» crea el usuario de auth
 * y su perfil `activo` en la misma petición (y borra el usuario si el perfil
 * falla), así que en el camino legítimo el perfil ya existe.
 */
async function ensureProfile(admin: AdminClient, user: User): Promise<ProfileRow | null> {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const nombre = String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? "Usuario");

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  // Este recuento decide si el usuario se crea como super_admin. Si la consulta
  // falla, `count` llegaba como null y se leía como «no hay perfiles todavía»:
  // cualquiera que se registrase durante un fallo transitorio de la base de
  // datos se daba de alta como super_admin activo. Ante la duda no se crea el
  // perfil; el usuario reintenta y entra por el camino normal.
  if (countError || count == null) return null;
  const isFirst = count === 0;
  // Solo el primer perfil de la instalación nace activo.
  //
  // Antes esto era `isFirst || meta.invited === true`, y ese `invited` sale de
  // `user_metadata`, que en Supabase lo escribe EL PROPIO USUARIO: se puede
  // fijar al registrarse (`signUp` con `options.data`) o después con
  // `updateUser({ data })`, contra la API pública y con la clave anónima, que
  // viaja en el navegador. Es decir, la bandera que decidía si una cuenta nueva
  // entra activa la controlaba quien se daba de alta, no quien invita.
  //
  // Y no hacía falta para nada: el alta desde «Gestión de cuentas» ya crea el
  // perfil con `activo: true`, así que esta rama nunca la recorre un usuario
  // invitado de verdad. Solo servía de puerta.
  //
  // Si alguna vez hace falta marcar una invitación, el sitio es `app_metadata`,
  // que solo se escribe con la clave de servicio.
  const activo = isFirst;

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

/**
 * Resuelve el perfil de la app (y RBAC) para un usuario auth de Supabase.
 * Exportada para poder probar el alta de perfil sin montar toda la sesión SSR.
 */
export async function resolveSessionUser(admin: AdminClient, user: User): Promise<SessionUser | null> {
  // `supabase-js` no lanza: devuelve `{ data, error }`, y `maybeSingle()` da
  // `data: null, error: null` cuando no hay fila. El error se descartaba, así
  // que un corte de lectura entraba por la misma puerta que «este usuario no
  // tiene perfil»: se intentaba crearle uno y, si eso también fallaba, la
  // aplicación le decía que su cuenta no tiene acceso. No es verdad, y manda a
  // alguien con acceso a pedirle permisos a quien ya se los dio.
  let { data: profile } = await admin
    .from("profiles")
    .select("id, email, nombre, rol_label, iniciales, role, zona, activo")
    .eq("id", user.id)
    .maybeSingle()
    .then((res) => {
      if (res.error) throw new SessionProfileReadError(res.error.message);
      return res;
    });

  if (!profile) {
    profile = await ensureProfile(admin, user);
  }

  if (!profile || !(profile as ProfileRow).activo) return null;
  return profileToSessionUser(profile as ProfileRow);
}

/** Sesión del usuario actual vía cookie de sesión Supabase SSR. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (isDocsCaptureMode()) {
    ensureDocsCaptureSeed();
    return DOCS_CAPTURE_SESSION;
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return resolveSessionUser(createAdminClient(), data.user);
});

/**
 * RBAC. Cinco roles:
 *  - super_admin                    — control total.
 *  - delegado_jueces                — jefe nacional de jueces; autoridad total (igual que super_admin).
 *  - delegado_zona                  — gestiona campeonatos, tarimas y jueces de SU zona.
 *  - responsable_financiero_jueces  — compensación económica de jueces (no tarima ni censo).
 *  - solo_ver                       — solo lectura.
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

/**
 * Roles cuyas cuentas solo puede tocar un super admin.
 *
 * `super_admin` ya lo estaba: es quien lo puede todo. Se le suma el
 * responsable financiero, que es quien ve y exporta el dinero —importes,
 * recibos y los datos que los sostienen—. Sin esto, cualquiera con gestión de
 * cuentas podía apropiarse de ese rol por tres caminos distintos: crear una
 * cuenta financiera con la contraseña que quisiera, ascender a financiera una
 * cuenta existente, o resetear la contraseña de la persona que ya lo era y
 * entrar como ella. El de en medio ni siquiera cambiaba el número de cuentas
 * financieras.
 *
 * No es desconfianza hacia el delegado de jueces: es que el permiso de
 * gestionar cuentas no debería incluir, de propina, el acceso al dinero.
 *
 * La lista está en `lib/types` (`SUPER_ADMIN_ONLY_ROLES`) porque la pantalla de
 * administración es cliente y este módulo arrastra código de servidor.
 *
 * ¿Puede este usuario asignar ese rol a alguien?
 */
export function canAssignRole(user: SessionUser, role: UserRole): boolean {
  if (!canManageUsers(user)) return false;
  return SUPER_ADMIN_ONLY_ROLES.includes(role) ? user.role === "super_admin" : true;
}

/** ¿Puede este usuario administrar (editar, borrar, resetear) esa cuenta? */
export function canAdministerUserWithRole(
  user: SessionUser,
  targetRole: UserRole | string | null | undefined,
): boolean {
  if (!canManageUsers(user)) return false;
  const role = String(targetRole ?? "") as UserRole;
  return SUPER_ADMIN_ONLY_ROLES.includes(role) ? user.role === "super_admin" : true;
}

/** Mensaje único para los tres caminos. */
export function restrictedRoleMessage(role: UserRole | string): string {
  return `Solo Super Admin puede gestionar cuentas con el rol ${ROLE_LABELS[role as UserRole] ?? role}.`;
}

/** Gestión de cuentas de usuario. */
export function canManageUsers(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/** Crear/editar jueces, exámenes e informes. */
export function canManageJudges(user: SessionUser): boolean {
  return (
    user.role === "super_admin" ||
    user.role === "delegado_jueces" ||
    user.role === "delegado_zona"
  );
}

/** Ver y gestionar compensación de gastos de jueces (no delegado de zona ni de jueces). */
export function canManageCompensation(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "responsable_financiero_jueces";
}

export const canViewCompensation = canManageCompensation;

/** Eliminar jueces, exámenes o informes. */
export function canAdminJudges(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/** Revisar (aprobar/rechazar) solicitudes de ascenso. */
export function canReviewPromotions(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}
