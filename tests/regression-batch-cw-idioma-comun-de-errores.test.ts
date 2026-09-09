import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dos sitios que se salían del idioma común de errores de la aplicación.
 *
 * 1. Los dos cuadrantes leen tarima y campeonato con un `Promise.all` que
 *    estaba fuera de todo `try`. Esas lecturas lanzan cuando la base no
 *    responde, así que el fallo salía de Next como un 500 sin cuerpo y quien
 *    había pulsado «imprimir cuadrante» veía «Server error (500)». Sus
 *    hermanas `roster/export` y `roster/history` ya devolvían un JSON con su
 *    motivo.
 *
 * 2. Al crear una cuenta, una zona escrita pero no reconocida se contestaba
 *    con «Los delegados de zona requieren zona», con el campo relleno delante.
 *    El PATCH de esa misma carpeta ya lo distingue con «Zona no válida».
 */

const requireApiUser = vi.fn();
const getRoster = vi.fn();
const getCompetition = vi.fn();
const getRefereesByIds = vi.fn();
const assignReferee = vi.fn();
const setSlotFlags = vi.fn();
const createUser = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/api/referee-scope", () => ({
  assertCompetitionInUserZone: async () => null,
  stripRefereePII: (r: unknown) => r,
  stripRefereeListPII: (r: unknown) => r,
}));
vi.mock("@/lib/api/roster-mutation-guard", () => ({
  loadCompetitionForRosterWrite: async () => ({ id: "evt-1", zona: "CENTRO" }),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: (...a: unknown[]) => createUser(...a) } },
    from: () => {
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        upsert: () => q,
        eq: () => q,
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r),
      });
      return q;
    },
  }),
}));
vi.mock("@/server/services/admin-audit", () => ({ recordAccessChange: vi.fn(async () => {}) }));
vi.mock("@/server/services", () => ({
  dataService: {
    getRoster: (...a: unknown[]) => getRoster(...a),
    getCompetition: (...a: unknown[]) => getCompetition(...a),
    getRefereesByIds: (...a: unknown[]) => getRefereesByIds(...a),
    assignReferee: (...a: unknown[]) => assignReferee(...a),
    setSlotFlags: (...a: unknown[]) => setSlotFlags(...a),
  },
}));

const { RosterPaidClaimError } = await import("@/lib/competitions/service-types");
const { GET: cuadranteHtml } = await import(
  "@/app/api/v1/competitions/[id]/roster/quadrant/route"
);
const { GET: cuadranteXlsx } = await import(
  "@/app/api/v1/competitions/[id]/roster/quadrant.xlsx/route"
);
const { POST: crearCuenta } = await import("@/app/api/v1/admin/users/route");
const { POST: asignar } = await import(
  "@/app/api/v1/competitions/[id]/roster/assign/route"
);
const { PATCH: marcarHueco } = await import(
  "@/app/api/v1/competitions/[id]/roster/flags/route"
);

const ADMIN = {
  id: "u1",
  nombre: "Admin",
  iniciales: "AD",
  email: "a@aep.test",
  rol: "Super Admin",
  role: "super_admin" as const,
};

const ctx = { params: Promise.resolve({ id: "evt-1" }) };
const peticion = () => new Request("http://localhost/x");

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue(ADMIN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("los cuadrantes cuando la base no responde", () => {
  it("el HTML contesta con su motivo, no con un 500 sin cuerpo", async () => {
    getRoster.mockRejectedValue(new Error("roster_assignments: statement timeout"));
    getCompetition.mockResolvedValue({ id: "evt-1", zona: "CENTRO" });

    const res = await cuadranteHtml(peticion(), ctx);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "No se pudo cargar el cuadrante",
    });
  });

  it("y el Excel igual", async () => {
    getRoster.mockResolvedValue({ template: [], assignments: {}, flags: {} });
    getCompetition.mockRejectedValue(new Error("competitions: connection reset"));

    const res = await cuadranteXlsx(peticion(), ctx);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "No se pudo cargar el cuadrante",
    });
  });

  it("un campeonato que de verdad no está sigue siendo un 404", async () => {
    getRoster.mockResolvedValue(null);
    getCompetition.mockResolvedValue(null);

    const res = await cuadranteHtml(peticion(), ctx);
    expect(res.status).toBe(404);
  });
});

describe("crear una cuenta con una zona que no se reconoce", () => {
  const cuerpo = (zona: string) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "nuevo@aep.test",
        password: "unaclave8",
        nombre: "Nuevo Usuario",
        rolLabel: "Delegado de zona",
        role: "delegado_zona",
        zona,
      }),
    });

  it("lo dice como lo que es, no como si faltara la zona", async () => {
    const res = await crearCuenta(cuerpo("Levante"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Zona no válida" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("y si de verdad no viene zona, sigue diciendo que hace falta", async () => {
    const res = await crearCuenta(cuerpo(""));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Los delegados de zona requieren zona",
    });
  });
});

describe("sentar a un juez cuando la base no responde", () => {
  const cuerpo = (body: unknown) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("contesta con su motivo, no con un 500 sin cuerpo", async () => {
    assignReferee.mockRejectedValue(new Error("roster_assignments: statement timeout"));
    const res = await asignar(
      cuerpo({ slotKey: "S1_central_0", refereeId: "ref-1" }),
      ctx,
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "No se pudo guardar la asignación",
    });
  });

  it("y un juez con la liquidación pagada sale como 423, no como 500", async () => {
    assignReferee.mockRejectedValue(new RosterPaidClaimError("No se puede sustituir"));
    const res = await asignar(
      cuerpo({ slotKey: "S1_central_0", refereeId: "ref-1" }),
      ctx,
    );
    expect(res.status).toBe(423);
    await expect(res.json()).resolves.toMatchObject({ error: "No se puede sustituir" });
  });

  it("marcar un hueco tampoco se queda sin cuerpo", async () => {
    setSlotFlags.mockRejectedValue(new Error("roster_assignments: connection reset"));
    const res = await marcarHueco(
      new Request("http://localhost/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotKey: "S1_central_0", flags: { compartido: true } }),
      }),
      ctx,
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "No se pudo guardar la marca del hueco",
    });
  });
});
