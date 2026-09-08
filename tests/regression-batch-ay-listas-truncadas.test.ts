import { beforeEach, describe, expect, it, vi } from "vitest";

// PostgREST devuelve como mucho 1000 filas por petición, y una lectura
// truncada se ve exactamente igual que «esto es todo lo que hay». Tres listas
// que solo crecen —el censo, el calendario y el historial de exámenes— se
// leían de una sola vez: a partir de la fila 1001, el juez no aparecía en el
// desplegable de designación, el campeonato no salía en el calendario y el
// examen desaparecía del expediente. Sin ningún aviso.

type Rango = { from: number; to: number };
type Peticion = { table: string; orders: string[]; rangos: Rango[] };

const PAGINA = 1000;
let peticiones: Peticion[];
/** Cuántas filas tiene cada tabla en la base falsa. */
let filas: Record<string, number>;

function filasDe(table: string, from: number, to: number) {
  const total = filas[table] ?? 0;
  const out: Record<string, unknown>[] = [];
  for (let i = from; i <= Math.min(to, total - 1); i++) {
    out.push({
      id: `${table}-${String(i).padStart(5, "0")}`,
      nombre: `Fila ${i}`,
      zona: "CENTRO",
      nivel: "Nacional",
      estado: "Activo",
      disp: true,
      fecha: "2026-05-01",
      referee_id: "j1",
      tipo: "Recertificación",
      nivel_objetivo: "Nacional",
      resultado: "Apto",
    });
  }
  return out;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const registro: Peticion = { table, orders: [], rangos: [] };
      peticiones.push(registro);
      const q = {
        select: () => q,
        insert: () => q,
        update: () => q,
        upsert: () => q,
        delete: () => q,
        eq: () => q,
        in: () => q,
        ilike: () => q,
        lt: () => q,
        lte: () => q,
        gt: () => q,
        gte: () => q,
        not: () => q,
        limit: () => q,
        order: (col: string) => (registro.orders.push(col), q),
        range: (from: number, to: number) => {
          registro.rangos.push({ from, to });
          return Promise.resolve({ data: filasDe(table, from, to), error: null });
        },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({ data: filasDe(table, 0, PAGINA - 1), error: null }).then(resolve),
      };
      return q;
    },
  }),
}));

import { refereeService } from "@/server/services/supabase-referees";
import { competitionService } from "@/server/services/supabase-competitions";
import { examsService } from "@/server/services/supabase-exams";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  peticiones = [];
  filas = {};
});

function rangosDe(table: string): Rango[] {
  return peticiones.filter((p) => p.table === table).flatMap((p) => p.rangos);
}

describe("listas que pasan de 1000 filas", () => {
  it("el censo entero llega, no las primeras 1000", async () => {
    filas.referees = 1750;
    const jueces = await refereeService.getReferees();
    expect(jueces).toHaveLength(1750);
    // Dos páginas: [0..999] y [1000..1999].
    expect(rangosDe("referees")).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  it("y se ordena con desempate estable, para no duplicar ni saltarse filas", async () => {
    filas.referees = 10;
    await refereeService.getReferees();
    expect(peticiones.find((p) => p.table === "referees")?.orders).toEqual(["nombre", "id"]);
  });

  it("el calendario entero llega", async () => {
    filas.competitions = 1200;
    filas.roster_assignments = 0;
    const comps = await competitionService.getCompetitions();
    expect(comps).toHaveLength(1200);
    expect(peticiones.find((p) => p.table === "competitions")?.orders).toEqual(["fecha", "id"]);
  });

  it("el historial de exámenes entero llega", async () => {
    filas.referee_exams = 2400;
    const examenes = await examsService.getExams();
    expect(examenes).toHaveLength(2400);
    expect(rangosDe("referee_exams")).toHaveLength(3);
  });

  it("una lista justo en el límite no pide una página de más de la cuenta", async () => {
    // 1000 exactas: hay que pedir la segunda página para saber que no hay más,
    // pero no una tercera.
    filas.referees = 1000;
    const jueces = await refereeService.getReferees();
    expect(jueces).toHaveLength(1000);
    expect(rangosDe("referees")).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });
});
