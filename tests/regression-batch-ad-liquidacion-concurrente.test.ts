import { beforeEach, describe, expect, it, vi } from "vitest";

// Editar una liquidación es leer la fila, aplicar el cambio y reescribirla
// entera. Sin control de concurrencia, quien guardaba segundo reescribía el
// estado que había leído al abrir la pantalla: A marca «pagado», B ajusta los
// km desde una pantalla vieja y la liquidación vuelve a «aprobado» sin que
// nadie se entere. Con dinero de por medio.

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

let respond: (ctx: { table: string; op: string; filters: [string, unknown][] }) => QueryResult;
let calls: { table: string; op: string; filters: [string, unknown][] }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, op: "select", filters: [] as [string, unknown][] };
      const finish = () => {
        calls.push({ ...state, filters: [...state.filters] });
        return respond(state);
      };
      const q = {
        select: () => q,
        update: () => ((state.op = "update"), q),
        insert: () => ((state.op = "insert"), q),
        upsert: () => ((state.op = "upsert"), q),
        delete: () => ((state.op = "delete"), q),
        eq: (c: string, v: unknown) => (state.filters.push([c, v]), q),
        in: () => q,
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
import { CompensationClaimConflictError } from "@/lib/competitions/service-types";

const STORED_AT = "2026-03-01T10:00:00.000Z";

const competitionRow = {
  id: "c1",
  nombre: "Copa",
  tipo: "AEP-2",
  fecha: "2026-03-21",
  fecha_fin: "2026-03-22",
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

const claimRow = {
  id: "cmp-c1-j1",
  competition_id: "c1",
  referee_id: "j1",
  referee_name: "Ana Ruiz",
  status: "pagado",
  travel_mode: "km_rate",
  total_amount: 190,
  updated_at: STORED_AT,
};

/** `claimed` decide si el UPDATE con testigo casa alguna fila. */
function scenario(claimed: boolean) {
  respond = ({ table, op }) => {
    if (table === "judge_compensation_claims") {
      if (op === "update") return { data: claimed ? [{ id: "cmp-c1-j1" }] : [], error: null };
      if (op === "insert") return { data: [], error: null };
      return { data: claimRow, error: null };
    }
    if (table === "competitions") return { data: competitionRow, error: null };
    if (table === "referees") {
      return {
        data: { id: "j1", nombre: "Ana Ruiz", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true },
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
});

describe("editar una liquidación que otra persona acaba de guardar", () => {
  it("la escritura lleva el testigo de la fila leída", async () => {
    scenario(true);
    await compensationService.updateClaim("c1", "j1", { travelNotes: "revisado" });
    const update = calls.find((c) => c.table === "judge_compensation_claims" && c.op === "update");
    expect(update?.filters).toContainEqual(["updated_at", STORED_AT]);
  });

  it("si la fila cambió por debajo, se rechaza en vez de pisarla", async () => {
    scenario(false);
    await expect(
      compensationService.updateClaim("c1", "j1", { travelNotes: "revisado" }),
    ).rejects.toBeInstanceOf(CompensationClaimConflictError);
  });

  it("el mensaje dice qué hacer", async () => {
    scenario(false);
    await expect(
      compensationService.updateClaim("c1", "j1", { travelNotes: "revisado" }),
    ).rejects.toThrow(/Actualiza la pantalla/);
  });
});
