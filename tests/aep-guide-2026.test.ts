import { describe, expect, it } from "vitest";
import {
  AEP_COMPETITION_TYPE_DESC,
  AEP_FEES_2026,
  AEP_GEOGRAPHIC_ZONES,
  geographicZoneName,
  operationalToGeographicName,
} from "@/lib/aep-guide-2026";

describe("aep-guide-2026", () => {
  it("define 5 zonas macro Excel", () => {
    expect(AEP_GEOGRAPHIC_ZONES).toHaveLength(5);
  });

  it("mapea código legacy a etiqueta macro", () => {
    expect(operationalToGeographicName("MAD")).toBe("2- CENTRO");
    expect(operationalToGeographicName("VAL")).toBe("3- MEDITERRANEO");
    expect(geographicZoneName("MEDITERRANEO")).toBe("3- MEDITERRANEO");
  });

  it("describe niveles AEP según guía (no invertidos)", () => {
    expect(AEP_COMPETITION_TYPE_DESC["AEP-3"]).toMatch(/local|entrada/i);
    expect(AEP_COMPETITION_TYPE_DESC["AEP-1"]).toMatch(/nacional/i);
  });

  it("incluye cuota examen juez nacional", () => {
    expect(AEP_FEES_2026.examenJuezNacional).toBe(50);
    expect(AEP_FEES_2026.licenciaBasica).toBe(25);
  });
});
