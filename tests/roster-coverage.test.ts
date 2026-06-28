import { describe, expect, it } from "vitest";
import { PRESET_AEP2 } from "@/lib/mock-data";
import { cloneTemplate, enumerateSlotKeys } from "@/lib/roster-template";
import {
  applyCoverageToCompetition,
  computeRosterCoverage,
  isRosterLockedByApproval,
  rosterMutationBlockedMessage,
} from "@/lib/roster-coverage";
import type { Competition } from "@/lib/types";

const template = cloneTemplate(PRESET_AEP2);

function baseCompetition(over: Partial<Competition> = {}): Competition {
  return {
    id: "evt-1",
    nombre: "Test",
    tipo: "AEP-2",
    fecha: "2026-06-06",
    fechaFin: "2026-06-07",
    sede: "Madrid",
    sesiones: 3,
    requeridos: 8,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    ...over,
  };
}

describe("computeRosterCoverage", () => {
  it("uses template slot count as requeridos, not stale DB value", () => {
    const assignments: Record<string, string> = {};
    for (const key of ["S1-central-0", "S1-lateral-0"]) {
      assignments[key] = "r1";
    }
    const coverage = computeRosterCoverage(template, assignments, 8);
    expect(coverage.requeridos).toBeGreaterThan(8);
    expect(coverage.pct).toBeLessThanOrEqual(100);
  });

  it("ignores orphan assignment keys outside template", () => {
    const keys = enumerateSlotKeys(template);
    const assignments = { "orphan-slot": "r1", [keys[0]!]: "r2" };
    const coverage = computeRosterCoverage(template, assignments, 8);
    expect(coverage.confirmados).toBe(1);
  });

  it("reports 100% when all template slots are filled", () => {
    const keys = enumerateSlotKeys(template);
    const assignments: Record<string, string> = {};
    keys.forEach((key, i) => {
      assignments[key] = `r${i}`;
    });
    const coverage = computeRosterCoverage(template, assignments, 8);
    expect(coverage.openSlots).toBe(0);
    expect(coverage.pct).toBe(100);
    expect(coverage.confirmados).toBe(coverage.requeridos);
  });
});

describe("applyCoverageToCompetition", () => {
  it("overwrites confirmados/requeridos from live roster", () => {
    const keys = enumerateSlotKeys(template);
    const comp = baseCompetition({ requeridos: 8, confirmados: 40 });
    const next = applyCoverageToCompetition(comp, template, { [keys[0]!]: "r1" });
    expect(next.requeridos).toBeGreaterThan(8);
    expect(next.confirmados).toBe(1);
    expect(next.confirmados).toBeLessThanOrEqual(next.requeridos);
  });
});

describe("approval lock", () => {
  it("locks only approved rosters", () => {
    expect(isRosterLockedByApproval("Aprobado")).toBe(true);
    expect(isRosterLockedByApproval("Cambio por imprevisto")).toBe(false);
    expect(rosterMutationBlockedMessage("Aprobado")).toContain("imprevisto");
  });
});
