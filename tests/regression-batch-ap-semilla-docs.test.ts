import { describe, expect, it } from "vitest";

// La semilla solo existe fuera de producción y sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.AEP_DOCS_CAPTURE = "1";

import { ensureDocsCaptureSeed } from "@/server/services/docs-capture-seed";
import { getStore } from "@/server/store";
import { enumerateSlotKeys } from "@/lib/roster-template";

describe("la tarima de demostración tiene que poder leerse", () => {
  // Las claves de hueco son `${sesion}_${rol}_${índice}` con índice desde 0. La
  // semilla usaba `S1:central:1`: las 15 asignaciones estaban guardadas pero no
  // casaban con ningún hueco, así que las capturas del manual y el arranque
  // local sin Supabase enseñaban una tarima vacía.
  it("cada asignación sembrada cae en un hueco real de la plantilla", () => {
    ensureDocsCaptureSeed();
    const store = getStore();

    for (const [competitionId, assignments] of store.assignments) {
      const template = store.templates.get(competitionId) ?? [];
      const validas = new Set(enumerateSlotKeys(template));
      const huerfanas = Object.keys(assignments).filter((key) => !validas.has(key));
      expect({ competitionId, huerfanas }).toEqual({ competitionId, huerfanas: [] });
    }
  });

  it("la competición de demostración no sale vacía", () => {
    ensureDocsCaptureSeed();
    const store = getStore();
    const conTarima = [...store.assignments.entries()].filter(
      ([, a]) => Object.keys(a).length > 0,
    );
    expect(conTarima.length).toBeGreaterThan(0);
    const [competitionId, assignments] = conTarima[0]!;
    const template = store.templates.get(competitionId) ?? [];
    const cubiertos = Object.keys(assignments).filter((k) =>
      new Set(enumerateSlotKeys(template)).has(k),
    );
    expect(cubiertos.length).toBe(Object.keys(assignments).length);
  });
});
