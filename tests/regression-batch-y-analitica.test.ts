import { beforeEach, describe, expect, it, vi } from "vitest";

// El panel y la analítica leían con `const { data } = await …`: un fallo de
// lectura se convertía en una pantalla de ceros —«sin campeonatos», «cobertura
// 0 %», «nada pendiente»—, que es una afirmación sobre la temporada, no un
// hueco. Y sin paginar, el corte de PostgREST en 1000 filas calculaba los KPI
// sobre un trozo arbitrario del censo.

type QueryResult = { data: unknown; error: { message: string } | null };

let respond: (ctx: { table: string; range?: [number, number] }) => QueryResult;
let calls: { table: string; range?: [number, number] }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state = { table, range: undefined as [number, number] | undefined };
      const finish = () => {
        calls.push({ ...state });
        return respond(state);
      };
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
        lt: () => q,
        is: () => q,
        or: () => q,
        limit: () => q,
        order: () => q,
        update: () => q,
        insert: () => q,
        single: async () => finish(),
        maybeSingle: async () => finish(),
        range: async (from: number, to: number) => {
          state.range = [from, to];
          return finish();
        },
        then: (resolve: (r: QueryResult) => unknown) => Promise.resolve(finish()).then(resolve),
      };
      return q;
    },
  }),
}));

import { analyticsService } from "@/server/services/supabase-analytics";
import type { SessionUser } from "@/lib/types";

const admin: SessionUser = {
  id: "u1",
  nombre: "Admin",
  rol: "Super admin",
  iniciales: "SA",
  email: "admin@example.org",
  role: "super_admin",
};

const competitionRow = (id: string) => ({
  id,
  nombre: `Evento ${id}`,
  tipo: "AEP-2",
  fecha: "2026-03-21",
  fecha_fin: "2026-03-22",
  sede: "Madrid",
  zona: "CENTRO",
  sesiones: 1,
  requeridos: 6,
  confirmados: 0,
  estado: "Borrador",
  aprobacion: "Pendiente",
  template: [],
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
});

describe("panel y analítica ante un fallo de lectura", () => {
  it("el panel no pinta una portada de ceros", async () => {
    respond = ({ table }) =>
      table === "competitions"
        ? { data: null, error: { message: "connection reset" } }
        : { data: [], error: null };
    await expect(analyticsService.getDashboard(admin)).rejects.toThrow(/competitions/);
  });

  it("la analítica tampoco dibuja una serie histórica vacía", async () => {
    respond = ({ table }) =>
      table === "referees"
        ? { data: null, error: { message: "connection reset" } }
        : { data: [], error: null };
    await expect(analyticsService.getAnalytics(admin)).rejects.toThrow(/referees/);
  });
});

describe("las lecturas del panel se paginan", () => {
  it("recorre la segunda página de campeonatos", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => competitionRow(`c${i}`));
    const rest = [competitionRow("c1000")];
    const seen = new Map<string, number>();
    respond = ({ table }) => {
      const n = (seen.get(table) ?? 0) + 1;
      seen.set(table, n);
      if (table === "competitions") return { data: n === 1 ? first : rest, error: null };
      return { data: [], error: null };
    };
    await analyticsService.getDashboard(admin);
    const ranges = calls
      .filter((c) => c.table === "competitions" && c.range)
      .map((c) => `${c.range![0]}-${c.range![1]}`);
    // Antes: una sola lectura, y el KPI de cobertura se calculaba sobre las
    // primeras 1000 filas como si fueran todas.
    expect(ranges).toEqual(["0-999", "1000-1999"]);
  });
});

// ── Cierre tras la aprobación ───────────────────────────────────────────────
import { isRosterRejected, ROSTER_REJECTED } from "@/lib/roster-coverage";
import { rosterService } from "@/server/services/supabase-roster";

describe("estado de rechazo", () => {
  it("reconoce el estado, tolerando espacios y mayúsculas", () => {
    expect(isRosterRejected(ROSTER_REJECTED)).toBe(true);
    expect(isRosterRejected(" rechazado ")).toBe(true);
    expect(isRosterRejected("Aprobado")).toBe(false);
    expect(isRosterRejected("")).toBe(false);
    expect(isRosterRejected(undefined)).toBe(false);
  });
});

describe("la última propuesta de una competición", () => {
  it("devuelve la más reciente, con su motivo de rechazo", async () => {
    respond = ({ table }) =>
      table === "approval_proposals"
        ? {
            data: [
              {
                id: "apr-2",
                competition_id: "c1",
                competition_name: "Copa",
                zona: "CENTRO",
                submitted_by: "Delegado",
                submitted_at: "2026-03-02",
                status: "rechazado",
                assignments: {},
                comment: "Falta el jurado de la sesión 3",
                reviewed_by: "Nacional",
                reviewed_at: "2026-03-03",
              },
            ],
            error: null,
          }
        : { data: [], error: null };
    const latest = await rosterService.getLatestApproval("c1");
    // Antes no había forma de llegar a este comentario desde la tarima: el
    // revisor está obligado a escribirlo y se quedaba en su bandeja.
    expect(latest?.status).toBe("rechazado");
    expect(latest?.comment).toBe("Falta el jurado de la sesión 3");
    expect(latest?.reviewedBy).toBe("Nacional");
  });

  it("sin propuestas devuelve undefined, y un fallo de lectura no lo simula", async () => {
    respond = () => ({ data: [], error: null });
    await expect(rosterService.getLatestApproval("c1")).resolves.toBeUndefined();
    respond = () => ({ data: null, error: { message: "connection reset" } });
    await expect(rosterService.getLatestApproval("c1")).rejects.toThrow(/approval_proposals/);
  });
});
