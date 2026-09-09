import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guardar una liquidación sincroniza sus conceptos, y esa sincronización tiene
 * tres motivos escritos para quien lleva el dinero: no se pudieron leer los
 * conceptos, no se pudieron guardar, o quedaron conceptos que ya no le
 * corresponden. Ese último dice «revísala antes de aprobarla», y es justo el
 * que hay que leer.
 *
 * La ruta los pasaba por `jsonServerError`, que registra y devuelve un genérico:
 * los tres morían en «No se pudo guardar la compensación».
 */

const requireApiUser = vi.fn();
const updateCompensationClaim = vi.fn();
const calculateCompensationDistance = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: {
    updateCompensationClaim: (...a: unknown[]) => updateCompensationClaim(...a),
    calculateCompensationDistance: (...a: unknown[]) => calculateCompensationDistance(...a),
  },
}));

import { CompensationSyncError } from "@/lib/competitions/service-types";
import { PATCH as guardar } from "@/app/api/v1/competitions/[id]/compensation/[refereeId]/route";
import { POST as calcularRuta } from "@/app/api/v1/competitions/[id]/compensation/[refereeId]/distance/route";

const FINANCIERO = {
  id: "u1",
  nombre: "Fina Nanciera",
  iniciales: "FN",
  email: "fina@aep.test",
  rol: "Responsable financiero",
  role: "responsable_financiero_jueces",
};

const contexto = { params: Promise.resolve({ id: "evt-1", refereeId: "ref-1" }) };

function peticion(body: unknown) {
  return new Request("https://x/api", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiUser.mockResolvedValue(FINANCIERO);
});

describe("los motivos de la sincronización de conceptos llegan a quien los necesita", () => {
  it("el aviso de conceptos sobrantes se lee tal cual, no como un genérico", async () => {
    const motivo =
      "La liquidación se guardó, pero conceptos que ya no le corresponden siguen en la base. Revísala antes de aprobarla.";
    updateCompensationClaim.mockRejectedValue(new CompensationSyncError(motivo));
    const res = await guardar(peticion({ travelApproved: true }), contexto);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: motivo });
  });

  it("y también desde el cálculo de ruta, que guarda la distancia en la liquidación", async () => {
    const motivo = "No se pudieron guardar los conceptos de la liquidación. Vuelve a intentarlo.";
    calculateCompensationDistance.mockRejectedValue(new CompensationSyncError(motivo));
    const res = await calcularRuta(new Request("https://x/api", { method: "POST" }), contexto);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: motivo });
  });

  it("un fallo sin mensaje pensado para el usuario sigue saliendo genérico", async () => {
    updateCompensationClaim.mockRejectedValue(new Error("permission denied for table x"));
    const res = await guardar(peticion({ travelApproved: true }), contexto);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No se pudo guardar la compensación");
    expect(body.error).not.toMatch(/permission denied/);
  });

  it("una liquidación guardada sin incidencias sigue devolviendo el resultado", async () => {
    updateCompensationClaim.mockResolvedValue({ refereeId: "ref-1", totalAmount: 120 });
    const res = await guardar(peticion({ travelApproved: true }), contexto);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { totalAmount: 120 } });
  });
});
