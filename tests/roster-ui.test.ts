import { describe, expect, it } from "vitest";
import {
  countFilledAssignments,
  countRegulationViolations,
  countRosterSlots,
  findRegulationViolation,
  getAssignabilityReason,
} from "@/lib/roster-ui";
import type { Referee, RegulationRule, RosterSession } from "@/lib/types";

const template: RosterSession[] = [
  {
    sesion: "S1",
    dia: "Día 1",
    roles: [{ rol: "Central", slots: 1, key: "central" }],
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
};

const regulations: RegulationRule[] = [
  {
    rol: "Central",
    roleKey: "central",
    minLevel: "Nacional",
    eventTypes: ["AEP-1"],
  },
];

describe("roster-ui", () => {
  it("counts slots and assignments", () => {
    expect(countRosterSlots(template)).toBe(1);
    expect(countFilledAssignments({ S1_central_0: "r1" })).toBe(1);
  });

  it("detects regulation violation", () => {
    const rule = findRegulationViolation("central", "AEP-1", "Regional", regulations);
    expect(rule?.minLevel).toBe("Nacional");
  });

  it("getAssignabilityReason returns normativa message", () => {
    const nacional: Referee = { ...referee, nivel: "Nacional" };
    const juradoRegs: RegulationRule[] = [
      {
        rol: "Jurado",
        roleKey: "jurado",
        minLevel: "IPF Cat. 2",
        eventTypes: ["AEP-1"],
      },
    ];
    const reason = getAssignabilityReason(nacional, "jurado", "AEP-1", juradoRegs);
    expect(reason).toContain("Normativa");
  });

  it("countRegulationViolations tallies assigned slots below min level", () => {
    const count = countRegulationViolations(
      template,
      { S1_central_0: "r1" },
      "AEP-1",
      () => "Regional",
      regulations,
    );
    expect(count).toBe(1);
  });
});
