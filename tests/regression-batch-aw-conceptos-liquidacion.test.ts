import { beforeEach, describe, expect, it, vi } from "vitest";

// Recalcular una liquidación reescribe sus conceptos («duty lines»). El
// borrado previo iba sin comprobar el resultado: `supabase-js` no lanza,
// devuelve `{ error }`. Si fallaba, las líneas viejas sobrevivían con la
// cabecera ya guardada, y el recibo enseñaba importes que la cabecera ya no
// cuenta.

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string; payload?: unknown };

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
        update: (p: unknown) => ((state.op = "update"), (state.payload = p), q),
        insert: (p: unknown) => ((state.op = "insert"), (state.payload = p), q),
        upsert: (p: unknown) => ((state.op = "upsert"), (state.payload = p), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: (_c: string, v: unknown) => ((state.payload = v), q),
        order: () => q,
        limit: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { compensationService } from "@/server/services/supabase-compensation";

const CLAIM_ID = "cmp-c1-j1";

const competitionRow = {
  id: "c1",
  nombre: "Copa",
  tipo: "AEP-2",
  fecha: "2026-03-21",
  fecha_fin: "2026-03-21",
  sede: "Madrid",
  zona: "CENTRO",
  sesiones: 1,
  requeridos: 1,
  confirmados: 1,
  estado: "Completo",
  aprobacion: "Aprobado",
  template: [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Sábado",
      categorias: [],
      horarioCompeticion: "10:00 - 13:00",
      horarioPesaje: "08:00 - 09:30",
      roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
      pesajeRoles: [],
    },
  ],
};

/**
 * Dos líneas guardadas de un reparto anterior: la que sigue vigente (índice 0)
 * y una que ya no le corresponde al juez (índice 1).
 */
const LINEAS_GUARDADAS = [{ id: `${CLAIM_ID}-dl-0` }, { id: `${CLAIM_ID}-dl-1` }];

/** `fallo` inyecta un error en la operación indicada sobre las líneas. */
function escenario(fallo?: "read" | "upsert" | "delete") {
  respond = ({ table, op }) => {
    if (table === "judge_compensation_duty_lines") {
      if (op === "select") {
        if (fallo === "read") return { data: null, error: { message: "connection reset by peer" } };
        return { data: LINEAS_GUARDADAS, error: null };
      }
      if (op === "upsert" && fallo === "upsert") {
        return { data: null, error: { message: 'duplicate key value violates "duty_lines_pkey"' } };
      }
      if (op === "delete" && fallo === "delete") {
        return { data: null, error: { message: "permission denied for table" } };
      }
      return { data: [], error: null };
    }
    if (table === "competitions") return { data: competitionRow, error: null };
    if (table === "judge_compensation_claims") return { data: [], error: null };
    if (table === "referees") {
      return {
        data: [
          { id: "j1", nombre: "Ana Ruiz", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true },
        ],
        error: null,
      };
    }
    if (table === "roster_assignments") {
      return { data: [{ slot_key: "S1_central_0", referee_id: "j1", flags: {} }], error: null };
    }
    return { data: [], error: null };
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reescribir los conceptos de una liquidación", () => {
  it("escribe encima de los vigentes y solo retira lo que sobra", async () => {
    escenario();
    await compensationService.recalculate("c1");

    const lineas = calls.filter((c) => c.table === "judge_compensation_duty_lines");
    // El orden importa: primero se escribe, y lo destructivo va al final.
    expect(lineas.map((c) => c.op)).toEqual(["select", "upsert", "delete"]);

    // Y el borrado apunta a la línea sobrante por su id, no a todo el juez.
    const borrado = lineas.find((c) => c.op === "delete");
    expect(borrado?.payload).toEqual([`${CLAIM_ID}-dl-1`]);
  });

  it("si la lectura de las líneas falla, no se toca nada y se avisa", async () => {
    escenario("read");
    await expect(compensationService.recalculate("c1")).rejects.toThrow(
      /No se pudieron leer los conceptos/,
    );
    const lineas = calls.filter((c) => c.table === "judge_compensation_duty_lines");
    expect(lineas.some((c) => c.op === "delete")).toBe(false);
  });

  it("si la escritura falla, lo guardado no se ha destruido y se avisa", async () => {
    escenario("upsert");
    await expect(compensationService.recalculate("c1")).rejects.toThrow(
      /No se pudieron guardar los conceptos/,
    );
    // Lo importante: nunca se llegó al borrado, así que las líneas de antes
    // siguen ahí y reintentar sirve de algo.
    const lineas = calls.filter((c) => c.table === "judge_compensation_duty_lines");
    expect(lineas.some((c) => c.op === "delete")).toBe(false);
  });

  it("si la retirada de sobrantes falla, se dice en vez de darlo por bueno", async () => {
    escenario("delete");
    // Antes este fallo era invisible: el borrado iba sin comprobar y la
    // liquidación se daba por recalculada con líneas de más.
    await expect(compensationService.recalculate("c1")).rejects.toThrow(
      /conceptos que ya no le corresponden/,
    );
  });

  it("el texto de Postgres se queda en el log, no en el mensaje", async () => {
    escenario("upsert");
    const err = await compensationService.recalculate("c1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toMatch(/duty_lines_pkey|duplicate key/);
    // Pero el detalle sí queda registrado en el servidor.
    const registrado = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(JSON.stringify(registrado)).toMatch(/duty_lines_pkey/);
  });
});
