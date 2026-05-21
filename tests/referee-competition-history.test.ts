import { describe, expect, it } from "vitest";
import {
  buildRefereeCompetitionHistory,
  parseRosterSlotPosition,
} from "@/lib/referee-competition-history";
import type { Competition } from "@/lib/types";

const competitions: Competition[] = [
  {
    id: "c1",
    nombre: "Campeonato Norte",
    tipo: "AEP-1",
    fecha: "2026-03-10",
    fechaFin: "2026-03-12",
    sede: "Oviedo",
    sesiones: 2,
    requeridos: 10,
    confirmados: 5,
    estado: "Incompleto",
    aprobacion: "Borrador",
  },
  {
    id: "c2",
    nombre: "Campeonato Sur",
    tipo: "AEP-2",
    fecha: "2026-04-01",
    fechaFin: "2026-04-01",
    sede: "Sevilla",
    sesiones: 1,
    requeridos: 6,
    confirmados: 6,
    estado: "Completo",
    aprobacion: "Aprobado",
  },
];

describe("referee competition history", () => {
  it("parses roster slot keys into exact judge positions", () => {
    expect(parseRosterSlotPosition("S2_lateral_1", { compartido: true })).toEqual({
      slotKey: "S2_lateral_1",
      session: "S2",
      roleKey: "lateral",
      roleLabel: "Juez Lateral",
      slotIndex: 1,
      flags: { compartido: true, intercambio: false },
    });
  });

  it("builds per-competition history with session, role, slot and flags", () => {
    const history = buildRefereeCompetitionHistory(competitions, [
      { competitionId: "c1", slotKey: "S2_pesaje_0", flags: { intercambio: true } },
      { competitionId: "c1", slotKey: "S1_central_0" },
      { competitionId: "c1", slotKey: "S1_lateral_1" },
      { competitionId: "c2", slotKey: "S1_jurado_2" },
      { competitionId: "missing", slotKey: "S1_central_0" },
      { competitionId: "c1", slotKey: "bad-key" },
    ]);

    expect(history.map((item) => item.competitionId)).toEqual(["c2", "c1"]);
    expect(history[1]).toMatchObject({
      competitionId: "c1",
      competitionName: "Campeonato Norte",
      slotCount: 3,
      roles: ["Juez Central", "Juez Lateral", "Pesaje"],
    });
    expect(history[1].positions.map((position) => position.slotKey)).toEqual([
      "S1_central_0",
      "S1_lateral_1",
      "S2_pesaje_0",
    ]);
    expect(history[1].positions[2].flags).toEqual({
      compartido: false,
      intercambio: true,
    });
  });
});
