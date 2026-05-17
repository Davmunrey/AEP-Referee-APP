import { describe, expect, it } from "vitest";
import {
  AEP_ZONES,
  deduceMacroZone,
  normalizeZoneInput,
  resolveZoneCode,
  zoneDisplayName,
} from "@/lib/aep-zones";

describe("aep-zones", () => {
  it("expone 5 zonas macro Excel", () => {
    expect(AEP_ZONES).toHaveLength(5);
    expect(AEP_ZONES.map((z) => z.code)).toEqual([
      "NOROESTE",
      "CENTRO",
      "MEDITERRANEO",
      "ANDALUCIA",
      "CANARIAS",
    ]);
  });

  it("mapea etiquetas Excel y códigos legacy a macro", () => {
    expect(resolveZoneCode("1-NOROESTE")).toBe("NOROESTE");
    expect(resolveZoneCode("3- MEDITERRANEO")).toBe("MEDITERRANEO");
    expect(resolveZoneCode("AND")).toBe("ANDALUCIA");
    expect(resolveZoneCode("VAL")).toBe("MEDITERRANEO");
    expect(resolveZoneCode("N1")).toBe("NOROESTE");
    expect(resolveZoneCode("MAD")).toBe("CENTRO");
    expect(normalizeZoneInput("GAL")).toBe("NOROESTE");
  });

  it("deduce provincia → macro (calendario)", () => {
    expect(deduceMacroZone("Málaga", "Guadalteba")).toBe("ANDALUCIA");
    expect(deduceMacroZone(undefined, "Valencia")).toBe("MEDITERRANEO");
    expect(deduceMacroZone("Tarragona", "Tarragona")).toBe("MEDITERRANEO");
  });

  it("muestra etiqueta Excel oficial", () => {
    expect(zoneDisplayName("MEDITERRANEO")).toBe("3- MEDITERRANEO");
    expect(zoneDisplayName("LEV")).toBe("3- MEDITERRANEO");
  });
});
