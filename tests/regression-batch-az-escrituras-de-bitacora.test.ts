import { beforeEach, describe, expect, it, vi } from "vitest";

// Escrituras que nadie miraba porque «no son importantes»: la cobertura
// derivada, el registro de actividad, el historial de la tarima y las
// actualizaciones del calendario importado. Ninguna debe hacer fracasar la
// operación que la genera, pero todas tienen que dejar rastro cuando fallan.

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

import { pushActivity, pushHistory, syncCompetitionCoverage } from "@/server/services/supabase-helpers";
import { importJudgesRegistryToSupabase } from "@/server/services/import-judges-registry";
import type { ParsedJudgesRegistry } from "@/lib/judges-registry/parse-xlsx";

function registrado(): string {
  const spy = console.error as unknown as { mock: { calls: unknown[][] } };
  return JSON.stringify(spy.mock.calls);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("una escritura de bitácora que falla no rompe la operación, pero consta", () => {
  it("la cobertura derivada: la designación ya está guardada, así que no se lanza", async () => {
    respond = ({ table, op }) => {
      if (table === "competitions" && op === "update") {
        return { data: null, error: { message: "could not serialize access" } };
      }
      return { data: [], error: null };
    };
    // Sin excepción: hacer fracasar la designación por la cobertura sería
    // mentir al revés.
    await expect(syncCompetitionCoverage("c1")).resolves.toBeUndefined();
    expect(registrado()).toMatch(/syncCompetitionCoverage/);
    expect(registrado()).toMatch(/could not serialize access/);
  });

  it("el registro de actividad", async () => {
    respond = () => ({ data: null, error: { message: "activity_log is read only" } });
    await expect(
      pushActivity({ tipo: "ascenso", actor: "A", accion: "aprobó", evento: "X", hace: "ahora" }),
    ).resolves.toBeUndefined();
    expect(registrado()).toMatch(/activity_log/);
  });

  it("el historial de la tarima, que es el acta", async () => {
    respond = ({ table, op }) => {
      if (table === "roster_history" && op === "insert") {
        return { data: null, error: { message: "deadlock detected" } };
      }
      return { data: [], error: null };
    };
    await expect(
      pushHistory({ competitionId: "c1", at: "2026-05-01", actor: "A", action: "Asignó" }),
    ).resolves.toBeUndefined();
    expect(registrado()).toMatch(/roster_history/);
    expect(registrado()).toMatch(/deadlock/);
  });
});

describe("importar el calendario sobre campeonatos que ya existen", () => {
  const registro = (): ParsedJudgesRegistry =>
    ({
      referees: [],
      competitions: [
        {
          excelId: 1,
          nombre: "Copa de Primavera",
          tipo: "AEP-2",
          fecha: "2026-05-01",
          fechaFin: "2026-05-02",
          sede: "Sevilla",
          zona: "SUR",
        },
      ],
      warnings: [],
    }) as unknown as ParsedJudgesRegistry;

  it("una actualización que falla no se cuenta como hecha, y el aviso lo dice", async () => {
    // Antes se ignoraba el resultado: el resumen daba la sede y la zona por
    // actualizadas cuando seguían como estaban.
    respond = ({ table, op }) => {
      if (table === "competitions" && op === "select") {
        return {
          data: [{ id: "evt-001", nombre: "Copa de Primavera", fecha: "2026-05-01" }],
          error: null,
        };
      }
      if (table === "competitions" && op === "update") {
        return {
          data: null,
          error: { message: 'violates check constraint "competitions_zona_fkey"' },
        };
      }
      return { data: [], error: null };
    };
    const result = await importJudgesRegistryToSupabase(registro());
    expect(result.competitionsCreated).toBe(0);
    expect((result.warnings ?? []).join(" ")).toMatch(/Copa de Primavera: no se pudo actualizar/);
    // El nombre de la restricción se queda en el log, no en el aviso.
    expect((result.warnings ?? []).join(" ")).not.toMatch(/constraint|fkey/);
    expect(registrado()).toMatch(/competitions_zona_fkey/);
  });

  it("cuando va bien, no hay aviso", async () => {
    respond = ({ table, op }) => {
      if (table === "competitions" && op === "select") {
        return {
          data: [{ id: "evt-001", nombre: "Copa de Primavera", fecha: "2026-05-01" }],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    const result = await importJudgesRegistryToSupabase(registro());
    expect((result.warnings ?? []).join(" ")).not.toMatch(/no se pudo actualizar/);
    expect(result.competitionsSkipped).toBe(1);
  });
});

describe("un solo punto de escritura para el registro de actividad", () => {
  it("nadie inserta en activity_log por su cuenta", async () => {
    // `pushActivity` existe precisamente para que un insert fallido deje
    // rastro en el log del servidor. Las sanciones lo hacían a mano y en
    // silencio: imponer o revocar una sanción podía no constar en ninguna
    // parte, que es justo lo contrario de para lo que sirve un registro.
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src/server/services");
    const culpables = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "supabase-helpers.ts")
      .filter((f) => /from\("activity_log"\)\s*\.insert/.test(readFileSync(join(dir, f), "utf8")));
    expect(culpables).toEqual([]);
  });
});
