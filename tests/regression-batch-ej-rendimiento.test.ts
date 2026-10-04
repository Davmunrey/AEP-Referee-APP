import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Rendimiento (v2.14.2): cada pantalla pagaba dos viajes al servidor de Auth
// (middleware + sesión) antes de su primera consulta. La sesión verifica ahora
// el token con `getClaims()`; el perfil se sigue leyendo en cada petición.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
delete process.env.AEP_DOCS_CAPTURE;

let claims: Record<string, unknown> | null;
let claimsError: Error | null;
let getUserCalls: number;
let profile: Record<string, unknown> | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: claims ? { claims } : null, error: claimsError }),
      getUser: async () => {
        getUserCalls++;
        return { data: { user: null }, error: null };
      },
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: profile, error: null });
      return q;
    },
  }),
}));

const { getSession } = await import("@/lib/auth/session");

beforeEach(() => {
  claims = { sub: "u-1", email: "ana@aep.test", user_metadata: {}, app_metadata: {} };
  claimsError = null;
  getUserCalls = 0;
  profile = {
    id: "u-1",
    email: "ana@aep.test",
    nombre: "Ana Roa",
    rol_label: "Super Admin",
    iniciales: "AR",
    role: "super_admin",
    zona: null,
    activo: true,
  };
});

describe("sesión sin segundo viaje a Auth", () => {
  it("con un token verificado, la sesión sale de sus claims y del perfil", async () => {
    expect(await getSession()).toMatchObject({ id: "u-1", role: "super_admin" });
    expect(getUserCalls).toBe(0);
  });

  it("un token que no verifica no da sesión", async () => {
    claims = null;
    claimsError = new Error("invalid JWT");
    expect(await getSession()).toBeNull();
  });

  it("sin `sub` no hay usuario", async () => {
    claims = { email: "ana@aep.test" };
    expect(await getSession()).toBeNull();
  });

  it("una cuenta desactivada se queda fuera aunque su token siga vivo", async () => {
    profile = { ...profile, activo: false };
    expect(await getSession()).toBeNull();
  });
});

describe("despliegue", () => {
  it("las funciones corren en Londres, junto a la base de datos", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { regions?: string[] };
    expect(vercel.regions).toEqual(["lhr1"]);
  });
});
