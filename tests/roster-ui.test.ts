import { describe, expect, it } from "vitest";
import {
  countFilledAssignments,
  countRegulationViolations,
  countRosterSlots,
  findRegulationViolation,
  getAssignabilityReason,
  getOperationalBlock,
  getRecommendationWarning,
} from "@/lib/roster-ui";
import type { Referee, RegulationRule, RosterSession } from "@/lib/types";

const template: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Día 1",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ rol: "Jurado", slots: 1, key: "jurado" }],
    pesajeRoles: [],
  },
];

const referee: Referee = {
  id: "r1",
  nombre: "Test Judge",
  iniciales: "TJ",
  zona: "NOR",
  nivel: "Regional",
  estado: "Activo",
  disp: true,
  eventos: 1,
  ultimo: "2025-01-01",
};

const regulations: RegulationRule[] = [
  {
    id: "reg-1",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-1"],
    note: "",
  },
];

describe("roster-ui", () => {
  it("counts slots and assignments", () => {
    expect(countRosterSlots(template)).toBe(1);
    expect(countFilledAssignments({ S1_central_0: "r1" })).toBe(1);
  });

  it("detects regulation violation", () => {
    const rule = findRegulationViolation("jurado", "AEP-1", "Regional", regulations);
    expect(rule?.minLevel).toBe("IPF Cat. 2");
  });

  it("getAssignabilityReason ignores level warnings", () => {
    const nacional: Referee = { ...referee, nivel: "Nacional" };
    const juradoRegs: RegulationRule[] = [
      {
        id: "reg-1",
        rol: "Jurado",
        roleKey: "jurado",
        minLevel: "IPF Cat. 2",
        eventTypes: ["AEP-1"],
        note: "",
      },
    ];
    const reason = getAssignabilityReason(nacional, "jurado", "AEP-1", juradoRegs);
    expect(reason).toBeNull();
    expect(getRecommendationWarning(nacional, "jurado", "AEP-1", juradoRegs)).toContain(
      "Recomendado",
    );
  });

  it("getOperationalBlock flags overridable overlaps and clears with the * flag", () => {
    const twoSessions: RosterSession[] = [
      {
        sesion: "S1",
        nombre: "Sesión 1",
        dia: "Día 1",
        categorias: [],
        horarioCompeticion: "",
        horarioPesaje: "",
        roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
        pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
      },
      {
        sesion: "S2",
        nombre: "Sesión 2",
        dia: "Día 1",
        categorias: [],
        horarioCompeticion: "",
        horarioPesaje: "",
        roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
        pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
      },
    ];
    const base = {
      template: twoSessions,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
    };
    const block = getOperationalBlock(base);
    expect(block?.overridable).toBe(true);
    // El * en el puesto existente elimina el conflicto.
    expect(getOperationalBlock({ ...base, flags: { S1_central_0: { compartido: true } } })).toBeNull();
  });

  it("countRegulationViolations tallies assigned slots below min level", () => {
    const count = countRegulationViolations(
      template,
      { S1_jurado_0: "r1" },
      "AEP-1",
      () => "Regional",
      regulations,
    );
    expect(count).toBe(1);
  });
});
