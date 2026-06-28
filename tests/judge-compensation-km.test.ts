import { describe, expect, it } from "vitest";
import { calculateCompensationTotals } from "@/lib/judge-compensation/calculate";
import { parseIntegerKm, roundTripKmFromOneWay } from "@/lib/judge-compensation/km";
import { isClaimTravelResolved } from "@/lib/judge-compensation/readiness";
import type { CompensationClaimInput } from "@/lib/judge-compensation/types";

function baseInput(overrides: Partial<CompensationClaimInput> = {}): CompensationClaimInput {
  return {
    competitionId: "c1",
    refereeId: "r1",
    refereeName: "Juez",
    tipo: "AEP-3",
    ambito: "nacional",
    fecha: "2026-03-22",
    fechaFin: "2026-03-22",
    dutyLines: [
      {
        dutyType: "session",
        session: "S1",
        roleKey: "central",
        roleLabel: "Juez Central",
        unitAmount: 30,
        quantity: 1,
        amount: 30,
        slotKeys: ["S1:central:1"],
      },
      {
        dutyType: "pesaje",
        session: "S1",
        roleKey: "pesaje",
        roleLabel: "Pesaje",
        unitAmount: 15,
        quantity: 1,
        amount: 15,
        slotKeys: ["S1:pesaje:1"],
      },
    ],
    travelMode: "km_rate",
    distanceKmRoundTrip: 200,
    travelApproved: false,
    isCompetitionManager: false,
    competitionManagerPerDay: false,
    isComputerSetup: false,
    status: "borrador",
    ...overrides,
  };
}

describe("compensation km", () => {
  it("rounds to integer km", () => {
    expect(parseIntegerKm(199.9)).toBe(200);
    expect(roundTripKmFromOneWay(100)).toBe(200);
  });

  it("shared vehicle still requires km for lodging eligibility", () => {
    expect(
      isClaimTravelResolved({
        travelMode: "shared_vehicle_passenger",
        distanceKmRoundTrip: undefined,
        distanceKmOneWay: undefined,
      }),
    ).toBe(false);
    expect(
      isClaimTravelResolved({
        travelMode: "shared_vehicle_passenger",
        distanceKmRoundTrip: 200,
        distanceKmOneWay: 100,
      }),
    ).toBe(true);
  });

  it("shared vehicle exempts mileage but not lodging", () => {
    const totals = calculateCompensationTotals(
      baseInput({
        travelMode: "shared_vehicle_passenger",
        distanceKmRoundTrip: 200,
      }),
    );
    expect(totals.travelAmount).toBe(0);
    expect(totals.lodgingEligible).toBe(true);
    expect(totals.lodgingAmount).toBe(25);
  });

  it("km 0 cuenta como km introducido (sin desplazamiento)", () => {
    expect(
      isClaimTravelResolved({
        travelMode: "km_rate",
        distanceKmRoundTrip: 0,
        distanceKmOneWay: 0,
      }),
    ).toBe(true);
    const totals = calculateCompensationTotals(
      baseInput({
        distanceKmRoundTrip: 0,
        distanceKmOneWay: 0,
      }),
    );
    expect(totals.financialComplete).toBe(true);
    expect(totals.travelAmount).toBe(0);
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
