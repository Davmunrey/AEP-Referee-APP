import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  blocksRosterRemoval,
  paidClaimClearAllMessage,
  paidClaimRemovalMessage,
} from "@/lib/roster-paid-claims";

describe("qué estado de liquidación congela el puesto", () => {
  it("solo el pago consumado", () => {
    expect(blocksRosterRemoval("pagado")).toBe(true);
    expect(blocksRosterRemoval("aprobado")).toBe(false);
    expect(blocksRosterRemoval("enviado")).toBe(false);
    expect(blocksRosterRemoval("borrador")).toBe(false);
    expect(blocksRosterRemoval("rechazado")).toBe(false);
    expect(blocksRosterRemoval(undefined)).toBe(false);
  });

  it("los mensajes dicen qué hacer para desbloquear", () => {
    expect(paidClaimRemovalMessage("Ana Ruiz")).toMatch(/^Ana Ruiz tiene la liquidación/);
    expect(paidClaimRemovalMessage("Ana Ruiz")).toMatch(/revierte antes el pago/i);
    expect(paidClaimRemovalMessage()).toMatch(/^Ese juez/);
    expect(paidClaimClearAllMessage(1)).toMatch(/una liquidación pagada/);
    expect(paidClaimClearAllMessage(3)).toMatch(/3 liquidaciones pagadas/);
  });
});

// ── Capa Supabase ───────────────────────────────────────────────────────────
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

let respond: (ctx: { table: string; op: string }) => QueryResult;
let writes: string[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select" };
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
        neq: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
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

import { rosterService } from "@/server/services/supabase-roster";
import { RosterPaidClaimError } from "@/lib/competitions/service-types";
import type { Competition, Referee } from "@/lib/types";

const competition = {
  id: "c1",
  nombre: "Copa",
  tipo: "AEP-2",
  fecha: "2026-03-21",
  fechaFin: "2026-03-22",
  sede: "Madrid",
  zona: "CENTRO",
  sesiones: 1,
  requeridos: 2,
  confirmados: 1,
  estado: "Incompleto",
  aprobacion: "Sin propuesta",
} as Competition;

const referee = (id: string, nombre: string) =>
  ({ id, nombre, zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true, eventos: 0 }) as Referee;

const template = [
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
];

/** La tarima tiene a j1 en S1_central_0; `paid` decide si su liquidación está pagada. */
function scenario(paid: boolean) {
  respond = ({ table, op }) => {
    if (table === "judge_compensation_claims") {
      return { data: paid ? [{ referee_id: "j1", status: "pagado" }] : [], error: null };
    }
    if (table === "roster_assignments") {
      return op === "select"
        ? { data: [{ slot_key: "S1_central_0", referee_id: "j1", flags: {}, cross_zone: false }], error: null }
        : { data: [], error: null };
    }
    if (table === "competitions") {
      return { data: { ...competition, fecha_fin: competition.fechaFin, template }, error: null };
    }
    return { data: [], error: null };
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  writes = [];
});

describe("sustituir a un juez con la liquidación pagada", () => {
  const getComp = async () => competition;
  const getRef = async (id: string) => referee(id, id === "j1" ? "Ana Ruiz" : "Luis Gil");

  it("se bloquea, y nada se escribe", async () => {
    scenario(true);
    const res = await rosterService.assignReferee(
      "c1",
      "S1_central_0",
      "j2",
      "Delegado",
      getComp,
      getRef,
    );
    expect(res.error).toMatch(/Ana Ruiz tiene la liquidación/);
    expect(writes).toEqual([]);
  });

  it("con la liquidación aún sin pagar, la sustitución sigue funcionando", async () => {
    scenario(false);
    const res = await rosterService.assignReferee(
      "c1",
      "S1_central_0",
      "j2",
      "Delegado",
      getComp,
      getRef,
    );
    expect(res.error).toBeUndefined();
    expect(writes).toContain("roster_assignments.upsert");
  });

  it("liberar su hueco tampoco se permite", async () => {
    scenario(true);
    await expect(rosterService.clearSlot("c1", "S1_central_0", "Delegado")).rejects.toBeInstanceOf(
      RosterPaidClaimError,
    );
    expect(writes).toEqual([]);
  });

  it("ni vaciar la tarima entera", async () => {
    scenario(true);
    await expect(
      rosterService.clearRosterAssignments("c1", "Delegado", getComp),
    ).rejects.toThrow(/una liquidación pagada/);
    expect(writes).toEqual([]);
  });
});
