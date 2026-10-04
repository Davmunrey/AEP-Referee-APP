import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Revisión del calendario del panel de inicio:
// - En Supabase, un delegado con la zona vacía o ilegible se quedaba sin
//   `.eq("zona")` y veía los campeonatos de toda España (el twin en memoria
//   sí filtraba). Ahora se filtra también tras la lectura, fail-closed.
// - «+N más» era texto sin enlace: el tercer campeonato de un día no se podía
//   abrir desde el calendario.

const competitions = [
  { id: "centro", nombre: "Open Centro", tipo: "AEP-3", fecha: "2099-03-01", fecha_fin: "2099-03-01", sede: "Madrid", sesiones: 1, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "CENTRO" },
  { id: "norte", nombre: "Open Norte", tipo: "AEP-3", fecha: "2099-03-01", fecha_fin: "2099-03-01", sede: "Bilbao", sesiones: 1, requeridos: 3, confirmados: 0, estado: "Borrador", aprobacion: "Sin propuesta", zona: "NORTE" },
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      // El doble ignora `.eq`: simula exactamente la consulta sin filtro.
      const result = () => {
        if (table === "competitions") return { data: competitions, error: null };
        return { data: [], error: null };
      };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "lt", "lte", "gt", "gte", "order", "limit", "is", "or", "not", "ilike", "contains", "in", "insert", "update", "upsert", "delete"]) q[m] = () => q;
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
});

const delegado = (zona: string) => ({
  id: "d", email: "d@aep.es", nombre: "Delegado", rol: "Delegado", iniciales: "DE", role: "delegado_zona" as const, zona,
});
const ids = (calendar: Record<string, { id: string }[]>) => [...new Set(Object.values(calendar).flat().map((e) => e.id))].sort();

describe("calendario del panel acotado a la zona (Supabase)", () => {
  it("un delegado con zona ilegible no ve campeonatos de ninguna zona", async () => {
    const res = await analyticsService.getDashboard(delegado("") as never);
    expect(ids(res.calendar)).toEqual([]);
  });

  it("un delegado de zona ve solo los de su zona aunque la consulta devuelva más", async () => {
    const res = await analyticsService.getDashboard(delegado("CENTRO") as never);
    expect(ids(res.calendar)).toEqual(["centro"]);
  });
});

describe("calendario operativo", () => {
  const src = readFileSync("src/components/dashboard/operational-calendar.tsx", "utf8");

  it("«+N más» abre un menú con enlaces a todos los campeonatos del día", () => {
    expect(src).toMatch(/<DropdownMenuTrigger[^>]*>\s*\+\{hidden\} más/);
    expect(src).toContain("href={`/competitions/${e.id}`}");
  });

  it("los campeonatos ya celebrados no conservan el color de estado", () => {
    expect(src).toContain("e.fechaFin < todayKey");
  });

  it("tiene una vista de agenda para móvil", () => {
    expect(src).toContain("md:hidden");
  });
});
