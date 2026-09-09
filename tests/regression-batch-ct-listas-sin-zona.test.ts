import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Continuación de `cs-delegado-sin-zona`, esta vez en las LECTURAS de lista.
 *
 * La misma forma —`user.role === "delegado_zona" && user.zona`— aparecía en el
 * listado de campeonatos, el de propuestas de aprobación, el de ascensos, el
 * de exámenes y el de informes. Sin zona en el perfil, la condición es falsa,
 * no se filtra nada y el delegado ve el país entero: notas de examen,
 * contenido de informes y las propuestas de todas las zonas.
 *
 * Se conserva la comparación permisiva donde la había —esas columnas son texto
 * libre con códigos legados y compararlas en crudo escondía las filas
 * antiguas a su propio delegado—; lo que cambia es que sin zona no se pasa.
 */

type Fila = Record<string, unknown>;
const filas: Record<string, Fila[]> = {};

function q(tabla: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  let zonaFiltro: string | undefined;
  const resultado = () => ({
    data: (filas[tabla] ?? []).filter(
      (f) => zonaFiltro === undefined || String(f.zona ?? "") === zonaFiltro,
    ),
    error: null,
  });
  Object.assign(self, {
    select: () => self,
    eq: (col: string, val: unknown) => {
      if (col === "zona") zonaFiltro = String(val);
      return self;
    },
    in: () => self,
    gte: () => self,
    lt: () => self,
    order: () => self,
    range: () => self,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabla: string) => q(tabla) }),
}));

const { examsService } = await import("@/server/services/supabase-exams");
const { rosterService } = await import("@/server/services/supabase-roster");

const SIN_ZONA = {
  id: "u1",
  nombre: "Dele Gado",
  iniciales: "DG",
  email: "d@aep.test",
  rol: "Delegado de zona",
  role: "delegado_zona" as const,
  zona: "",
};
const CON_ZONA = { ...SIN_ZONA, zona: "CENTRO" };
const SUPER_ADMIN = { ...SIN_ZONA, role: "super_admin" as const, zona: undefined };

beforeEach(() => {
  for (const k of Object.keys(filas)) delete filas[k];
  filas.promotion_requests = [
    { id: "pro-1", referee_id: "r1", referee_name: "A", zona: "CENTRO", status: "pendiente", from_level: "Regional", to_level: "Nacional", submitted_at: "2026-01-01", eventos_completados: 3 },
    { id: "pro-2", referee_id: "r2", referee_name: "B", zona: "NORTE", status: "pendiente", from_level: "Regional", to_level: "Nacional", submitted_at: "2026-01-01", eventos_completados: 3 },
  ];
  filas.referee_reports = [
    { id: "rep-1", zona: "CENTRO", titulo: "A", contenido: "x", tipo: "Juez", subject_type: "juez", created_at: "2026-01-01" },
    { id: "rep-2", zona: "NORTE", titulo: "B", contenido: "y", tipo: "Juez", subject_type: "juez", created_at: "2026-01-01" },
  ];
  filas.approval_proposals = [
    { id: "apr-1", zona: "CENTRO", status: "pendiente", competition_id: "evt-1", competition_name: "A", submitted_at: "2026-01-01", assignments: {} },
    { id: "apr-2", zona: "NORTE", status: "pendiente", competition_id: "evt-2", competition_name: "B", submitted_at: "2026-01-01", assignments: {} },
  ];
});

describe("un delegado de zona sin zona asignada no ve listas de nadie", () => {
  it("ascensos", async () => {
    await expect(examsService.getPromotions(SIN_ZONA)).resolves.toEqual([]);
  });

  it("informes", async () => {
    await expect(examsService.getReports(undefined, SIN_ZONA)).resolves.toEqual([]);
  });

  it("propuestas de aprobación", async () => {
    await expect(rosterService.getApprovals(SIN_ZONA)).resolves.toEqual([]);
  });
});

describe("con la zona bien puesta sigue viendo lo suyo", () => {
  it("solo los ascensos de su zona", async () => {
    const list = await examsService.getPromotions(CON_ZONA);
    expect(list.map((p) => p.zona)).toEqual(["CENTRO"]);
  });

  it("solo los informes de su zona", async () => {
    const list = await examsService.getReports(undefined, CON_ZONA);
    expect(list.map((r) => r.zona)).toEqual(["CENTRO"]);
  });

  it("solo las propuestas de su zona", async () => {
    const list = await rosterService.getApprovals(CON_ZONA);
    expect(list.map((a) => a.zona)).toEqual(["CENTRO"]);
  });
});

describe("quien no tiene restricción sigue viéndolo todo", () => {
  it("ascensos, informes y propuestas", async () => {
    await expect(examsService.getPromotions(SUPER_ADMIN)).resolves.toHaveLength(2);
    await expect(examsService.getReports(undefined, SUPER_ADMIN)).resolves.toHaveLength(2);
    await expect(rosterService.getApprovals(SUPER_ADMIN)).resolves.toHaveLength(2);
  });
});
