import { describe, it, expect } from "vitest";
import {
  minLevelForRole,
  validateAssignment,
  validateRosterOperation,
  countOpenSlots,
} from "@/lib/roster-rules";
import type { Referee, RosterSession } from "@/lib/types";

function referee(over: Partial<Referee> = {}): Referee {
  return {
    id: "r1",
    nombre: "Ana Ruiz",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 5,
    ultimo: "2026-01-01",
    disp: true,
    iniciales: "AR",
    ...over,
  };
}

describe("minLevelForRole", () => {
  it("does not require category level for central/lateral", () => {
    expect(minLevelForRole("central", "AEP-2")).toBe("Nacional");
    expect(minLevelForRole("lateral", "AEP-3")).toBe("Nacional");
  });

  it("recommends IPF Cat. 2 for jurado", () => {
    expect(minLevelForRole("jurado", "AEP-2")).toBe("IPF Cat. 2");
    expect(minLevelForRole("jurado", "AEP-1")).toBe("IPF Cat. 2");
  });

  it("defaults non-judging roles to Regional", () => {
    expect(minLevelForRole("pesaje", "AEP-2")).toBe("Regional");
    expect(minLevelForRole("material", "AEP-1")).toBe("Regional");
  });

  it("requires Regional for mesa and liftingcast", () => {
    expect(minLevelForRole("mesa", "AEP-2")).toBe("Regional");
    expect(minLevelForRole("liftingcast", "AEP-3")).toBe("Regional");
  });
});

describe("validateAssignment", () => {
  it("rejects an inactive referee", () => {
    const v = validateAssignment(referee({ estado: "Inactivo" }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El juez no está activo");
  });

  it("rejects a sanctioned referee", () => {
    const v = validateAssignment(referee({ estado: "Sancionado" }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
  });

  it("rejects an unavailable referee", () => {
    const v = validateAssignment(referee({ disp: false }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El juez no está disponible");
  });

  it("does not reject a referee below the role's recommended level", () => {
    const v = validateAssignment(referee({ nivel: "Regional" }), "central", "AEP-2");
    expect(v.ok).toBe(true);
  });

  it("accepts a referee meeting the exact minimum level", () => {
    const v = validateAssignment(referee({ nivel: "Nacional" }), "central", "AEP-2");
    expect(v.ok).toBe(true);
  });

  it("accepts a referee above the minimum level", () => {
    const v = validateAssignment(referee({ nivel: "IPF Cat. 1" }), "central", "AEP-2");
    expect(v.ok).toBe(true);
  });

  it("allows Nacional in AEP-1 central because category is only a warning", () => {
    expect(validateAssignment(referee({ nivel: "Nacional" }), "central", "AEP-1").ok).toBe(true);
    expect(validateAssignment(referee({ nivel: "IPF Cat. 2" }), "central", "AEP-1").ok).toBe(true);
  });

  it("checks status before level (inactive high-level referee still rejected)", () => {
    const v = validateAssignment(
      referee({ estado: "Inactivo", nivel: "IPF Cat. 1" }),
      "central",
      "AEP-1",
    );
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El juez no está activo");
  });
});

describe("validateRosterOperation", () => {
  const rosterTemplate: RosterSession[] = [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Viernes",
      categorias: [],
      horarioCompeticion: "",
      horarioPesaje: "",
      roles: [
        { rol: "Juez Central", key: "central", slots: 1 },
        { rol: "Jurado", key: "jurado", slots: 3 },
      ],
      pesajeRoles: [
        { rol: "Pesaje", key: "pesaje", slots: 1 },
        { rol: "Control Equipamiento", key: "equipamiento", slots: 1 },
      ],
    },
    {
      sesion: "S2",
      nombre: "Sesión 2",
      dia: "Viernes",
      categorias: [],
      horarioCompeticion: "",
      horarioPesaje: "",
      roles: [{ rol: "Juez Central", key: "central", slots: 1 }],
      pesajeRoles: [
        { rol: "Pesaje", key: "pesaje", slots: 1 },
        { rol: "Control Equipamiento", key: "equipamiento", slots: 1 },
      ],
    },
  ];

  it("blocks same referee in same role twice in same session", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_jurado_0: "r1" },
      slotKey: "S1_jurado_1",
      refereeId: "r1",
    });
    expect(result.ok).toBe(false);
  });

  it("blocks same referee in two platform positions in the same session (overridable)", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S1_jurado_0",
      refereeId: "r1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/otra posición/i);
    expect(result.overridable).toBe(true);
  });

  it("marks same-role duplicate as a hard (non-overridable) block", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_jurado_0: "r1" },
      slotKey: "S1_jurado_1",
      refereeId: "r1",
    });
    expect(result.ok).toBe(false);
    expect(result.overridable).toBeFalsy();
  });

  it("allows same referee at platform + weigh-in roles in the same session", () => {
    // El pesaje ocurre ~2 h antes de levantar: tarima y pesaje de la misma sesión
    // son secuenciales, no se solapan.
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S1_pesaje_0",
      refereeId: "r1",
    });
    expect(result.ok).toBe(true);
  });

  it("allows a same-session overlap when the existing slot is marked compartido (*)", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S1_jurado_0",
      refereeId: "r1",
      flags: { S1_central_0: { compartido: true } },
    });
    expect(result.ok).toBe(true);
  });

  it("blocks tarima/jurado followed by next-session pesaje/material", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_jurado_0: "r1" },
      slotKey: "S2_equipamiento_0",
      refereeId: "r1",
    });
    expect(result.ok).toBe(false);
  });

  it("blocks control S1 + pesaje S2 (next-session weigh-in overlaps the platform)", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/marca \* para permitirlo/i);
    expect(result.overridable).toBe(true);
  });

  it("allows control S1 + pesaje S2 when the existing platform slot is marked compartido (*)", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
      flags: { S1_central_0: { compartido: true } },
    });
    expect(result.ok).toBe(true);
  });

  it("allows control S1 + pesaje S2 when the new slot is marked compartido (*)", () => {
    const result = validateRosterOperation({
      template: rosterTemplate,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
      flags: { S2_pesaje_0: { compartido: true } },
    });
    expect(result.ok).toBe(true);
  });
});

describe("countOpenSlots", () => {
  const template = [
    { roles: [{ slots: 3 }, { slots: 2 }] }, // 5 slots
    { roles: [{ slots: 4 }] }, // 4 slots -> 9 total
  ];

  it("returns the total slot count when nothing is assigned", () => {
    expect(countOpenSlots(template, {})).toBe(9);
  });

  it("subtracts non-empty assignments from the total", () => {
    const assignments = { a: "ref1", b: "ref2", c: "ref3" };
    expect(countOpenSlots(template, assignments)).toBe(6);
  });

  it("ignores empty-string assignments", () => {
    const assignments = { a: "ref1", b: "", c: "ref2" };
    expect(countOpenSlots(template, assignments)).toBe(7);
  });

  it("never returns a negative count when over-assigned", () => {
    const assignments = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`k${i}`, `ref${i}`]),
    );
    expect(countOpenSlots(template, assignments)).toBe(0);
  });

  it("returns 0 for an empty template", () => {
    expect(countOpenSlots([], { a: "ref1" })).toBe(0);
  });

  it("counts pesaje slots in open slots", () => {
    const withPesaje = [
      {
        roles: [{ slots: 1 }],
        pesajeRoles: [{ slots: 2 }],
      },
    ];
    expect(countOpenSlots(withPesaje, {})).toBe(3);
    expect(countOpenSlots(withPesaje, { a: "r1" })).toBe(2);
  });
});
