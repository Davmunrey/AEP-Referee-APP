import { describe, expect, it } from "vitest";
import {
  competitionManagerRate,
  unitRateForDuty,
} from "@/lib/judge-compensation/rates";
import { classifyCompensationDuties } from "@/lib/judge-compensation/classify-duties";
import { buildCompensationClaim, calculateCompensationTotals } from "@/lib/judge-compensation/calculate";
import { buildClaimBreakdown } from "@/lib/judge-compensation/breakdown";
import type { CompensationClaimInput } from "@/lib/judge-compensation/types";
import type { RosterSession } from "@/lib/types";

/** Núcleo monetario del baremo AEP: fija cada tarifa por tipo y ámbito. */
describe("unitRateForDuty — baremo por tipo y ámbito", () => {
  it("nacional: AEP-3/AEP-2 a 30/15 y AEP-1 a 40/20", () => {
    expect(unitRateForDuty("session", "AEP-3", "nacional")).toBe(30);
    expect(unitRateForDuty("pesaje", "AEP-3", "nacional")).toBe(15);
    expect(unitRateForDuty("session", "AEP-2", "nacional")).toBe(30);
    expect(unitRateForDuty("pesaje", "AEP-2", "nacional")).toBe(15);
    expect(unitRateForDuty("session", "AEP-1", "nacional")).toBe(40);
    expect(unitRateForDuty("pesaje", "AEP-1", "nacional")).toBe(20);
  });

  it("internacional (epf/ipf): 40/20 para todos los tipos", () => {
    for (const tipo of ["AEP-3", "AEP-2", "AEP-1"] as const) {
      for (const ambito of ["epf", "ipf"] as const) {
        expect(unitRateForDuty("session", tipo, ambito)).toBe(40);
        expect(unitRateForDuty("pesaje", tipo, ambito)).toBe(20);
      }
    }
  });
});

describe("competitionManagerRate", () => {
  it("por día multiplica por los días del campeonato", () => {
    expect(competitionManagerRate("AEP-1", "nacional", true, 2)).toBe(40);
    expect(competitionManagerRate("AEP-1", "nacional", false, 2)).toBe(20);
  });

  it("internacional no paga responsable", () => {
    expect(competitionManagerRate("AEP-1", "epf", true, 2)).toBe(0);
  });
});

const TEMPLATE: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:30",
    horarioPesaje: "08:00 - 09:30",
    roles: [
      { rol: "Juez Central", slots: 1, key: "central" },
      { rol: "Juez Lateral", slots: 2, key: "lateral" },
    ],
    pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
  },
];

describe("classifyCompensationDuties", () => {
  it("varios slots del mismo rol y sesión colapsan en UNA línea (sin doble pago)", () => {
    const lines = classifyCompensationDuties({
      template: TEMPLATE,
      assignments: { S1_lateral_0: "r1", S1_lateral_1: "r1" },
      refereeId: "r1",
      tipo: "AEP-3",
      ambito: "nacional",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(30);
    expect(lines[0]!.slotKeys).toHaveLength(2);
  });

  it("tarima + pesaje de la misma sesión son dos líneas con tarifas distintas", () => {
    const lines = classifyCompensationDuties({
      template: TEMPLATE,
      assignments: { S1_central_0: "r1", S1_pesaje_0: "r1" },
      refereeId: "r1",
      tipo: "AEP-3",
      ambito: "nacional",
    });
    expect(lines).toHaveLength(2);
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    expect(total).toBe(45); // 30 sesión + 15 pesaje
  });

  it("ignora asignaciones de otros jueces y aplica la tarifa AEP-1", () => {
    const lines = classifyCompensationDuties({
      template: TEMPLATE,
      assignments: { S1_central_0: "r1", S1_lateral_0: "otro" },
      refereeId: "r1",
      tipo: "AEP-1",
      ambito: "nacional",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(40);
  });
});

function claimInput(overrides: Partial<CompensationClaimInput> = {}): CompensationClaimInput {
  return {
    competitionId: "c1",
    refereeId: "r1",
    refereeName: "Juez",
    tipo: "AEP-3",
    ambito: "nacional",
    fecha: "2026-03-21",
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
        slotKeys: ["S1_central_0"],
      },
    ],
    travelMode: "km_rate",
    ...overrides,
  };
}

describe("frontera del alojamiento (>150 km i+v y ≥2 funciones)", () => {
  const twoDuties = claimInput({
    dutyLines: [
      ...claimInput().dutyLines,
      {
        dutyType: "pesaje",
        session: "S1",
        roleKey: "pesaje",
        roleLabel: "Pesaje",
        unitAmount: 15,
        quantity: 1,
        amount: 15,
        slotKeys: ["S1_pesaje_0"],
      },
    ],
  });

  it("150 km exactos NO son elegibles; 151 sí", () => {
    const at150 = calculateCompensationTotals({ ...twoDuties, distanceKmRoundTrip: 150 });
    expect(at150.lodgingEligible).toBe(false);
    expect(at150.lodgingAmount).toBe(0);

    const at151 = calculateCompensationTotals({ ...twoDuties, distanceKmRoundTrip: 151 });
    expect(at151.lodgingEligible).toBe(true);
    expect(at151.lodgingAmount).toBeGreaterThan(0);
  });
});

describe("total sin km resueltos", () => {
  it("con km pendientes el total excluye viaje y alojamiento", () => {
    const totals = calculateCompensationTotals(claimInput({ distanceKmRoundTrip: undefined }));
    expect(totals.financialComplete).toBe(false);
    expect(totals.travelAmount).toBe(0);
    expect(totals.lodgingAmount).toBe(0);
    expect(totals.totalAmount).toBe(totals.dutiesAmount + totals.competitionManagerAmount + totals.computerSetupAmount);
  });
});

describe("consistencia desglose ↔ total", () => {
  it("la suma de las líneas del desglose es exactamente el totalAmount", () => {
    const claim = buildCompensationClaim(
      "cmp-1",
      claimInput({
        distanceKmRoundTrip: 300,
        competitionManager: true,
        computerSetupHalfHours: 2,
      }),
    );
    const breakdown = buildClaimBreakdown(claim);
    const sum = Math.round(breakdown.reduce((acc, line) => acc + line.amount, 0) * 100) / 100;
    expect(sum).toBe(claim.totalAmount);
  });
});
