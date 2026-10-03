import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeRosterCoverage, countRequiredSlots } from "@/lib/roster-coverage";

// Una tarima recién creada no tiene plantilla, pero `computeRosterCoverage` cae
// al `requeridos` de la competición: el constructor creía que había 12 huecos,
// marcaba «Plantilla» como hecha y escondía el estado vacío con los botones de
// importar/crear plantilla.
describe("tarima recién creada", () => {
  it("la cobertura usa el fallback de requeridos; los huecos reales son 0", () => {
    expect(computeRosterCoverage([], {}, 12).requeridos).toBe(12);
    expect(countRequiredSlots([])).toBe(0);
  });

  it("el constructor decide el paso por los huecos de la plantilla", () => {
    const src = readFileSync("src/components/competitions/roster-builder.tsx", "utf8");
    expect(src).toContain("countRequiredSlots(initialTemplate) === 0");
    expect(src).toContain("const plantillaDone = templateSlots > 0;");
    expect(src).toContain("templateSlots === 0 ?");
    expect(src).toContain("submitBlockedReason=");
  });

  it("el paso no se marca hecho solo por estar por delante", () => {
    const src = readFileSync("src/components/competitions/roster-stepper.tsx", "utf8");
    expect(src).not.toContain("doneFor(step) || isPast");
  });
});
