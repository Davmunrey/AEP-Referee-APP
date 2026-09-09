import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Reemplazar censo» montaba la fila entera y la mandaba tal cual al UPDATE de
 * cada juez que ya existía, con `null` en cada columna que el Excel no tiene o
 * trae en blanco. Así que cada importación borraba datos escritos a mano en la
 * ficha: la licencia, SIEMPRE —no hay columna de licencia en el Excel, iba
 * fijada a `null`—; y el e-mail, el teléfono o las notas cada vez que la celda
 * estuviera vacía. Nadie lo veía: la fila seguía ahí, solo más vacía.
 */

type Call = { table: string; op: string; payload?: Record<string, unknown> };
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const result = () => {
        calls.push({ ...state });
        if (state.op !== "select") return { data: null, error: null };
        // Un juez ya existente, con excel_id 7.
        if (table === "referees") return { data: [{ id: "ref-7", excel_id: 7 }], error: null };
        return { data: [], error: null };
      };
      const q = {
        select: () => q,
        insert: (p: Record<string, unknown>) => ((state.op = "insert"), (state.payload = p), q),
        update: (p: Record<string, unknown>) => ((state.op = "update"), (state.payload = p), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: () => q,
        order: () => q,
        range: async () => result(),
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  }),
}));

const { importJudgesRegistryToSupabase } = await import("@/server/services/import-judges-registry");

const JUEZ_DEL_EXCEL = {
  excelId: 7,
  id: "ref-7",
  nombre: "Ana Ruiz",
  zona: "CENTRO",
  nivel: "Nacional",
  estado: "Activo",
  disp: true,
  eventos: 3,
  ultimo: "2026-03-01",
  // Celdas en blanco en el Excel: no deben pisar lo escrito a mano.
  email: undefined,
  telefono: undefined,
  notas: undefined,
};

beforeEach(() => {
  calls = [];
});

describe("actualizar un juez que ya existe", () => {
  it("no manda la licencia: el Excel no la conoce", async () => {
    await importJudgesRegistryToSupabase(
      { referees: [JUEZ_DEL_EXCEL], competitions: [], warnings: [] } as never,
      { replace: false },
    );
    const update = calls.find((c) => c.table === "referees" && c.op === "update");
    expect(update).toBeDefined();
    expect(update!.payload).not.toHaveProperty("licencia");
  });

  it("una celda vacía no borra el dato escrito a mano", async () => {
    await importJudgesRegistryToSupabase(
      { referees: [JUEZ_DEL_EXCEL], competitions: [], warnings: [] } as never,
      { replace: false },
    );
    const update = calls.find((c) => c.table === "referees" && c.op === "update")!;
    for (const columna of ["email", "telefono", "notas", "localidad", "genero", "antiguedad"]) {
      expect(update.payload, columna).not.toHaveProperty(columna);
    }
  });

  it("lo que el Excel sí trae se sigue actualizando", async () => {
    await importJudgesRegistryToSupabase(
      { referees: [{ ...JUEZ_DEL_EXCEL, telefono: "600111222" }], competitions: [], warnings: [] } as never,
      { replace: false },
    );
    const update = calls.find((c) => c.table === "referees" && c.op === "update")!;
    expect(update.payload).toMatchObject({ nombre: "Ana Ruiz", nivel: "Nacional", telefono: "600111222" });
  });

  it("un alta nueva sí lleva sus nulos: no hay nada que pisar", async () => {
    await importJudgesRegistryToSupabase(
      { referees: [{ ...JUEZ_DEL_EXCEL, excelId: 99, id: "ref-99" }], competitions: [], warnings: [] } as never,
      { replace: false },
    );
    const insert = calls.find((c) => c.table === "referees" && c.op === "insert");
    expect(insert).toBeDefined();
  });
});
