import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Competition } from "@/lib/types";

const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: { getCompetition: vi.fn(), removeCompetitionAvailability: vi.fn() },
}));

import { dataService } from "@/server/services";
import { DELETE } from "@/app/api/v1/competitions/[id]/availability/[refereeId]/route";

const comp: Competition = {
  id: "c1", nombre: "Test", tipo: "AEP-2", fecha: "2026-06-01", fechaFin: "2026-06-01",
  sede: "Madrid", sesiones: 1, requeridos: 6, confirmados: 0, estado: "Borrador", aprobacion: "—",
  zona: "CENTRO",
};
const ctx = { params: Promise.resolve({ id: "c1", refereeId: "r1" }) };
const getCompetition = dataService.getCompetition as unknown as ReturnType<typeof vi.fn>;
const removeAvail = dataService.removeCompetitionAvailability as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  requireApiUser.mockReset();
  getCompetition.mockReset();
  removeAvail.mockReset();
  removeAvail.mockResolvedValue(undefined);
});

describe("DELETE /competitions/:id/availability/:refereeId", () => {
  it("403 para rol solo_ver", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", nombre: "V", role: "solo_ver", zona: "CENTRO" });
    const res = await DELETE(new Request("http://localhost/x"), ctx);
    expect(res.status).toBe(403);
    expect(removeAvail).not.toHaveBeenCalled();
  });

  it("404 cuando la competición no existe", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", nombre: "A", role: "super_admin", zona: "CENTRO" });
    getCompetition.mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://localhost/x"), ctx);
    expect(res.status).toBe(404);
  });

  it("403 si delegado de zona intenta otra zona", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", nombre: "D", role: "delegado_zona", zona: "NORTE" });
    getCompetition.mockResolvedValue(comp); // comp.zona = CENTRO
    const res = await DELETE(new Request("http://localhost/x"), ctx);
    expect(res.status).toBe(403);
    expect(removeAvail).not.toHaveBeenCalled();
  });

  it("200 para super_admin", async () => {
    requireApiUser.mockResolvedValue({ id: "u1", nombre: "A", role: "super_admin", zona: "CENTRO" });
    getCompetition.mockResolvedValue(comp);
    const res = await DELETE(new Request("http://localhost/x"), ctx);
    expect(res.status).toBe(200);
    expect(removeAvail).toHaveBeenCalledWith("c1", "r1");
  });
});
