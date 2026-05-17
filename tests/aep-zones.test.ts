import { describe, expect, it } from "vitest";
import {
  AEP_ZONES,
  deduceGeographicZone,
  normalizeZoneInput,
  resolveZoneCode,
  zoneDisplayName,
} from "@/lib/aep-zones";

describe("aep-zones", () => {
  it("expone 8 zonas geográficas", () => {
    expect(AEP_ZONES).toHaveLength(8);
  });

  it("mapea códigos CCAA legacy a zona 2026", () => {
    expect(resolveZoneCode("AND")).toBe("SUR");
    expect(resolveZoneCode("VAL")).toBe("LEV");
    expect(resolveZoneCode("PVA")).toBe("N2");
    expect(normalizeZoneInput("GAL")).toBe("N1");
  });

  it("deduce provincia → zona", () => {
    expect(deduceGeographicZone("Málaga", "Guadalteba")).toBe("SUR");
    expect(deduceGeographicZone(undefined, "Valencia")).toBe("LEV");
  });

  it("muestra nombre oficial", () => {
    expect(zoneDisplayName("LEV")).toBe("Zona levante e islas");
    expect(zoneDisplayName("VAL")).toBe("Zona levante e islas");
  });
});
