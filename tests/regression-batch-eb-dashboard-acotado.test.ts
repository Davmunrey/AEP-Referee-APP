import { beforeEach, describe, expect, it, vi } from "vitest";

// El panel de inicio descargaba en cada visita todos los campeonatos con su
// plantilla y todas las asignaciones de todas las temporadas. Ahora pide la
// plantilla y las asignaciones solo de los campeonatos vigentes.

type Call = { table: string; select?: string; inFilter?: [string, unknown[]] };
let calls: Call[];

const competitions = [
  { id: "pasado", nombre: "Open 2020", tipo: "AEP-3", fecha: "2020-03-01", fecha_fin: "2020-03-01", sede: "X", sesiones: 1, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "CENTRO" },
  { id: "futuro", nombre: "Open 2099", tipo: "AEP-3", fecha: "2099-03-01", fecha_fin: "2099-03-01", sede: "Y", sesiones: 1, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "CENTRO" },
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const call: Call = { table };
      calls.push(call);
      const result = () => {
        if (table === "competitions" && call.select?.includes("template")) {
          return { data: [{ id: "futuro", template: [], tipo: "AEP-3" }], error: null };
        }
        if (table === "competitions") return { data: competitions, error: null };
        return { data: [], error: null };
      };
      const q: Record<string, unknown> = {};
      for (const m of ["eq", "neq", "lt", "lte", "gt", "gte", "order", "limit", "is", "or", "not", "ilike", "contains"]) q[m] = () => q;
      q.select = (cols?: string) => ((call.select = cols), q);
      q.in = (col: string, vals: unknown[]) => ((call.inFilter = [col, vals]), q);
      q.update = () => q;
      q.insert = () => q;
      q.upsert = () => q;
      q.delete = () => q;
      q.range = async () => result();
      q.single = async () => ({ data: null, error: null });
      q.maybeSingle = async () => ({ data: null, error: null });
      q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return q;
    },
  }),
}));

import { analyticsService } from "@/server/services/supabase-analytics";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("panel de inicio acotado a lo vigente", () => {
  it("plantilla y asignaciones solo de los campeonatos no celebrados", async () => {
    const res = await analyticsService.getDashboard({
      id: "u", email: "a@b.es", nombre: "Admin", rol: "Super Admin", iniciales: "AD", role: "super_admin",
    });
    const lista = calls.find((c) => c.table === "competitions" && !c.select?.includes("template"));
    expect(lista?.select).not.toContain("template");
    const plantillas = calls.find((c) => c.table === "competitions" && c.select?.includes("template"));
    expect(plantillas?.inFilter).toEqual(["id", ["futuro"]]);
    const asignaciones = calls.filter((c) => c.table === "roster_assignments");
    expect(asignaciones.length).toBeGreaterThan(0);
    for (const a of asignaciones) expect(a.inFilter).toEqual(["competition_id", ["futuro"]]);
    // El calendario conserva el histórico completo.
    expect(Object.values(res.calendar).flat().map((e) => e.label)).toEqual(
      expect.arrayContaining(["Open 2020", "Open 2099"]),
    );
  });
});
