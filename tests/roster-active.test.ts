import { describe, expect, it } from "vitest";
import { listActiveTarimaCompetitions, rosterCoveragePct } from "@/lib/roster-active";
import type { Competition } from "@/lib/types";

function comp(partial: Partial<Competition> & Pick<Competition, "id" | "nombre">): Competition {
  return {
    tipo: "AEP-1",
    fecha: "2026-06-01",
    fechaFin: "2026-12-31",
    sede: "Madrid",
    estado: "En curso",
    aprobacion: "Borrador",
    confirmados: 0,
    requeridos: 10,
    zona: "NOR",
    ...partial,
  } as Competition;
}

describe("roster-active", () => {
  it("rosterCoveragePct handles zero requeridos", () => {
    expect(rosterCoveragePct({ confirmados: 0, requeridos: 0 })).toBe(0);
    expect(rosterCoveragePct({ confirmados: 3, requeridos: 10 })).toBe(30);
  });

  it("listActiveTarimaCompetitions sorts by lower coverage first", () => {
    const events = [
      comp({ id: "a", nombre: "A", confirmados: 8, requeridos: 10, fechaFin: "2026-12-31" }),
      comp({ id: "b", nombre: "B", confirmados: 2, requeridos: 10, fechaFin: "2026-12-31" }),
    ];
    const active = listActiveTarimaCompetitions(events);
    expect(active.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
