import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Editar la ficha de un juez o los datos de un campeonato: la ruta carga el
 * registro al principio, y al final llama a `update…`. Ese `update…` devolvía
 * `undefined` tanto si no había fila como si la escritura había fallado, y la
 * ruta lo leía como «no encontrado» —de un registro que acababa de cargar—.
 * Quien editaba se quedaba sin saber si se había guardado.
 */

type Fallo = { message: string; code?: string } | null;
const fallos: Record<string, Fallo> = {};
const FILAS: Record<string, unknown> = {
  referees: { id: "ref-1", nombre: "Ana Ruiz", zona: "CENTRO", nivel: "Nacional" },
  competitions: { id: "evt-1", nombre: "Open", tipo: "AEP-2", fecha: "2026-05-01", fecha_fin: "2026-05-01", sede: "Madrid", zona: "CENTRO", aprobacion: "Sin propuesta", template: [] },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => {
      const q: Record<string, unknown> = {};
      const fila = () => ({ data: fallos[tabla] ? null : (FILAS[tabla] ?? null), error: fallos[tabla] ?? null });
      Object.assign(q, {
        select: () => q, update: () => q, delete: () => q, eq: () => q, in: () => q, order: () => q,
        range: async () => ({ data: [], error: null }),
        single: async () => fila(),
        maybeSingle: async () => fila(),
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      });
      return q;
    },
  }),
}));

const { refereeService } = await import("@/server/services/supabase-referees");
const { competitionService } = await import("@/server/services/supabase-competitions");

beforeEach(() => {
  for (const k of Object.keys(fallos)) delete fallos[k];
});

describe("una escritura fallida no es un registro que no existe", () => {
  it("guardar la ficha de un juez que no se puede escribir lo dice", async () => {
    fallos.referees = { message: "permission denied for table referees" };
    await expect(refereeService.updateReferee("ref-1", { nombre: "Ana" })).rejects.toThrow(/referees/);
  });

  it("un juez que de verdad no está sigue devolviendo «no hay»", async () => {
    fallos.referees = { message: "no rows", code: "PGRST116" };
    await expect(refereeService.updateReferee("ref-1", { nombre: "Ana" })).resolves.toBeUndefined();
  });

  it("y sin fallos se guarda y se devuelve la ficha", async () => {
    await expect(refereeService.updateReferee("ref-1", { nombre: "Ana" })).resolves.toMatchObject({ id: "ref-1" });
  });

  it("lo mismo con los datos de un campeonato", async () => {
    fallos.competitions = { message: "deadlock detected" };
    await expect(competitionService.updateCompetition("evt-1", { sede: "Toledo" })).rejects.toThrow(/competitions/);
    delete fallos.competitions;
    await expect(competitionService.updateCompetition("evt-1", { sede: "Toledo" })).resolves.toMatchObject({ id: "evt-1" });
  });
});
