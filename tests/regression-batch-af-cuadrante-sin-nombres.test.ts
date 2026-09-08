import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPETICION_ROLES_AEP1, PESAJE_ROLES, cloneRosterRoles } from "@/lib/mock-data";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
import { generateQuadrantExcel } from "@/lib/quadrant-excel";
import type { Competition, RosterSession } from "@/lib/types";
import * as XLSX from "xlsx";

const comp: Competition = {
  id: "c1",
  nombre: "II Campeonato Intend Power",
  tipo: "AEP-2",
  fecha: "2026-02-28",
  fechaFin: "2026-03-01",
  sede: "Venturada, Madrid",
  sesiones: 1,
  requeridos: 6,
  confirmados: 6,
  estado: "Completo",
  aprobacion: "pendiente",
};

const session: RosterSession = {
  sesion: "S1",
  nombre: "Sesión 1",
  dia: "Sábado 28 feb",
  categorias: [{ genero: "Hombres", pesos: "-83kg" }],
  horarioCompeticion: "10:00 - 13:30",
  horarioPesaje: "08:00 - 09:30",
  roles: cloneRosterRoles(COMPETICION_ROLES_AEP1),
  pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
};

describe("un juez asignado sin ficha en el censo no sale en blanco", () => {
  // La fila de rol se omite si todas sus celdas quedan vacías, así que un juez
  // designado cuya ficha ya no existe desaparecía del cuadrante: el hueco se
  // leía como «sin cubrir» en el documento que se lleva a la sede.
  it("el cuadrante HTML marca el hueco en vez de vaciarlo", () => {
    const html = generateQuadrantHtml(
      comp,
      [session],
      { S1_central_0: "j047" },
      () => undefined,
      {},
    );
    expect(html).toContain("j047");
    expect(html).toContain("sin ficha");
  });

  it("el cuadrante Excel hace lo mismo", () => {
    const buf = generateQuadrantExcel(
      comp,
      [session],
      { S1_central_0: "j047" },
      () => undefined,
      {},
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Sábado 28 feb"]!);
    expect(csv).toContain("j047 (sin ficha)");
  });
});

// ── Las rutas de exportación ────────────────────────────────────────────────
const requireApiUser = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/api/referee-scope", () => ({
  assertCompetitionInUserZone: async () => null,
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getRoster: vi.fn(),
    getCompetition: vi.fn(),
    getRefereesByIds: vi.fn(),
  },
}));

import { dataService } from "@/server/services";
import { GET as quadrantHtmlGet } from "@/app/api/v1/competitions/[id]/roster/quadrant/route";
import { GET as quadrantXlsxGet } from "@/app/api/v1/competitions/[id]/roster/quadrant.xlsx/route";

type Mock = ReturnType<typeof vi.fn>;
const getRoster = dataService.getRoster as unknown as Mock;
const getCompetition = dataService.getCompetition as unknown as Mock;
const getRefereesByIds = dataService.getRefereesByIds as unknown as Mock;

const context = { params: Promise.resolve({ id: "c1" }) };
const req = () => new Request("http://localhost/x");

beforeEach(() => {
  requireApiUser.mockReset();
  getRoster.mockReset();
  getCompetition.mockReset();
  getRefereesByIds.mockReset();
  requireApiUser.mockResolvedValue({
    id: "u1",
    nombre: "Admin",
    role: "super_admin",
    zona: "CENTRO",
  });
  getRoster.mockResolvedValue({
    template: [session],
    assignments: { S1_central_0: "r1" },
    flags: {},
  });
  getCompetition.mockResolvedValue(comp);
});

describe("exportar el cuadrante sin poder leer los nombres", () => {
  it("HTML: falla en alto en vez de devolver un cuadrante sin un solo juez", async () => {
    getRefereesByIds.mockRejectedValue(new Error("referees: connection reset"));
    const res = await quadrantHtmlGet(req(), context);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("jueces designados");
  });

  it("Excel: mismo corte", async () => {
    getRefereesByIds.mockRejectedValue(new Error("referees: connection reset"));
    const res = await quadrantXlsxGet(req(), context);
    expect(res.status).toBe(503);
  });

  it("con la lectura correcta sigue generando el documento", async () => {
    getRefereesByIds.mockResolvedValue(
      new Map([["r1", { id: "r1", nombre: "Ana Vázquez", nivel: "IPF Cat. 1" }]]),
    );
    const res = await quadrantHtmlGet(req(), context);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Ana Vázquez");
  });
});
