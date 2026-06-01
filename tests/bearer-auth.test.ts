import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getSession acepta dos transportes: token Bearer (app móvil nativa) y la
 * cookie de sesión Supabase SSR (web). Ambos deben producir el mismo
 * SessionUser, y un perfil inactivo nunca debe autenticarse.
 */

const headersGet = vi.fn<(name: string) => string | null>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGet }),
}));

const verifyAccessToken = vi.fn();
vi.mock("@/lib/supabase/token", () => ({
  verifyAccessToken: (t: string) => verifyAccessToken(t),
}));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));

let profileRow: Record<string, unknown> | null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow }) }) }),
    }),
  }),
}));

const cookieGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: cookieGetUser } }),
}));

import { getSession } from "@/lib/auth/session";

const activeProfile = {
  id: "u1",
  email: "juez@aep.es",
  nombre: "Ana Juez",
  rol_label: "Delegado de Zona",
  iniciales: "AJ",
  role: "delegado_zona",
  zona: "CENTRO",
  activo: true,
};

beforeEach(() => {
  headersGet.mockReset();
  verifyAccessToken.mockReset();
  cookieGetUser.mockReset();
  headersGet.mockReturnValue(null);
  cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
  profileRow = { ...activeProfile };
});

describe("getSession — transporte Bearer (app móvil)", () => {
  it("autentica con un token Bearer válido sin tocar la cookie", async () => {
    headersGet.mockImplementation((n) => (n === "authorization" ? "Bearer good.jwt.token" : null));
    verifyAccessToken.mockResolvedValue({ id: "u1" });

    const session = await getSession();

    expect(verifyAccessToken).toHaveBeenCalledWith("good.jwt.token");
    expect(cookieGetUser).not.toHaveBeenCalled();
    expect(session).toMatchObject({ id: "u1", role: "delegado_zona", email: "juez@aep.es" });
  });

  it("token inválido cae a la sesión por cookie", async () => {
    headersGet.mockImplementation((n) => (n === "authorization" ? "Bearer bad" : null));
    verifyAccessToken.mockResolvedValue(null);
    cookieGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const session = await getSession();

    expect(verifyAccessToken).toHaveBeenCalledWith("bad");
    expect(cookieGetUser).toHaveBeenCalled();
    expect(session).toMatchObject({ id: "u1" });
  });

  it("ignora cabeceras Authorization que no son Bearer", async () => {
    headersGet.mockImplementation((n) => (n === "authorization" ? "Basic abc123" : null));

    await getSession();

    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(cookieGetUser).toHaveBeenCalled();
  });

  it("rechaza a un usuario con perfil inactivo aunque el token sea válido", async () => {
    headersGet.mockImplementation((n) => (n === "authorization" ? "Bearer good.jwt" : null));
    verifyAccessToken.mockResolvedValue({ id: "u1" });
    profileRow = { ...activeProfile, activo: false };

    expect(await getSession()).toBeNull();
  });
});

describe("getSession — transporte cookie (web) intacto", () => {
  it("autentica con la cookie cuando no hay cabecera Authorization", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const session = await getSession();

    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(session).toMatchObject({ id: "u1", role: "delegado_zona" });
  });

  it("devuelve null sin token ni cookie", async () => {
    expect(await getSession()).toBeNull();
  });
});
