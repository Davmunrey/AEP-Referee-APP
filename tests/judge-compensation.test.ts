import { describe, expect, it } from "vitest";
import { calculateCompensationTotals } from "@/lib/judge-compensation/calculate";
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
        unitAmount: 30,
        quantity: 1,
        amount: 30,
        slotKeys: ["S1:central:1"],
      },
      {
        dutyType: "pesaje",
        session: "S1",
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
    status: "borrador",
    ...overrides,
  };
}

describe("calculateCompensationTotals", () => {
  it("suma funciones, km y alojamiento", () => {
    const totals = calculateCompensationTotals(baseInput());
    expect(totals.dutiesAmount).toBe(45);
    expect(totals.travelAmount).toBe(26);
    expect(totals.financialComplete).toBe(true);
    expect(totals.lodgingEligible).toBe(true);
    expect(totals.lodgingAmount).toBe(25);
    expect(totals.totalAmount).toBe(96);
  });

  it("EPF/IPF no paga responsable de competición", () => {
    const totals = calculateCompensationTotals(
      baseInput({
        ambito: "ipf",
        isCompetitionManager: true,
      }),
    );
    expect(totals.competitionManagerAmount).toBe(0);
  });
});
