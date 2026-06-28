import { describe, expect, it } from "vitest";
import { formatPhotonAddress } from "@/lib/geocoding/photon-search";

describe("formatPhotonAddress", () => {
  it("combina calle, ciudad y país sin duplicados", () => {
    const label = formatPhotonAddress({
      properties: {
        name: "Carretera de Rellinars",
        street: "Carretera de Rellinars",
        city: "Terrassa",
        state: "Catalunya",
        postcode: "08225",
        country: "España",
      },
      geometry: { coordinates: [2.0067677, 41.5751672] },
    });
    expect(label).toContain("Terrassa");
    expect(label).toContain("España");
    expect(label).toContain("Carretera de Rellinars");
  });
});
