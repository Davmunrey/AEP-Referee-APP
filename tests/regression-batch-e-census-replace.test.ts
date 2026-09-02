import { beforeEach, describe, expect, it, vi } from "vitest";

// «Reemplazar el censo» borra jueces. Dos protecciones tienen que aguantar:
// los que están asignados en alguna tarima (FK RESTRICT) y los que tienen
// liquidaciones (FK CASCADE: borrarlos se lleva su dinero por delante).

type QueryResult = { data: unknown; error: { message: string } | null };
type Call = { table: string; op: string; range?: [number, number]; inValues?: unknown };

let calls: Call[];
let assignmentRows: Record<string, unknown>[];
let claimRows: Record<string, unknown>[];
let refereeRows: { id: string }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const result = (): QueryResult => {
        calls.push({ ...state });
        if (state.op === "delete" || state.op === "insert" || state.op === "update") {
          return { data: null, error: null };
        }
        if (table === "roster_assignments") {
          const [from, to] = state.range ?? [0, 999];
          return { data: assignmentRows.slice(from, to + 1), error: null };
        }
        if (table === "judge_compensation_claims") {
          const [from, to] = state.range ?? [0, 999];
          return { data: claimRows.slice(from, to + 1), error: null };
        }
        if (table === "referees") return { data: refereeRows, error: null };
        return { data: [], error: null };
      };
      const q = {
        select: () => q,
        insert: () => {
          state.op = "insert";
          return q;
        },
        update: () => {
          state.op = "update";
          return q;
        },
        upsert: () => {
          state.op = "upsert";
          return q;
        },
        delete: () => {
          state.op = "delete";
          return q;
        },
        eq: () => q,
        in: (_col: string, values: unknown) => {
          state.inValues = values;
          return q;
        },
        order: () => q,
        range: async (from: number, to: number) => {
          state.range = [from, to];
          return result();
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  }),
}));

import { importJudgesRegistryToSupabase } from "@/server/services/import-judges-registry";

const emptyParsed = { referees: [], competitions: [], warnings: [] };

function deletedIds(): string[] {
  const del = calls.find((c) => c.table === "referees" && c.op === "delete");
  return (del?.inValues as string[]) ?? [];
}

beforeEach(() => {
  calls = [];
  assignmentRows = [];
  claimRows = [];
  refereeRows = [];
});

describe("importJudgesRegistryToSupabase (replace)", () => {
  it("conserva a los jueces asignados aunque haya más de 1000 asignaciones", async () => {
    // El SELECT directo se comía el corte de 1000 filas de PostgREST: a partir
    // de ~25 campeonatos había jueces asignados que salían como borrables, el
    // DELETE en bloque chocaba con la FK y no se borraba nada. La lectura
    // paginada ve también al juez de la fila 1500.
    assignmentRows = Array.from({ length: 1500 }, (_, i) => ({
      competition_id: `evt-${Math.floor(i / 40)}`,
      slot_key: `S1__central__${i}`,
      referee_id: `ref-${i}`,
    }));
    refereeRows = [{ id: "ref-1499" }, { id: "ref-libre" }];

    const result = await importJudgesRegistryToSupabase(emptyParsed as never, { replace: true });

    expect(deletedIds()).toEqual(["ref-libre"]);
    expect(result.warnings.some((w) => w.includes("asignados en alguna tarima"))).toBe(true);
  });

  it("no borra a un juez con liquidaciones registradas", async () => {
    // judge_compensation_claims.referee_id es ON DELETE CASCADE: borrar al juez
    // se llevaba sus liquidaciones, incluidas las ya pagadas.
    claimRows = [{ referee_id: "ref-pagado" }];
    refereeRows = [{ id: "ref-pagado" }, { id: "ref-libre" }];

    const result = await importJudgesRegistryToSupabase(emptyParsed as never, { replace: true });

    expect(deletedIds()).toEqual(["ref-libre"]);
    expect(result.warnings.some((w) => w.includes("liquidaciones registradas"))).toBe(true);
  });

  it("sin protecciones que aplicar borra todo el censo anterior", async () => {
    refereeRows = [{ id: "ref-1" }, { id: "ref-2" }];
    const result = await importJudgesRegistryToSupabase(emptyParsed as never, { replace: true });
    expect(deletedIds()).toEqual(["ref-1", "ref-2"]);
    expect(result.warnings).toEqual([]);
  });
});
