import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El barrido de expiración marca la sanción «cumplida» y después sincroniza
 * la ficha del juez (estado Activo, disponible). Si esa segunda parte fallaba
 * —un corte de un segundo—, se soltaba la marca de barrido para reintentar…
 * pero el siguiente barrido solo busca sanciones «activa», y esa ya no lo es.
 * A ese juez no lo volvía a tocar nadie: «Sancionado» para siempre, sin
 * sanción viva debajo, y por tanto fuera de cualquier tarima.
 */

type Call = { table: string; op: string; payload?: Record<string, unknown> };
let calls: Call[];
let fichaFalla = false;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        calls.push({ ...state });
        if (table === "referee_sanctions") {
          if (state.op === "update") return { data: null, error: null };
          // Primera pasada: una sanción vencida. Segunda: ninguna activa.
          return { data: primeraPasada ? [{ id: "san-1", referee_id: "j001" }] : [], error: null };
        }
        if (table === "referees" && state.op === "update") {
          return fichaFalla ? { data: null, error: { message: "statement timeout" } } : { data: [{ id: "j001" }], error: null };
        }
        return { data: null, error: null };
      };
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => ((state.op = "update"), (state.payload = p), q),
        eq: () => q, in: () => q, gte: () => q, lt: () => q, order: () => q, limit: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

let primeraPasada = true;
const { expireStaleSanctions } = await import("@/server/services/referee-sanctions");

const fichasTocadas = () => calls.filter((c) => c.table === "referees" && c.op === "update").length;

beforeEach(() => {
  calls = [];
  fichaFalla = false;
  primeraPasada = true;
});

describe("la ficha que no se pudo liberar se vuelve a intentar", () => {
  it("el siguiente barrido la sincroniza aunque ya no haya sanciones activas", async () => {
    fichaFalla = true;
    await expireStaleSanctions({ force: true });
    const primerIntento = fichasTocadas();
    expect(primerIntento).toBeGreaterThan(0);

    // Segunda pasada: la sanción ya es «cumplida» (no aparece), la ficha vuelve
    // a poder escribirse. Antes aquí no se tocaba a nadie.
    calls = [];
    fichaFalla = false;
    primeraPasada = false;
    await expireStaleSanctions({ force: true });
    expect(fichasTocadas()).toBeGreaterThan(0);

    // Y una vez liberada, no se insiste.
    calls = [];
    await expireStaleSanctions({ force: true });
    expect(fichasTocadas()).toBe(0);
  });
});
