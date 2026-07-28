import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentsMap, Competition, RosterSession } from "@/lib/types";

// ── Mocks (hoisted) ─────────────────────────────────────────
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: vi.fn(async () => ({ id: "u1", nombre: "Admin", role: "super_admin" })),
  isSessionUser: () => true,
}));
vi.mock("@/lib/api/referee-scope", () => ({
  assertCompetitionInUserZone: vi.fn(async () => null),
}));
vi.mock("@/server/services", () => ({
  dataService: { getRoster: vi.fn(), getCompetition: vi.fn() },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        // La ruta filtra por los jueces asignados (.in("id", …)) antes de .returns().
        in: (_col: string, ids: string[]) => ({
          returns: async () => ({
            data: [
              { id: "r1", nombre: "Ana Vázquez", nivel: "IPF Cat. 1" },
              { id: "r2", nombre: "Isa García", nivel: "Nacional" },
            ].filter((r) => ids.includes(r.id)),
          }),
        }),
      }),
    }),
  }),
}));

import { dataService } from "@/server/services";
import { GET as quadrantGet } from "@/app/api/v1/competitions/[id]/roster/quadrant/route";
import { GET as xlsxGet } from "@/app/api/v1/competitions/[id]/roster/quadrant.xlsx/route";

const comp: Competition = {
  id: "c1", nombre: "II Campeonato Intend Power", tipo: "AEP-2",
  fecha: "2026-02-28", fechaFin: "2026-03-01", sede: "Venturada, Madrid",
  sesiones: 1, requeridos: 6, confirmados: 6, estado: "Completo", aprobacion: "pendiente",
};
const template: RosterSession[] = [{
  sesion: "S1", nombre: "Sesión 1", dia: "Sábado 28 feb",
  categorias: [{ genero: "Hombres", pesos: "-83kg" }],
  horarioCompeticion: "10:00 - 13:30", horarioPesaje: "08:00 - 09:30",
  roles: [{ rol: "Juez Central", slots: 1, key: "central" }, { rol: "Juez Lateral", slots: 2, key: "lateral" }],
  pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
}];
const assignments: AssignmentsMap = { S1_central_0: "r1", S1_lateral_0: "r2" };

const ctx = { params: Promise.resolve({ id: "c1" }) };
const getRoster = dataService.getRoster as unknown as ReturnType<typeof vi.fn>;
const getCompetition = dataService.getCompetition as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  getRoster.mockReset();
  getCompetition.mockReset();
});

describe("GET /roster/quadrant", () => {
  it("200 text/html con el cuadrante cuando existe roster+competición", async () => {
    getRoster.mockResolvedValue({ template, assignments, flags: {} });
    getCompetition.mockResolvedValue(comp);
    const res = await quadrantGet(new Request("http://localhost/api/v1/competitions/c1/roster/quadrant"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("II Campeonato Intend Power");
    expect(body).toContain("Ana Vázquez");
  });

  it("?print=1 inyecta auto-impresión", async () => {
    getRoster.mockResolvedValue({ template, assignments, flags: {} });
    getCompetition.mockResolvedValue(comp);
    const res = await quadrantGet(new Request("http://localhost/api/v1/competitions/c1/roster/quadrant?print=1"), ctx);
    const body = await res.text();
    expect(body).toContain('addEventListener("load"');
  });

  it("404 cuando la competición no existe", async () => {
    getRoster.mockResolvedValue({ template, assignments, flags: {} });
    getCompetition.mockResolvedValue(undefined);
    const res = await quadrantGet(new Request("http://localhost/api/v1/competitions/c1/roster/quadrant"), ctx);
    expect(res.status).toBe(404);
  });
});

describe("GET /roster/quadrant.xlsx", () => {
  it("200 con content-type spreadsheet y filename .xlsx", async () => {
    getRoster.mockResolvedValue({ template, assignments, flags: {} });
    getCompetition.mockResolvedValue(comp);
    const res = await xlsxGet(new Request("http://localhost/api/v1/competitions/c1/roster/quadrant.xlsx"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("404 cuando no hay roster", async () => {
    getRoster.mockResolvedValue(undefined);
    getCompetition.mockResolvedValue(comp);
    const res = await xlsxGet(new Request("http://localhost/api/v1/competitions/c1/roster/quadrant.xlsx"), ctx);
    expect(res.status).toBe(404);
  });
});
