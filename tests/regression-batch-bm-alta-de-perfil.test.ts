import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSessionUser } from "@/lib/auth/session";
import type { User } from "@supabase/supabase-js";

/**
 * `ensureProfile` solo se ejecuta para un usuario de auth SIN perfil, es decir,
 * alguien que se ha autenticado sin que un administrador le creara la cuenta:
 * el alta desde «Gestión de cuentas» crea el usuario de auth y su perfil
 * `activo` en la misma petición.
 *
 * Quién entra activo por esa vía decidía, hasta ahora, una bandera que escribe
 * el propio usuario.
 */

let perfiles: Record<string, unknown>[] = [];
let conteo: { count: number | null; error: unknown };
let upserted: Record<string, unknown> | null = null;

function adminFalso() {
  return {
    from: () => ({
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) return Promise.resolve(conteo);
        return {
          eq: () => ({
            maybeSingle: async () => ({ data: perfiles[0] ?? null }),
            single: async () => ({ data: perfiles[0] ?? null }),
          }),
        };
      },
      upsert: async (row: Record<string, unknown>) => {
        upserted = row;
        return { error: null };
      },
    }),
  } as never;
}

const usuarioAuth = (meta: Record<string, unknown>): User =>
  ({ id: "auth-1", email: "cualquiera@ejemplo.com", user_metadata: meta }) as unknown as User;

beforeEach(() => {
  perfiles = [];
  upserted = null;
  conteo = { count: 5, error: null }; // ya hay instalación
  vi.restoreAllMocks();
});

describe("una cuenta sin perfil no entra activa por decirlo ella misma", () => {
  it("`invited: true` en user_metadata ya no activa nada", async () => {
    // `user_metadata` lo escribe el propio usuario: se puede fijar al
    // registrarse (`signUp` con `options.data`) o después con `updateUser`,
    // contra la API pública y con la clave anónima, que viaja en el navegador.
    await resolveSessionUser(adminFalso(), usuarioAuth({ invited: true }));
    expect(upserted).toMatchObject({ activo: false, role: "solo_ver" });
  });

  it("ni con el nombre puesto ni con cualquier otra bandera inventada", async () => {
    await resolveSessionUser(
      adminFalso(),
      usuarioAuth({ invited: true, full_name: "Alguien", role: "super_admin", activo: true }),
    );
    expect(upserted).toMatchObject({ activo: false, role: "solo_ver" });
    // El nombre sí se usa, que para eso está el metadata.
    expect(upserted).toMatchObject({ nombre: "Alguien" });
  });

  it("el primer perfil de la instalación sí nace activo y como super admin", async () => {
    conteo = { count: 0, error: null };
    await resolveSessionUser(adminFalso(), usuarioAuth({ full_name: "Fundador" }));
    expect(upserted).toMatchObject({ activo: true, role: "super_admin" });
  });

  it("si no se puede contar los perfiles, no se crea ninguno", async () => {
    // Con `count` nulo se leía como «no hay perfiles todavía» y cualquiera que
    // entrase durante un fallo transitorio se daba de alta como super admin.
    conteo = { count: null, error: null };
    const out = await resolveSessionUser(adminFalso(), usuarioAuth({}));
    expect(out).toBeNull();
    expect(upserted).toBeNull();
  });

  it("un perfil que ya existe y está inactivo no da sesión", async () => {
    perfiles = [{ id: "auth-1", email: "x@y.z", nombre: "X", role: "solo_ver", activo: false }];
    const out = await resolveSessionUser(adminFalso(), usuarioAuth({ invited: true }));
    expect(out).toBeNull();
    expect(upserted).toBeNull();
  });
});
