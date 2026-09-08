import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string; payload?: Record<string, unknown> };

let respond: (ctx: Call) => QueryResult;
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        calls.push({ ...state });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: (payload: Record<string, unknown>) => {
          state.op = "update";
          state.payload = payload;
          return q;
        },
        insert: (payload: Record<string, unknown>) => {
          state.op = "insert";
          state.payload = payload;
          return q;
        },
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: (_col: string, ids: string[]) => {
          state.payload = { ids };
          return q;
        },
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

import { importJudgesRegistryToSupabase } from "@/server/services/import-judges-registry";
import type { ParsedJudgesRegistry } from "@/lib/judges-registry/parse-xlsx";

const JUEZ_SANCIONADO = {
  id: "j-57",
  excelId: 57,
  nombre: "Luis Juez",
  zona: "CENTRO",
  nivel: "Nacional" as const,
  estado: "Activo" as const,
  disp: true,
  eventos: 3,
  ultimo: "—",
};

function registro(): ParsedJudgesRegistry {
  return {
    referees: [JUEZ_SANCIONADO],
    competitions: [],
    warnings: [],
  } as unknown as ParsedJudgesRegistry;
}

function baseRespond({ table, op }: Call): QueryResult {
  if (table === "referees" && op === "select") {
    return { data: [{ id: "j-57", excel_id: 57, estado: "Sancionado" }], error: null };
  }
  return { data: [], error: null };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("reimportar el censo no puede levantar una sanción", () => {
  it("con sanción viva, el Excel actualiza los datos pero no el estado", async () => {
    // La columna «activo» del Excel devolvía al juez a Activo/disponible con la
    // sanción todavía viva debajo: la misma puerta trasera que el PATCH de la
    // ficha sí cierra.
    respond = (ctx) => {
      if (ctx.table === "referee_sanctions") {
        return {
          data: [{ referee_id: "j-57", status: "activa", fecha_fin: "2099-01-01" }],
          error: null,
        };
      }
      return baseRespond(ctx);
    };

    const result = await importJudgesRegistryToSupabase(registro());
    const update = calls.find((c) => c.table === "referees" && c.op === "update");
    expect(update?.payload).toBeDefined();
    expect(update?.payload).not.toHaveProperty("estado");
    expect(update?.payload).not.toHaveProperty("disp");
    // Lo demás sí se actualiza.
    expect(update?.payload).toMatchObject({ nombre: "Luis Juez", nivel: "Nacional" });
    expect(result.warnings.some((w) => /conservan su estado/.test(w))).toBe(true);
  });

  it("sin sanción viva, el estado del Excel se aplica", async () => {
    respond = (ctx) =>
      ctx.table === "referee_sanctions" ? { data: [], error: null } : baseRespond(ctx);

    await importJudgesRegistryToSupabase(registro());
    const update = calls.find((c) => c.table === "referees" && c.op === "update");
    expect(update?.payload).toMatchObject({ estado: "Activo", disp: true });
  });

  it("la actualización nunca reescribe la clave primaria", async () => {
    respond = (ctx) =>
      ctx.table === "referee_sanctions" ? { data: [], error: null } : baseRespond(ctx);

    await importJudgesRegistryToSupabase(registro());
    const update = calls.find((c) => c.table === "referees" && c.op === "update");
    expect(update?.payload).not.toHaveProperty("id");
  });

  it("«reemplazar censo» no borra a quien tiene sanciones registradas", async () => {
    // referee_sanctions cuelga del juez con ON DELETE CASCADE (014:7): borrarlo
    // se llevaba su historial disciplinario en una reimportación de rutina.
    respond = (ctx) => {
      if (ctx.table === "referee_sanctions") {
        return {
          data: [{ referee_id: "j-57", status: "cumplida", fecha_fin: "2020-01-01" }],
          error: null,
        };
      }
      return baseRespond(ctx);
    };

    const result = await importJudgesRegistryToSupabase(registro(), { replace: true });
    const del = calls.find((c) => c.table === "referees" && c.op === "delete");
    expect(del).toBeUndefined();
    expect(result.warnings.some((w) => /historial disciplinario/.test(w))).toBe(true);
  });

  it("si no se puede comprobar quién está sancionado, no se toca el censo", async () => {
    respond = (ctx) =>
      ctx.table === "referee_sanctions"
        ? { data: null, error: { message: "connection reset" } }
        : baseRespond(ctx);

    await expect(importJudgesRegistryToSupabase(registro())).rejects.toThrow(
      /No se ha tocado el censo/,
    );
    expect(calls.some((c) => c.op !== "select")).toBe(false);
  });

  it("con la migración 014 sin aplicar, la importación sigue adelante", async () => {
    respond = (ctx) =>
      ctx.table === "referee_sanctions"
        ? { data: null, error: { code: "42P01", message: "relation does not exist" } }
        : baseRespond(ctx);

    const result = await importJudgesRegistryToSupabase(registro());
    expect(result.refereesUpdated).toBe(1);
  });
});
