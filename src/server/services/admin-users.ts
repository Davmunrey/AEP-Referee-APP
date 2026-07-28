import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

/**
 * Fila de usuario tal como la expone el listado de administración: perfil
 * (`profiles`) enriquecido con el último inicio de sesión que aporta GoTrue
 * (`auth.users.last_sign_in_at`). Es el mismo shape que devuelve
 * `GET /api/v1/admin/users` en `data`.
 */
export interface AdminUserRow {
  id: string;
  email: string;
  nombre: string;
  rol_label: string;
  iniciales?: string;
  role: UserRole;
  zona: string | null;
  activo: boolean;
  created_at?: string;
  /** Último inicio de sesión (auth.users.last_sign_in_at); null si nunca entró. */
  last_sign_in_at?: string | null;
}

/**
 * Lista los perfiles + `last_sign_in_at` para el panel de administración.
 *
 * Reutilizable desde la ruta GET (respuesta cliente) y desde el Server
 * Component de la página (carga inicial). Lanza si la consulta de perfiles
 * falla; la Admin API de auth se degrada a columna vacía (se registra el error)
 * en lugar de tumbar todo el listado.
 */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();

  // `last_sign_in_at` no está en profiles; lo aporta GoTrue vía Admin API,
  // que pagina (perPage máx. efectivo: 1000). Se recorren páginas hasta agotar
  // usuarios (con tope de seguridad). Si la Admin API falla, se degrada a
  // columna vacía (se registra el error) en vez de tumbar todo el listado.
  const loadLastSignIns = async (): Promise<Map<string, string | null>> => {
    const map = new Map<string, string | null>();
    const perPage = 1000;
    const maxPages = 10; // tope de seguridad: hasta 10.000 usuarios
    for (let page = 1; page <= maxPages; page += 1) {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (authError) {
        console.error(
          "[admin.users.list] listUsers falló; last_sign_in_at quedará vacío:",
          authError,
        );
        break;
      }
      const users = authData?.users ?? [];
      for (const authUser of users) {
        map.set(authUser.id, authUser.last_sign_in_at ?? null);
      }
      if (users.length < perPage) break;
    }
    return map;
  };

  // Perfiles (profiles) + último inicio de sesión (auth.users) en paralelo.
  const [{ data, error }, lastSignInById] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, nombre, rol_label, iniciales, role, zona, activo, created_at")
      .order("nombre"),
    loadLastSignIns(),
  ]);

  if (error) throw error;

  return (data ?? []).map((profile) => ({
    ...profile,
    role: profile.role as UserRole,
    last_sign_in_at: lastSignInById.get(String(profile.id)) ?? null,
  }));
}
