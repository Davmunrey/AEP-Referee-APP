import { beforeEach, describe, expect, it, vi } from "vitest";

// Ronda 3 de caza de bugs: la capa Supabase se tragaba errores de lectura y
// escritura y devolvía «no hay nada» en vez de fallar. Con service-role y RLS
// permisiva un fallo de red no es un dato vacío: es un dato desconocido, y
// tratarlo como vacío corrompía plantillas, coberturas y liquidaciones.

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

/** Lo que cada test decide devolver, por tabla+operación. */
let respond: (ctx: {
  table: string;
  op: string;
  filters: [string, unknown][];
  range?: [number, number];
}) => QueryResult;
let calls: { table: string; op: string; filters: [string, unknown][]; range?: [number, number] }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = {
        table,
        op: "select",
        filters: [] as [string, unknown][],
        range: undefined as [number, number] | undefined,
      };
      const finish = () => {
        calls.push({ ...state, filters: [...state.filters] });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: () => {
          state.op = "update";
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
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async (from: number, to: number) => {
          state.range = [from, to];
          return finish();
        },
        // Un update/delete sin `.select()` final se resuelve como thenable.
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import {
  fetchAllRowsIn,
  getCompetitionTemplate,
  loadRosterAssignmentData,
  persistCompetitionTemplate,
} from "@/server/services/supabase-helpers";
import { examsService } from "@/server/services/supabase-exams";
import { competitionService } from "@/server/services/supabase-competitions";

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fail = (message: string, code?: string): QueryResult => ({
  data: null,
  error: { message, code },
});

beforeEach(() => {
  calls = [];
  respond = () => ok(null);
});

describe("getCompetitionTemplate", () => {
  it("propaga un fallo de lectura en vez de fingir plantilla vacía", async () => {
    // Antes devolvía undefined y syncCompetitionCoverage reescribía la
    // competición como «0 confirmados / Borrador» sobre una tarima llena.
    respond = () => fail("network");
    await expect(getCompetitionTemplate("evt-001")).rejects.toThrow(/competitions\.template/);
  });

  it("devuelve undefined cuando la competición no existe (PGRST116)", async () => {
    respond = () => fail("Results contain 0 rows", "PGRST116");
    await expect(getCompetitionTemplate("evt-404")).resolves.toBeUndefined();
  });

  it("normaliza la plantilla cuando la lectura va bien", async () => {
    respond = () => ok({ template: [], tipo: "AEP-2" });
    await expect(getCompetitionTemplate("evt-001")).resolves.toEqual([]);
  });
});

describe("persistCompetitionTemplate", () => {
  it("falla si la escritura no llega a la base de datos", async () => {
    // Seguir adelante podaba asignaciones vivas contra una plantilla que la BD
    // nunca llegó a guardar.
    respond = () => fail("permission denied");
    await expect(persistCompetitionTemplate("evt-001", [])).rejects.toThrow(
      /competitions\.template/,
    );
  });
});

describe("loadRosterAssignmentData", () => {
  it("propaga el error en vez de devolver la tarima vacía", async () => {
    respond = () => fail("timeout");
    await expect(loadRosterAssignmentData("evt-001")).rejects.toThrow(/roster_assignments/);
  });
});

describe("fetchAllRowsIn", () => {
  it("no consulta nada con una lista de ids vacía", async () => {
    await expect(fetchAllRowsIn("judge_compensation_claims", "competition_id", [])).resolves.toEqual(
      [],
    );
    expect(calls).toHaveLength(0);
  });

  it("pagina hasta agotar las filas", async () => {
    const filas = Array.from({ length: 2300 }, (_, i) => ({ id: `c${i}` }));
    respond = ({ range }) => ok(filas.slice(range![0], range![1] + 1));
    const rows = await fetchAllRowsIn("judge_compensation_duty_lines", "claim_id", ["a"]);
    expect(rows).toHaveLength(2300);
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("trocea el filtro `in` para no reventar la longitud de la URL", async () => {
    respond = () => ok([]);
    const ids = Array.from({ length: 700 }, (_, i) => `evt-${i}`);
    await fetchAllRowsIn("judge_compensation_claims", "competition_id", ids);
    const chunks = calls.map((c) => (c.filters[0]![1] as string[]).length);
    expect(chunks).toEqual([300, 300, 100]);
  });

  it("propaga el error de una página en vez de devolver filas de menos", async () => {
    respond = () => fail("network");
    await expect(
      fetchAllRowsIn("judge_compensation_claims", "competition_id", ["evt-001"]),
    ).rejects.toThrow(/judge_compensation_claims/);
  });
});

describe("examsService.deleteExam / deleteReport", () => {
  it("devuelve false cuando el id no existe", async () => {
    // Un DELETE que no casa ninguna fila no es un error en PostgREST: sin
    // `.select()` la ruta respondía 200 para exámenes inexistentes.
    respond = () => ok([]);
    await expect(examsService.deleteExam("ex-404")).resolves.toBe(false);
    await expect(examsService.deleteReport("rep-404")).resolves.toBe(false);
  });

  it("devuelve true cuando borra una fila", async () => {
    respond = () => ok([{ id: "ex-1" }]);
    await expect(examsService.deleteExam("ex-1")).resolves.toBe(true);
  });
});

describe("examsService.getPromotions", () => {
  it("canonicaliza la zona en memoria: los códigos legados siguen visibles", async () => {
    // `promotion_requests.zona` es texto libre; un `.eq("zona", "CENTRO")`
    // ocultaba al delegado las solicitudes guardadas como "MAD".
    respond = () =>
      ok([
        { id: "pr-1", zona: "MAD", juez_id: "j1", estado: "pendiente" },
        { id: "pr-2", zona: "CAT", juez_id: "j2", estado: "pendiente" },
      ]);
    const list = await examsService.getPromotions({
      id: "u1",
      email: "d@d.es",
      role: "delegado_zona",
      zona: "CENTRO",
    } as never);
    expect(list.map((p) => p.id)).toEqual(["pr-1"]);
    // La consulta ya no lleva filtro de zona: se filtra después.
    expect(calls[0]!.filters).toEqual([]);
  });

  it("propaga el error de lectura", async () => {
    respond = () => fail("network");
    await expect(examsService.getPromotions()).rejects.toThrow(/promotion_requests/);
  });
});

describe("competitionService.createCompetition", () => {
  it("aborta si no puede leer las competiciones existentes", async () => {
    // Antes la lista vacía saltaba el dedupe y calculaba maxNum=0, así que
    // insertaba "evt-001" colisionando con el que ya existía.
    respond = ({ op }) => (op === "select" ? fail("network") : ok(null));
    await expect(
      competitionService.createCompetition({
        nombre: "Copa",
        tipo: "AEP-2",
        fecha: "2026-05-01",
        fechaFin: "2026-05-01",
        sede: "Madrid",
        sesiones: 1,
        requeridos: 3,
        zona: "MADRID",
      } as never),
    ).rejects.toThrow(/competitions/);
  });
});
