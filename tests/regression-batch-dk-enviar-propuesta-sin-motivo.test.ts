import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import type { Competition } from "@/lib/types";

/**
 * Enviar la tarima a aprobación, cuando la escritura falla.
 *
 * `submitRoster` decide entre actualizar la propuesta pendiente o crear una
 * nueva. La LECTURA que toma esa decisión ya explicaba su fallo; las dos
 * escrituras que venían detrás hacían `return undefined`, y desde ahí la ruta
 * contestaba «No se pudo enviar la propuesta» con un 500 y sin dejar una sola
 * línea en el log. Ni quien envía sabe qué pasó ni queda rastro para saberlo.
 *
 * Y uno de esos fallos tiene nombre: la migración 034 creó
 * `approval_proposals_one_pending`, un índice único parcial sobre
 * `competition_id WHERE status = 'pendiente'`. Dos envíos a la vez —dos
 * delegados, o un doble clic— chocan ahí con 23505, y eso no es «no se pudo»:
 * es que la propuesta ya está enviada.
 *
 * En los tres casos la competición NO puede quedar marcada «Propuesta
 * enviada»: sería un estado enviado sin propuesta real que aprobar.
 */

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string };

let respond: (ctx: Call, nth: number) => QueryResult;
let calls: Call[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        calls.push({ ...state });
        const nth = calls.filter((c) => c.table === state.table && c.op === state.op).length;
        return respond(state, nth);
      };
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        upsert: () => ((state.op = "upsert"), q),
        delete: () => ((state.op = "delete"), q),
        eq: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        range: async () => finish(),
        single: async () => finish(),
        maybeSingle: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

const { rosterService } = await import("@/server/services/supabase-roster");

const comp: Competition = {
  id: "c1",
  nombre: "Camp",
  tipo: "AEP-2",
  fecha: "2026-05-01",
  fechaFin: "2026-05-02",
  sede: "Madrid",
  sesiones: 1,
  requeridos: 1,
  confirmados: 1,
  estado: "Incompleto",
  aprobacion: "",
  zona: "CENTRO",
};

const PENDIENTE = {
  id: "apr-1",
  competition_id: "c1",
  competition_name: "Camp",
  zona: "CENTRO",
  status: "pendiente",
  submitted_by: "Ana",
  submitted_at: "2026-04-01T00:00:00.000Z",
  assignments: {},
};

const ok = (data: unknown = null): QueryResult => ({ data, error: null });

function enviar() {
  return rosterService.submitRoster("c1", "Ana", undefined, async () => comp);
}

/** ¿Se llegó a marcar la competición como «Propuesta enviada»? */
function competicionMarcada(): boolean {
  return calls.some((c) => c.table === "competitions" && c.op === "update");
}

beforeEach(() => {
  calls = [];
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cuando otro usuario acaba de enviar la propuesta", () => {
  beforeEach(() => {
    // Sin propuesta pendiente a la vista, pero el índice único de la 034 dice
    // que sí la hay: es la carrera entre dos envíos.
    respond = (ctx) => {
      if (ctx.table === "approval_proposals" && ctx.op === "insert") {
        return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
      return ok(ctx.op === "select" && ctx.table === "approval_proposals" ? null : []);
    };
  });

  it("lo dice, en vez de «no se pudo»", async () => {
    await expect(enviar()).rejects.toBeInstanceOf(UserFacingServiceError);
    await expect(enviar()).rejects.toThrow(/Otro usuario acaba de enviar/);
  });

  it("y con 409, que es un conflicto y no un fallo del servidor", async () => {
    const err = await enviar().catch((e: unknown) => e);
    expect((err as UserFacingServiceError).status).toBe(409);
  });

  it("sin dejar la competición marcada como enviada", async () => {
    await enviar().catch(() => null);
    expect(competicionMarcada()).toBe(false);
  });
});

describe("cuando la creación falla por cualquier otro motivo", () => {
  beforeEach(() => {
    respond = (ctx) => {
      if (ctx.table === "approval_proposals" && ctx.op === "insert") {
        return { data: null, error: { code: "08006", message: "connection failure" } };
      }
      return ok(ctx.op === "select" && ctx.table === "approval_proposals" ? null : []);
    };
  });

  it("explica que no se ha enviado nada", async () => {
    await expect(enviar()).rejects.toThrow(/No se pudo crear la propuesta/);
  });

  it("no filtra el detalle interno, pero sí lo registra", async () => {
    const err = await enviar().catch((e: unknown) => e);
    expect(String((err as Error).message)).not.toContain("connection failure");
    expect(console.error).toHaveBeenCalled();
  });

  it("y tampoco marca la competición", async () => {
    await enviar().catch(() => null);
    expect(competicionMarcada()).toBe(false);
  });
});

describe("cuando ya hay propuesta pendiente y no se puede actualizar", () => {
  beforeEach(() => {
    respond = (ctx) => {
      if (ctx.table === "approval_proposals" && ctx.op === "update") {
        return { data: null, error: { code: "08006", message: "connection failure" } };
      }
      if (ctx.table === "approval_proposals" && ctx.op === "select") return ok(PENDIENTE);
      return ok([]);
    };
  });

  it("lo dice y deja claro que no se ha enviado nada", async () => {
    await expect(enviar()).rejects.toThrow(/No se pudo actualizar la propuesta pendiente/);
  });

  it("sin volver a marcar la competición", async () => {
    await enviar().catch(() => null);
    expect(competicionMarcada()).toBe(false);
  });
});

describe("cuando todo va bien", () => {
  it("sigue devolviendo la propuesta", async () => {
    respond = (ctx) => {
      if (ctx.table === "approval_proposals" && ctx.op === "select") return ok(PENDIENTE);
      return ok([]);
    };
    const proposal = await enviar();
    expect(proposal?.id).toBe("apr-1");
    expect(competicionMarcada()).toBe(true);
  });
});
