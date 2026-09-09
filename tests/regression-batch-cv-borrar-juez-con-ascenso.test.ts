import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A `referees` le apuntan DOS claves ajenas sin `ON DELETE`:
 * `roster_assignments.referee_id` (001:81) y `promotion_requests.referee_id`
 * (001:105). El borrado solo comprobaba la primera.
 *
 * Y las solicitudes de ascenso no se borran nunca —quedan como «aprobado» o
 * «rechazado»—, así que cualquier juez al que se le haya pedido un ascenso
 * alguna vez tiene una fila ahí. Al borrarlo, Postgres devolvía 23503 y el
 * servicio lo traducía a «El juez está designado en 1 campeonato. Quítalo de
 * esa tarima antes de eliminarlo.»
 *
 * La tarima ya se había comprobado y estaba vacía. Quien leía ese mensaje se
 * ponía a buscar en tarimas donde el juez no está.
 */

type Respuesta = { data: unknown; error: unknown; count?: number };
let respond: (ctx: { table: string; op: string }) => Respuesta;
const writes: string[] = [];

function q(table: string): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  let op = "select";
  const run = () => respond({ table, op });
  Object.assign(self, {
    select: () => self,
    delete: () => {
      op = "delete";
      writes.push(table);
      return self;
    },
    eq: () => self,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => q(table) }),
}));

const { refereeService } = await import("@/server/services/supabase-referees");
const { RefereePromotionsError } = await import("@/lib/competitions/service-types");

beforeEach(() => {
  writes.length = 0;
});

describe("borrar un juez con solicitudes de ascenso", () => {
  it("lo dice por su nombre, no como una designación de tarima", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "promotion_requests") return { data: null, error: null, count: 2 };
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toBeInstanceOf(
      RefereePromotionsError,
    );
    await expect(refereeService.deleteReferee("j001")).rejects.toThrow(
      /2 solicitudes de ascenso/,
    );
  });

  it("y no llega a intentar el borrado", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "promotion_requests") return { data: null, error: null, count: 1 };
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toThrow(/1 solicitud de ascenso/);
    expect(writes).toEqual([]);
  });

  it("si no se puede comprobar, no se borra nada", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "promotion_requests") {
        return { data: null, error: { message: "statement timeout" } };
      }
      return { data: [], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).rejects.toThrow(/No se ha borrado nada/);
    expect(writes).toEqual([]);
  });

  it("sin ascensos ni designaciones ni liquidaciones, se borra", async () => {
    respond = ({ table }) => {
      if (table === "judge_compensation_claims") return { data: null, error: null, count: 0 };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "promotion_requests") return { data: null, error: null, count: 0 };
      return { data: [{ id: "j001" }], error: null };
    };

    await expect(refereeService.deleteReferee("j001")).resolves.toBe(true);
    expect(writes).toEqual(["referees"]);
  });
});
