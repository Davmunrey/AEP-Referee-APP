import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};
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
        eq: () => q,
        in: () => q,
        gte: () => q,
        lt: () => q,
        order: () => q,
        limit: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        then: (resolve: (r: QueryResult) => unknown) =>
          Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import {
  createRefereeSanction,
  expireStaleSanctions,
  revokeRefereeSanction,
} from "@/server/services/referee-sanctions";
import type { SessionUser } from "@/lib/types";

const ACTOR: SessionUser = {
  id: "u1",
  nombre: "Ana Comité",
  iniciales: "AC",
  email: "ana@aep.test",
  rol: "Comité",
  role: "comite_nacional",
  zona: "CENTRO",
};

const SANCTION_ROW = {
  id: "san-1",
  referee_id: "j001",
  referee_name: "Luis Juez",
  zona: "CENTRO",
  motivo: "Ausencia sin aviso",
  fecha_inicio: "2026-01-01",
  fecha_fin: "2036-01-01",
  status: "activa",
  impuesta_por_nombre: "Ana Comité",
  delegate_notify: { delegates: [], mailtoUrl: "" },
};

const updatesTo = (table: string) =>
  calls.filter((c) => c.table === table && c.op === "update").map((c) => c.payload ?? {});

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("un fallo de lectura no levanta una sanción", () => {
  it("el barrido de expiración no libera al juez si no puede ver sus sanciones vivas", async () => {
    // Una sanción caduca hoy, pero el juez tiene otra todavía en vigor y la
    // lectura que la busca falla. Antes se leía como «no le queda ninguna» y la
    // ficha volvía a Activo/disponible: el juez reaparecía como designable.
    let sanctionReads = 0;
    respond = ({ table, op }) => {
      if (table === "referee_sanctions" && op === "select") {
        sanctionReads += 1;
        if (sanctionReads === 1) {
          return { data: [{ id: "san-vieja", referee_id: "j001" }], error: null };
        }
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: [], error: null };
    };

    await expect(expireStaleSanctions({ force: true })).resolves.toBe(1);
    expect(updatesTo("referees")).toEqual([]);
  });

  it("al sancionar, si no se puede ver cuál vence más tarde se marca igualmente la ficha", async () => {
    respond = ({ table, op }) => {
      if (table === "profiles") return { data: [], error: null };
      if (table === "referee_sanctions" && op === "insert") {
        return { data: SANCTION_ROW, error: null };
      }
      if (table === "referee_sanctions") {
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: null, error: null };
    };

    await createRefereeSanction({
      refereeId: "j001",
      refereeName: "Luis Juez",
      zona: "CENTRO",
      motivo: "Ausencia sin aviso",
      fechaInicio: "2026-01-01",
      duration: "30d",
      impuestaPor: ACTOR,
    });

    // La sanción acaba de guardarse: hay una activa aunque no se pueda leer.
    expect(updatesTo("referees")).toEqual([
      expect.objectContaining({ estado: "Sancionado", disp: false }),
    ]);
  });

  it("si la ficha del juez no llega a marcarse, el alta lo dice en claro", async () => {
    respond = ({ table, op }) => {
      if (table === "profiles") return { data: [], error: null };
      if (table === "referee_sanctions" && op === "insert") {
        return { data: SANCTION_ROW, error: null };
      }
      if (table === "referee_sanctions") return { data: { id: "san-1" }, error: null };
      if (table === "referees") return { data: null, error: { message: "deadlock detected" } };
      return { data: null, error: null };
    };

    await expect(
      createRefereeSanction({
        refereeId: "j001",
        refereeName: "Luis Juez",
        zona: "CENTRO",
        motivo: "Ausencia sin aviso",
        fechaInicio: "2026-01-01",
        duration: "30d",
        impuestaPor: ACTOR,
      }),
    ).rejects.toThrow(/Revisa su ficha antes de designarlo/);
  });

  it("no se guarda una sanción sin poder saber a qué delegados avisa", async () => {
    // La lista de delegados y el mailto se congelan en la fila: con la lectura
    // caída quedaba guardada para siempre sin nadie a quien notificar.
    respond = ({ table }) =>
      table === "profiles"
        ? { data: null, error: { message: "connection reset" } }
        : { data: null, error: null };

    await expect(
      createRefereeSanction({
        refereeId: "j001",
        refereeName: "Luis Juez",
        zona: "CENTRO",
        motivo: "Ausencia sin aviso",
        fechaInicio: "2026-01-01",
        duration: "30d",
        impuestaPor: ACTOR,
      }),
    ).rejects.toThrow(/profiles/);
    expect(calls.some((c) => c.table === "referee_sanctions" && c.op === "insert")).toBe(false);
  });

  it("revocar dos veces no apila la nota de revocación", async () => {
    respond = ({ table, op }) => {
      if (table === "referee_sanctions" && op === "select") {
        return {
          data: { ...SANCTION_ROW, status: "revocada", notas: "Revocación: error mío" },
          error: null,
        };
      }
      return { data: [], error: null };
    };

    const again = await revokeRefereeSanction("san-1", ACTOR, "error mío");
    expect(again?.notas).toBe("Revocación: error mío");
    expect(updatesTo("referee_sanctions")).toEqual([]);
  });
});
