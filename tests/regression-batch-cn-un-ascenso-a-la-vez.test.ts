import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Nada impedía abrir DOS solicitudes de ascenso del mismo juez.
 *
 * La ficha no enseña que ya hay una en cola, así que la segunda petición —del
 * mismo usuario al día siguiente, o del delegado de zona y el de jueces cada
 * uno por su lado— entraba tal cual. Aprobada la primera, el juez sube de
 * nivel; aprobada la segunda, `isRefereeLevelUpgrade` ya no la considera una
 * subida y el nivel no se toca, pero la solicitud queda «aprobada» con su
 * propio «aprobó ascenso a» en el registro: dos ascensos sobre el papel para
 * uno de verdad, en el historial que se mira para decidir el siguiente.
 */

type Fallo = { message: string; code?: string } | null;
const fallos: Record<string, Fallo> = {};
let pendientes: Array<{ id: string }> = [];
const insertados: Record<string, unknown>[] = [];

const FILA_JUEZ = { nombre: "Juez Uno", nivel: "Regional", eventos: 7 };

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  let esInsert = false;
  const lista = () => ({
    data: fallos[tabla] ? null : tabla === "promotion_requests" ? pendientes : [],
    error: fallos[tabla] ?? null,
  });
  const fila = () => ({
    data: fallos[tabla]
      ? null
      : tabla === "referees"
        ? FILA_JUEZ
        : esInsert
          ? insertados[insertados.length - 1]
          : null,
    error: fallos[tabla] ?? null,
  });
  Object.assign(self, {
    select: () => self,
    insert: (row: Record<string, unknown>) => {
      esInsert = true;
      insertados.push(row);
      return self;
    },
    eq: () => self,
    limit: async () => lista(),
    maybeSingle: async () => fila(),
    single: async () => fila(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(lista()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabla: string) => q(tabla) }),
}));

const requireApiUser = vi.fn();
const getReferee = vi.fn();
const createPromotion = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getReferee: (...a: unknown[]) => getReferee(...a),
    createPromotion: (...a: unknown[]) => createPromotion(...a),
  },
}));

const { examsService } = await import("@/server/services/supabase-exams");
const { POST: solicitar } = await import("@/app/api/v1/promotions/route");
const { PROMOCION_YA_PENDIENTE } = await import("@/lib/referee-levels");
const { UserFacingServiceError } = await import("@/lib/competitions/service-types");

const alta = {
  refereeId: "ref-1",
  toLevel: "Nacional" as const,
  zona: "CENTRO",
};

beforeEach(() => {
  for (const k of Object.keys(fallos)) delete fallos[k];
  pendientes = [];
  insertados.length = 0;
});

describe("solicitar el ascenso de un juez", () => {
  it("la primera solicitud entra", async () => {
    await expect(examsService.createPromotion(alta)).resolves.toMatchObject({
      refereeId: "ref-1",
      toLevel: "Nacional",
      status: "pendiente",
    });
    expect(insertados).toHaveLength(1);
  });

  it("la segunda, con una pendiente, se rechaza y no se inserta nada", async () => {
    pendientes = [{ id: "pro-1" }];
    await expect(examsService.createPromotion(alta)).rejects.toThrow(PROMOCION_YA_PENDIENTE);
    expect(insertados).toHaveLength(0);
  });

  it("y lo dice con un estado propio (409), no como un fallo del servidor", async () => {
    pendientes = [{ id: "pro-1" }];
    await examsService.createPromotion(alta).catch((err) => {
      expect(err).toBeInstanceOf(UserFacingServiceError);
      expect((err as InstanceType<typeof UserFacingServiceError>).status).toBe(409);
    });
    expect.assertions(2);
  });

  it("si no se puede comprobar si hay pendientes, no se inventa que no las hay", async () => {
    fallos.promotion_requests = { message: "statement timeout" };
    await expect(examsService.createPromotion(alta)).rejects.toThrow(/promotion_requests/);
    expect(insertados).toHaveLength(0);
  });
});

describe("la ruta que recibe la solicitud", () => {
  it("devuelve el motivo con 409, no un genérico de servidor", async () => {
    requireApiUser.mockResolvedValue({
      id: "u1",
      nombre: "Dele Gado",
      email: "d@aep.test",
      role: "delegado_jueces",
      zona: "CENTRO",
    });
    getReferee.mockResolvedValue({ id: "ref-1", zona: "CENTRO", nivel: "Regional" });
    createPromotion.mockRejectedValue(new UserFacingServiceError(PROMOCION_YA_PENDIENTE));

    const res = await solicitar(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refereeId: "ref-1", toLevel: "Nacional" }),
      }),
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: PROMOCION_YA_PENDIENTE });
  });
});
