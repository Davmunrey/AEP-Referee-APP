import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string };

let respond: (ctx: Call) => QueryResult;
let writes: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: Call = { table, op: "select" };
      const finish = () => {
        if (state.op !== "select") writes.push(`${table}.${state.op}`);
        return respond(state);
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

import { rosterService } from "@/server/services/supabase-roster";
import type { Competition, RosterSession } from "@/lib/types";

const comp: Competition = {
  id: "c1",
  nombre: "Camp",
  tipo: "AEP-2",
  fecha: "2026-05-01",
  fechaFin: "2026-05-02",
  sede: "Madrid",
  sesiones: 2,
  requeridos: 2,
  confirmados: 1,
  estado: "Incompleto",
  aprobacion: "pendiente",
};

function sesion(codigo: string): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ key: "central", rol: "Central", slots: 1 }],
    pesajeRoles: [],
  };
}

const getComp = async () => comp;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  writes = [];
});

describe("guardar la plantilla con un juez pagado en la sesión que se quita", () => {
  it("corta antes de escribir nada", async () => {
    respond = ({ table }) => {
      if (table === "roster_assignments") {
        return { data: [{ slot_key: "S2_central_0", referee_id: "j001" }], error: null };
      }
      if (table === "judge_compensation_claims") {
        return { data: [{ referee_id: "j001", status: "pagado" }], error: null };
      }
      return { data: [], error: null };
    };

    await expect(
      rosterService.saveCompetitionTemplate("c1", [sesion("S1")], "Tester", getComp),
    ).rejects.toThrow(/liquidación pagada/);
    // Ni la plantilla ni el borrado de huecos: la comprobación va primero.
    expect(writes).toEqual([]);
  });

  it("si la duda no se puede resolver, tampoco se escribe", async () => {
    respond = ({ table }) => {
      if (table === "roster_assignments") {
        return { data: [{ slot_key: "S2_central_0", referee_id: "j001" }], error: null };
      }
      if (table === "judge_compensation_claims") {
        return { data: null, error: { message: "connection reset" } };
      }
      return { data: [], error: null };
    };

    await expect(
      rosterService.saveCompetitionTemplate("c1", [sesion("S1")], "Tester", getComp),
    ).rejects.toThrow(/judge_compensation_claims/);
    expect(writes).toEqual([]);
  });
});
