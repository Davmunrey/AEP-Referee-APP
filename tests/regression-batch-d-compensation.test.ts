import { describe, expect, it } from "vitest";
import { calculateCompensationTotals } from "@/lib/judge-compensation/calculate";
import type { CompensationClaimInput } from "@/lib/judge-compensation/types";

const base: CompensationClaimInput = {
  competitionId: "evt-1",
  refereeId: "ref-1",
  refereeName: "Ana",
  competitionName: "Copa",
  tipo: "AEP-2",
  ambito: "nacional",
  fecha: "2026-05-01",
  fechaFin: "2026-05-03",
  sede: "Madrid",
  travelMode: "km_rate",
  travelApproved: false,
  isCompetitionManager: false,
  competitionManagerPerDay: false,
  isComputerSetup: false,
  status: "borrador",
  dutyLines: [
    {
      dutyType: "session",
      session: "S1",
      roleKey: "central",
      roleLabel: "Central",
      unitAmount: 30,
      quantity: 1,
      amount: 30,
      slotKeys: ["S1__central__1"],
    },
    {
      dutyType: "pesaje",
      session: "S1",
      roleKey: "pesaje",
      roleLabel: "Pesaje",
      unitAmount: 15,
      quantity: 1,
      amount: 15,
      slotKeys: ["S1__pesaje__1"],
    },
  ],
  distanceKmRoundTrip: 400,
} as CompensationClaimInput;

describe("calculateCompensationTotals — alojamiento", () => {
  it("denegar el alojamiento a mano deja los días en cero, no solo el importe", () => {
    // Antes el override de días sobrevivía a la denegación y la liquidación se
    // guardaba con «3 días» junto a 0 €: el recibo y el histórico no cuadraban.
    const totals = calculateCompensationTotals({
      ...base,
      lodgingEligibleOverride: false,
      lodgingDaysOverride: 3,
    });
    expect(totals.lodgingEligible).toBe(false);
    expect(totals.lodgingDays).toBe(0);
    expect(totals.lodgingAmount).toBe(0);
  });

  it("con derecho automático cuenta los días de campeonato", () => {
    const totals = calculateCompensationTotals(base);
    expect(totals.lodgingEligible).toBe(true);
    expect(totals.championshipDays).toBe(3);
    expect(totals.lodgingDays).toBe(3);
    expect(totals.lodgingAmount).toBe(75);
  });

  it("fijar días a mano concede el alojamiento aunque no llegue por km", () => {
    const totals = calculateCompensationTotals({
      ...base,
      distanceKmRoundTrip: 40,
      lodgingDaysOverride: 2,
    });
    expect(totals.lodgingEligible).toBe(true);
    expect(totals.lodgingDays).toBe(2);
    expect(totals.lodgingAmount).toBe(50);
  });

  it("una sola función no da derecho a alojamiento por muchos km que haya", () => {
    const totals = calculateCompensationTotals({
      ...base,
      dutyLines: [base.dutyLines[0]!],
    });
    expect(totals.lodgingEligible).toBe(false);
    expect(totals.lodgingDays).toBe(0);
  });

  it("el total suma dietas, kilometraje y alojamiento", () => {
    const totals = calculateCompensationTotals(base);
    // 45 € de funciones + 400 km × 0,13 € + 3 días × 25 €
    expect(totals.dutiesAmount).toBe(45);
    expect(totals.travelAmount).toBe(52);
    expect(totals.totalAmount).toBe(172);
  });
});
