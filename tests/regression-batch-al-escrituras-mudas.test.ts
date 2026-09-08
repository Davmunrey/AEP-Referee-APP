import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { rosterService } from "@/server/services/supabase-roster";
import type { Competition } from "@/lib/types";

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
  aprobacion: "Propuesta enviada",
  zona: "CENTRO",
};

const PROPOSAL = {
  id: "apr-1",
  competition_id: "c1",
  competition_name: "Camp",
  status: "pendiente",
  assignments: { S1_central_0: "j001" },
  zona: "CENTRO",
  submitted_at: "2026-04-01T00:00:00.000Z",
  submitted_by: "Delegado",
};

const getComp = async () => comp;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("aprobar cuando el campeonato no llega a marcarse", () => {
  it("lo dice en vez de responder que todo fue bien", async () => {
    // Antes: la propuesta quedaba aprobada y el acta guardada, pero el
    // campeonato seguía en «Propuesta enviada» e «Incompleto» sin aviso — y
    // reintentar la revisión ya no sirve, porque no está pendiente.
    respond = ({ table, op }) => {
      if (table === "approval_proposals" && op === "select") {
        return { data: PROPOSAL, error: null };
      }
      if (table === "approval_proposals" && op === "update") {
        return { data: [{ id: "apr-1" }], error: null };
      }
      if (table === "referees") return { data: [{ id: "j001" }], error: null };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "competitions" && op === "update") {
        return { data: null, error: { message: "deadlock detected" } };
      }
      return { data: [], error: null };
    };

    await expect(
      rosterService.reviewApproval("apr-1", true, "Ana", undefined, getComp),
    ).rejects.toThrow(/no llegó a marcarse/);
    // Se ha reintentado una vez antes de rendirse.
    expect(calls.filter((c) => c.table === "competitions" && c.op === "update")).toHaveLength(2);
  });

  it("un fallo pasajero se resuelve con el reintento", async () => {
    respond = ({ table, op }, nth) => {
      if (table === "approval_proposals" && op === "select") {
        return { data: PROPOSAL, error: null };
      }
      if (table === "approval_proposals" && op === "update") {
        return { data: [{ id: "apr-1" }], error: null };
      }
      if (table === "referees") return { data: [{ id: "j001" }], error: null };
      if (table === "roster_assignments") return { data: [], error: null };
      if (table === "competitions" && op === "update") {
        return nth === 1
          ? { data: null, error: { message: "deadlock detected" } }
          : { data: null, error: null };
      }
      return { data: [], error: null };
    };

    await expect(
      rosterService.reviewApproval("apr-1", true, "Ana", undefined, getComp),
    ).resolves.toMatchObject({ id: "apr-1" });
    expect(calls.filter((c) => c.table === "competitions" && c.op === "update")).toHaveLength(2);
  });
});
