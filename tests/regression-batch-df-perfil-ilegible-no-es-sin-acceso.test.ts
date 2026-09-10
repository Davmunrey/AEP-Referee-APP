import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { SessionProfileReadError } from "@/lib/auth/session-errors";

/**
 * No haber podido LEER el perfil no es «tu cuenta no tiene acceso».
 *
 * `supabase-js` no lanza: devuelve `{ data, error }`, y `maybeSingle()` da
 * `data: null, error: null` cuando simplemente no hay fila. El error se
 * descartaba, así que un corte de lectura entraba por la misma puerta que «este
 * usuario no tiene perfil»: se intentaba crearle uno, y si eso también fallaba
 * la sesión salía nula. De ahí:
 *
 *   - en el panel, una redirección a `/sign-in?estado=sin-acceso`, que le dice
 *     a alguien con acceso que su cuenta no lo tiene y lo manda a pedirle
 *     permisos al administrador que ya se los dio;
 *   - en la API, un 401, que el cliente traduce como «Tu sesión ha caducado.
 *     Vuelve a entrar» a quien acaba de entrar.
 *
 * Ninguna de las dos frases es verdad, y las dos mandan a hacer algo inútil.
 */

let lectura: { data: Record<string, unknown> | null; error: { message: string } | null };
let conteo: { count: number | null; error: unknown };
let upserted: Record<string, unknown> | null;

function adminFalso() {
  return {
    from: () => ({
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) return Promise.resolve(conteo);
        return {
          eq: () => ({
            maybeSingle: async () => lectura,
            single: async () => lectura,
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

const usuarioAuth = (): User =>
  ({ id: "auth-1", email: "juez@aep.test", user_metadata: {} }) as unknown as User;

const PERFIL_ACTIVO = {
  id: "auth-1",
  email: "juez@aep.test",
  nombre: "Ana Ruiz",
  rol_label: "Delegada de Zona",
  iniciales: "AR",
  role: "delegado_zona",
  zona: "CENTRO",
  activo: true,
};

beforeEach(() => {
  lectura = { data: null, error: null };
  conteo = { count: 5, error: null };
  upserted = null;
  vi.restoreAllMocks();
});

describe("cuando la lectura del perfil se cae", () => {
  it("se distingue del «no hay perfil» en vez de confundirse con él", async () => {
    const { resolveSessionUser } = await import("@/lib/auth/session");
    lectura = { data: null, error: { message: "connection reset by peer" } };
    await expect(resolveSessionUser(adminFalso(), usuarioAuth())).rejects.toBeInstanceOf(
      SessionProfileReadError,
    );
  });

  it("y no se intenta dar de alta un perfil que probablemente ya existe", async () => {
    const { resolveSessionUser } = await import("@/lib/auth/session");
    lectura = { data: null, error: { message: "timeout" } };
    await resolveSessionUser(adminFalso(), usuarioAuth()).catch(() => null);
    expect(upserted).toBeNull();
  });
});

describe("cuando la lectura va bien", () => {
  it("un perfil activo sigue dando sesión", async () => {
    const { resolveSessionUser } = await import("@/lib/auth/session");
    lectura = { data: PERFIL_ACTIVO, error: null };
    const sesion = await resolveSessionUser(adminFalso(), usuarioAuth());
    expect(sesion).toMatchObject({ id: "auth-1", role: "delegado_zona", zona: "CENTRO" });
  });

  it("un perfil inactivo sigue siendo «sin acceso», no un error", async () => {
    const { resolveSessionUser } = await import("@/lib/auth/session");
    lectura = { data: { ...PERFIL_ACTIVO, activo: false }, error: null };
    await expect(resolveSessionUser(adminFalso(), usuarioAuth())).resolves.toBeNull();
  });

  it("y sin fila se sigue intentando el alta de perfil", async () => {
    const { resolveSessionUser } = await import("@/lib/auth/session");
    lectura = { data: null, error: null };
    await resolveSessionUser(adminFalso(), usuarioAuth());
    expect(upserted).toMatchObject({ id: "auth-1", activo: false });
  });
});
