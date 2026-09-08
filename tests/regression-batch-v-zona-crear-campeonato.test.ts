import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: { getCompetitions: vi.fn(), createCompetition: vi.fn() },
}));

import { dataService } from "@/server/services";
import { POST } from "@/app/api/v1/competitions/route";

const createCompetition = dataService.createCompetition as unknown as ReturnType<typeof vi.fn>;

const body = {
  nombre: "Regional Centro",
  tipo: "AEP-2",
  fecha: "2026-05-09",
  fechaFin: "2026-05-10",
  sede: "Madrid",
  sesiones: 2,
  requeridos: 12,
};

function post(payload: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/v1/competitions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

beforeEach(() => {
  requireApiUser.mockReset();
  createCompetition.mockReset();
  createCompetition.mockImplementation(async (input: Record<string, unknown>) => ({
    id: "c1",
    ...input,
  }));
  requireApiUser.mockResolvedValue({
    id: "u1",
    nombre: "Delegado",
    role: "delegado_zona",
    zona: "CENTRO",
  });
});

describe("POST /competitions · zona del delegado", () => {
  it("acepta un alias de su propia zona", async () => {
    // Antes se comparaba en crudo: «2- CENTRO» —alias válido en el resto de la
    // aplicación— se rechazaba como si fuera otra zona.
    const res = await post({ ...body, zona: "2- CENTRO" });
    expect(res.status).toBe(200);
    expect(createCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ zona: "CENTRO" }),
    );
  });

  it("sigue rechazando una zona ajena", async () => {
    const res = await post({ ...body, zona: "ANDALUCIA" });
    expect(res.status).toBe(403);
    expect(createCompetition).not.toHaveBeenCalled();
  });

  it("sin zona en el cuerpo usa la del delegado, ya canónica", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(createCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ zona: "CENTRO" }),
    );
  });
});
