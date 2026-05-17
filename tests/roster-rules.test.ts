import { describe, it, expect } from "vitest";
import {
  minLevelForRole,
  validateAssignment,
  countOpenSlots,
} from "@/lib/roster-rules";
import type { Referee } from "@/lib/types";

function referee(over: Partial<Referee> = {}): Referee {
  return {
    id: "r1",
    nombre: "Ana Ruiz",
    zona: "Centro",
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
  it("requires Nacional for central/lateral in non-AEP-1 events", () => {
    expect(minLevelForRole("central", "AEP-2")).toBe("Nacional");
    expect(minLevelForRole("lateral", "AEP-3")).toBe("Nacional");
  });

  it("requires Regional for jurado in non-AEP-1 events", () => {
    expect(minLevelForRole("jurado", "AEP-2")).toBe("Regional");
  });

  it("escalates central/lateral to IPF Cat. 2 for AEP-1 events", () => {
    expect(minLevelForRole("central", "AEP-1")).toBe("IPF Cat. 2");
    expect(minLevelForRole("lateral", "AEP-1")).toBe("IPF Cat. 2");
  });

  it("escalates jurado to Nacional for AEP-1 events", () => {
    expect(minLevelForRole("jurado", "AEP-1")).toBe("Nacional");
  });

  it("defaults non-judging roles to Regional", () => {
    expect(minLevelForRole("pesaje", "AEP-2")).toBe("Regional");
    expect(minLevelForRole("material", "AEP-1")).toBe("Regional");
  });
});

describe("validateAssignment", () => {
  it("rejects an inactive referee", () => {
    const v = validateAssignment(referee({ estado: "Inactivo" }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El árbitro no está activo");
  });

  it("rejects a sanctioned referee", () => {
    const v = validateAssignment(referee({ estado: "Sancionado" }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
  });

  it("rejects an unavailable referee", () => {
    const v = validateAssignment(referee({ disp: false }), "jurado", "AEP-2");
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El árbitro no está disponible");
  });

  it("rejects a referee below the role's minimum level", () => {
    const v = validateAssignment(referee({ nivel: "Regional" }), "central", "AEP-2");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.error).toContain("Nivel mínimo");
      expect(v.error).toContain("Nacional");
      expect(v.error).toContain("Regional");
    }
  });

  it("accepts a referee meeting the exact minimum level", () => {
    const v = validateAssignment(referee({ nivel: "Nacional" }), "central", "AEP-2");
    expect(v.ok).toBe(true);
  });

  it("accepts a referee above the minimum level", () => {
    const v = validateAssignment(referee({ nivel: "IPF Cat. 1" }), "central", "AEP-2");
    expect(v.ok).toBe(true);
  });

  it("enforces the stricter AEP-1 level requirement", () => {
    // Nacional is fine for central in AEP-2 but not in AEP-1 (needs IPF Cat. 2).
    expect(validateAssignment(referee({ nivel: "Nacional" }), "central", "AEP-1").ok).toBe(false);
    expect(validateAssignment(referee({ nivel: "IPF Cat. 2" }), "central", "AEP-1").ok).toBe(true);
  });

  it("checks status before level (inactive high-level referee still rejected)", () => {
    const v = validateAssignment(
      referee({ estado: "Inactivo", nivel: "IPF Cat. 1" }),
      "central",
      "AEP-1",
    );
    expect(v.ok).toBe(false);
    expect(v).toHaveProperty("error", "El árbitro no está activo");
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
});
