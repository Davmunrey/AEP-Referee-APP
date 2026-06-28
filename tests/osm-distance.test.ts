import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDrivingDistanceKm, geocodeAddress } from "@/lib/judge-compensation/osm-distance";

describe("osm-distance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("geocodeAddress devuelve coordenadas desde Nominatim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ lat: "40.4168", lon: "-3.7038", display_name: "Madrid, España" }],
      }),
    );

    const result = await geocodeAddress("Madrid");
    expect(result.lat).toBeCloseTo(40.4168);
    expect(result.lng).toBeCloseTo(-3.7038);
    expect(result.address).toContain("Madrid");
  });

  it("fetchDrivingDistanceKm redondea km enteros desde OSRM", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: "Ok",
          routes: [{ distance: 125_400, duration: 5400 }],
        }),
      }),
    );

    const result = await fetchDrivingDistanceKm(
      { lat: 40.4, lng: -3.7 },
      { lat: 41.6, lng: -4.7 },
    );

    expect(result.distanceKmOneWay).toBe(125);
    expect(result.source).toBe("osm");
    expect(result.durationSeconds).toBe(5400);
  });

  it("fetchDrivingDistanceKm falla sin coordenadas", async () => {
    await expect(
      fetchDrivingDistanceKm({ address: "sin coords" }, { lat: 40, lng: -3 }),
    ).rejects.toThrow(/coordenadas/);
  });
});
