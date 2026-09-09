import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El alta de una cuenta desde administración: crea el usuario de auth y su
 * perfil en la misma petición. Dos cosas que sus hermanas de la misma carpeta
 * —el reseteo y el borrado— ya tenían y esta no:
 *
 *  - el texto del proveedor de identidad salía tal cual al navegador
 *    (CWE-209), y con un 400 que culpaba a la petición de un fallo del
 *    proveedor;
 *  - la contraseña no tenía tope de longitud, y bcrypt solo usa los primeros
 *    72 bytes: se podía hacer hashear megabytes por petición.
 */

const requireApiUser = vi.fn();
const createUser = vi.fn();
const deleteUser = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q, eq: () => q, insert: () => q, update: () => q,
        upsert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r),
      };
      return q;
    },
    auth: { admin: { createUser, deleteUser } },
  }),
}));

const { POST } = await import("@/app/api/v1/admin/users/route");

const ADMIN = { id: "u1", role: "super_admin", nombre: "Admin" };
const cuenta = (extra: Record<string, unknown> = {}) => ({
  email: "nueva@aep.es",
  password: "unaclave8",
  nombre: "Nueva Cuenta",
  rolLabel: "Consulta",
  role: "solo_ver",
  ...extra,
});
const post = (payload: unknown) =>
  POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(payload) }));

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue(ADMIN);
  createUser.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
});

describe("lo que se le dice a quien da de alta", () => {
  it("un e-mail que ya tiene cuenta es un 409 con su motivo", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", status: 422, message: "A user with this email address has already been registered" },
    });
    const res = await post(cuenta());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: "Ya existe una cuenta con ese e-mail" });
  });

  it("cualquier otro fallo del proveedor sale genérico y sin su texto", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", status: 500, message: "gotrue: database error saving new user (relation auth.users)" },
    });
    const res = await post(cuenta());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No se pudo crear el usuario");
    expect(body.error).not.toMatch(/gotrue|auth\.users/);
  });

  it("una contraseña desmesurada se corta antes de llegar al proveedor", async () => {
    const res = await post(cuenta({ password: "x".repeat(5_000) }));
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("un alta normal sigue creando la cuenta", async () => {
    const res = await post(cuenta());
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledTimes(1);
  });
});
