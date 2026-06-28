import { describe, expect, it } from "vitest";
import { parseIntegerKm, roundTripKmFromOneWay } from "@/lib/judge-compensation/km";
import { isClaimTravelResolved } from "@/lib/judge-compensation/readiness";

describe("compensation km", () => {
  it("rounds to integer km", () => {
    expect(parseIntegerKm(199.9)).toBe(200);
    expect(roundTripKmFromOneWay(100)).toBe(200);
  });

  it("shared vehicle does not require km", () => {
    expect(
      isClaimTravelResolved({
        travelMode: "shared_vehicle_passenger",
        distanceKmRoundTrip: undefined,
        distanceKmOneWay: undefined,
      }),
    ).toBe(true);
  });

  it("km_rate requires positive integer round trip", () => {
    expect(
      isClaimTravelResolved({
        travelMode: "km_rate",
        distanceKmRoundTrip: 200,
        distanceKmOneWay: 100,
      }),
    ).toBe(true);
    expect(
      isClaimTravelResolved({
        travelMode: "km_rate",
        distanceKmRoundTrip: undefined,
        distanceKmOneWay: undefined,
      }),
    ).toBe(false);
  });
});
