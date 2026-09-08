import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefereeAssignedError } from "@/lib/competitions/service-types";

type QueryResult = { data: unknown; error: { code?: string; message: string } | null; count?: number };
type Call = { table: string; op: string };

let respond: (ctx: Call) => QueryResult;
let writes: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        if (state.op !== "select") writes.push(`${table}.${state.op}`);
        return respond(state);
      };
      const q = {
        select: () => q,
        delete: () => ((state.op = "delete"), q),
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        eq: () => q,
        in: () => q,
        order: () => q,
        range: async () => finish(),
        single: async () => finish(),
        maybeSingle: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { refereeService } from "@/server/services/supabase-referees";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  writes = [];
});

describe("borrar un juez que sigue en una tarima", () => {
  it("dice en cuántos campeonatos está, en vez de «Juez no encontrado»", async () => {
    // `roster_assignments.referee_id` referencia a `referees(id)` sin ON DELETE:
    // la base rechazaba el borrado, el servicio devolvía false y la ruta
    // contestaba 404 sobre un juez que está a la vista en el directorio.
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") {
        return {
          data: [
            { competition_id: "c1" },
            { competition_id: "c1" },
            { competition_id: "c2" },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toThrow(
      /designado en 2 campeonatos/,
    );
    expect(writes).toEqual([]);
  });

  it("no borra si no puede comprobar las designaciones", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") {
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toThrow(/No se ha borrado nada/);
    expect(writes).toEqual([]);
  });

  it("si le asignan un hueco entre la comprobación y el borrado, tampoco es un 404", async () => {
    respond = ({ table, op }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "referees" && op === "delete") {
        return { data: null, error: { code: "23503", message: "violates foreign key constraint" } };
      }
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toBeInstanceOf(RefereeAssignedError);
  });

  it("sin designaciones ni liquidaciones sí se borra", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      return { data: [{ id: "j001" }], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).resolves.toBe(true);
    expect(writes).toContain("referees.delete");
  });
});
