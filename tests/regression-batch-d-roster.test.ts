import { beforeEach, describe, expect, it, vi } from "vitest";

// Ronda 5: tarima y compensación. Mismo patrón de la ronda 3 (un cliente
// Supabase falso encadenable), aplicado a las rutas donde un error tragado o
// una zona sin canonicalizar tiene consecuencias sobre datos ya guardados.

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string; filters: [string, unknown][]; payload?: unknown };

let respond: (ctx: Call) => QueryResult;
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select", filters: [] };
      const finish = () => {
        calls.push({ ...state, filters: [...state.filters] });
        return respond(state);
      };
      const q = {
        select: () => q,
        insert: (payload: unknown) => {
          state.op = "insert";
          state.payload = payload;
          return q;
        },
        update: (payload: unknown) => {
          state.op = "update";
          state.payload = payload;
          return q;
        },
        upsert: (payload: unknown) => {
          state.op = "upsert";
          state.payload = payload;
          return q;
        },
        delete: () => {
          state.op = "delete";
          return q;
        },
        eq: (col: string, value: unknown) => {
          state.filters.push([col, value]);
          return q;
        },
        in: (col: string, values: unknown) => {
          state.filters.push([col, values]);
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

import { rosterService } from "@/server/services/supabase-roster";

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fail = (message: string): QueryResult => ({ data: null, error: { message } });

beforeEach(() => {
  calls = [];
  respond = () => ok(null);
});

describe("rosterService.getApprovals", () => {
  it("canonicaliza la zona: las propuestas con códigos legados siguen visibles", async () => {
    // `approval_proposals.zona` es texto libre — la migración 013 solo normalizó
    // referees, competitions y profiles — así que un `.eq("zona", "CENTRO")`
    // dejaba fuera las propuestas guardadas como "MAD" y el delegado veía su
    // bandeja vacía.
    respond = () =>
      ok([
        { id: "apr-1", zona: "MAD", competition_id: "evt-1", status: "pendiente", assignments: {} },
        { id: "apr-2", zona: "CAT", competition_id: "evt-2", status: "pendiente", assignments: {} },
      ]);
    const list = await rosterService.getApprovals({
      id: "u1",
      email: "d@d.es",
      role: "delegado_zona",
      zona: "CENTRO",
    } as never);
    expect(list.map((a) => a.id)).toEqual(["apr-1"]);
    expect(calls[0]!.filters).toEqual([]);
  });

  it("propaga el error de lectura en vez de devolver la bandeja vacía", async () => {
    respond = () => fail("network");
    await expect(rosterService.getApprovals()).rejects.toThrow(/approval_proposals/);
  });
});

describe("rosterService.clearSlot", () => {
  it("falla si el borrado no llega a la base de datos", async () => {
    // Antes seguía adelante y la ruta respondía 200 con el juez todavía puesto.
    respond = ({ op }) => (op === "delete" ? fail("permission denied") : ok([]));
    await expect(rosterService.clearSlot("evt-1", "S1__ARB__1", "Ana")).rejects.toThrow(
      /roster_assignments/,
    );
  });
});

describe("rosterService.saveCompetitionTemplate", () => {
  const getComp = async () =>
    ({ id: "evt-1", nombre: "Copa", tipo: "AEP-2", requeridos: 3 }) as never;

  it("aborta si no puede listar las asignaciones actuales", async () => {
    // Tragarse esa lectura dejaba filas huérfanas en la base de datos: al
    // recrear más adelante una sesión con el mismo código, el juez que ocupaba
    // aquel hueco reaparecía asignado.
    respond = ({ table, op }) =>
      table === "roster_assignments" && op === "select" ? fail("network") : ok(null);
    await expect(
      rosterService.saveCompetitionTemplate("evt-1", [], "Ana", getComp),
    ).rejects.toThrow(/roster_assignments/);
  });

  it("aborta si la plantilla no se puede guardar", async () => {
    respond = ({ table, op }) =>
      table === "competitions" && op === "update" ? fail("permission denied") : ok(null);
    await expect(
      rosterService.saveCompetitionTemplate("evt-1", [], "Ana", getComp),
    ).rejects.toThrow(/competitions\.template/);
  });
});
