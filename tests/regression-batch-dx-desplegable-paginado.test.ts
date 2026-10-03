import { beforeEach, describe, expect, it, vi } from "vitest";

// El desplegable de campeonatos (informes, ficha de juez) leía el calendario
// sin paginar: a partir de 1000 filas PostgREST cortaba la lista sin avisar.

const TOTAL = 1005;
const rangos: Array<[number, number]> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        order: () => q,
        range: async (from: number, to: number) => {
          rangos.push([from, to]);
          const data = [];
          for (let i = from; i <= Math.min(to, TOTAL - 1); i++) {
            data.push({ id: `c${i}`, nombre: `Campeonato ${i}`, zona: i % 2 ? "CENTRO" : "ANDALUCIA" });
          }
          return { data, error: null };
        },
      };
      return q;
    },
  }),
}));

import { competitionService } from "@/server/services/supabase-competitions";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  rangos.length = 0;
});

describe("desplegable de campeonatos", () => {
  it("devuelve más de 1000 campeonatos recorriendo todas las páginas", async () => {
    const list = await competitionService.getCompetitionOptions();
    expect(list).toHaveLength(TOTAL);
    expect(list.at(-1)).toEqual({ id: "c1004", nombre: "Campeonato 1004" });
    expect(rangos.length).toBeGreaterThan(1);
  });

  it("un delegado sigue viendo solo su zona", async () => {
    const list = await competitionService.getCompetitionOptions({
      id: "u1",
      email: "d@x.es",
      nombre: "Delegado",
      rol: "Delegado",
      iniciales: "DE",
      role: "delegado_zona",
      zona: "CENTRO",
    });
    expect(list).toHaveLength(502);
  });
});
