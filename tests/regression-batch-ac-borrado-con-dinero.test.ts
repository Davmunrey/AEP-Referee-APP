import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMissingTableError } from "@/server/services/supabase-helpers";

describe("distinguir «la tabla no existe» de «no he podido comprobarlo»", () => {
  it("reconoce la tabla ausente por código y por mensaje", () => {
    expect(isMissingTableError({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(
      isMissingTableError({ message: "Could not find the table in the schema cache" }),
    ).toBe(true);
  });

  it("no confunde un fallo de red o de permisos con una tabla ausente", () => {
    expect(isMissingTableError({ message: "connection reset" })).toBe(false);
    expect(isMissingTableError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingTableError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

// ── Guardas de borrado ──────────────────────────────────────────────────────
type QueryResult = { data: unknown; error: { code?: string; message: string } | null; count?: number };

let respond: (ctx: { table: string; op: string }) => QueryResult;
let writes: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select" };
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

describe("borrar un juez cuando no se puede comprobar su dinero", () => {
  it("no se borra si la consulta de liquidaciones falla", async () => {
    respond = ({ table }) =>
      table === "judge_compensation_claims"
        ? { data: null, error: { message: "connection reset" }, count: undefined }
        : { data: [], error: null };
    // Antes: cualquier error se leía como «no hay liquidaciones» y el borrado
    // seguía adelante, llevándose el dinero por la cascada de la FK.
    await expect(refereeService.deleteReferee("j1")).rejects.toThrow(/No se ha borrado nada/);
    expect(writes).toEqual([]);
  });

  it("con la tabla aún sin crear (024 sin aplicar) sí se borra", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") {
        return { data: null, error: { code: "42P01", message: "relation does not exist" } };
      }
      // Sin designaciones en ninguna tarima: ese corte lo cubre
      // regression-batch-ai.
      if (table === "roster_assignments") return { data: [], error: null };
      return { data: [{ id: "j1" }], error: null };
    };
    await expect(refereeService.deleteReferee("j1")).resolves.toBe(true);
    expect(writes).toContain("referees.delete");
  });
});
