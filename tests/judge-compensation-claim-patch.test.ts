import { describe, expect, it } from "vitest";
import { applyCompensationClaimPatch } from "@/lib/judge-compensation/claim-patch";
import type { CompensationClaim } from "@/lib/judge-compensation/types";

function baseClaim(overrides: Partial<CompensationClaim> = {}): CompensationClaim {
  return {
    id: "cmp-evt-1-j-1",
    competitionId: "evt-1",
    refereeId: "j-1",
    refereeName: "Test Judge",
    tipo: "AEP-2",
    ambito: "nacional",
    fecha: "2026-01-01",
    fechaFin: "2026-01-01",
    dutyLines: [
      {
        dutyType: "session",
        session: "S1",
        unitAmount: 75,
        quantity: 1,
        amount: 75,
        slotKeys: ["s1-cent"],
      },
    ],
    travelMode: "km_rate",
    distanceKmRoundTrip: 100,
    distanceKmOneWay: 50,
    distanceSource: "manual",
    travelApproved: false,
    isCompetitionManager: false,
    competitionManagerPerDay: false,
    isComputerSetup: false,
    status: "borrador",
    dutiesAmount: 75,
    travelAmount: 30,
    lodgingAmount: 0,
    competitionManagerAmount: 0,
    computerSetupAmount: 0,
    totalAmount: 105,
    sessionCount: 1,
    pesajeCount: 0,
    functionCount: 1,
    championshipDays: 1,
    lodgingEligible: false,
    lodgingDays: 0,
    financialComplete: true,
    ...overrides,
  };
}

describe("applyCompensationClaimPatch", () => {
  it("recalculates totals when toggling shared vehicle", () => {
    const updated = applyCompensationClaimPatch(baseClaim(), {
      travelMode: "shared_vehicle_passenger",
    });
    expect(updated.travelMode).toBe("shared_vehicle_passenger");
    expect(updated.travelAmount).toBe(0);
    expect(updated.totalAmount).toBe(75);
  });

  it("recalculates totals when marking competition manager", () => {
    const updated = applyCompensationClaimPatch(baseClaim(), {
      isCompetitionManager: true,
    });
    expect(updated.isCompetitionManager).toBe(true);
    expect(updated.competitionManagerAmount).toBeGreaterThan(0);
    expect(updated.totalAmount).toBeGreaterThan(105);
  });

  it("syncs one-way km when round trip is patched", () => {
    const updated = applyCompensationClaimPatch(baseClaim(), {
      distanceKmRoundTrip: 240,
      distanceSource: "manual",
    });
    expect(updated.distanceKmRoundTrip).toBe(240);
    expect(updated.distanceKmOneWay).toBe(120);
  });
});
