import { describe, expect, it } from "vitest";
import {
  discardableOrphanClaimIds,
  isDiscardableOrphanClaim,
} from "@/lib/judge-compensation/orphans";
import { claimAuditMeta } from "@/lib/judge-compensation/claim-patch";
import type { CompensationClaim, CompensationClaimStatus } from "@/lib/judge-compensation/types";

function claim(
  refereeId: string,
  status: CompensationClaimStatus,
  extra: Partial<CompensationClaim> = {},
): CompensationClaim {
  return {
    id: `${refereeId}-claim`,
    competitionId: "c1",
    refereeId,
    refereeName: `Juez ${refereeId}`,
    tipo: "AEP-2",
    ambito: "nacional",
    fecha: "2026-03-01",
    fechaFin: "2026-03-02",
    dutyLines: [],
    travelMode: "km_rate",
    travelApproved: false,
    isCompetitionManager: false,
    competitionManagerPerDay: false,
    isComputerSetup: false,
    status,
    dutiesAmount: 60,
    travelAmount: 0,
    lodgingAmount: 0,
    competitionManagerAmount: 0,
    computerSetupAmount: 0,
    totalAmount: 60,
    sessionCount: 2,
    pesajeCount: 0,
    functionCount: 2,
    championshipDays: 2,
    lodgingEligible: false,
    lodgingDays: 0,
    financialComplete: true,
    ...extra,
  };
}

describe("recalcular no puede llevarse el dinero de un juez sustituido", () => {
  // El resumen conserva y marca las liquidaciones huérfanas a propósito
  // («esconder un importe registrado es peor que enseñarlo fuera de sitio»),
  // pero el recálculo las borraba todas sin mirar el estado.
  const stored = new Map<string, CompensationClaim>([
    ["j001", claim("j001", "borrador")],
    ["j002", claim("j002", "pagado")],
    ["j003", claim("j003", "aprobado")],
    ["j004", claim("j004", "enviado")],
    ["j005", claim("j005", "borrador")],
  ]);

  it("solo recoge los borradores huérfanos", () => {
    const enTarima = new Set(["j005"]);
    expect(discardableOrphanClaimIds(stored, enTarima)).toEqual(["j001-claim"]);
  });

  it("no toca a quien sigue en la tarima, sea cual sea su estado", () => {
    const enTarima = new Set(["j001", "j002", "j003", "j004", "j005"]);
    expect(discardableOrphanClaimIds(stored, enTarima)).toEqual([]);
  });

  it("pagado, aprobado, enviado y rechazado dejan constancia; el borrador no", () => {
    expect(isDiscardableOrphanClaim({ status: "borrador" })).toBe(true);
    for (const status of ["pagado", "aprobado", "enviado", "rechazado"] as CompensationClaimStatus[]) {
      expect(isDiscardableOrphanClaim({ status })).toBe(false);
    }
  });
});

describe("quién movió la liquidación y cuándo", () => {
  // Las columnas existen desde 024 y el mapper las escribe, pero nadie las
  // rellenaba: una liquidación llegaba a «pagado» sin nombre ni fecha detrás.
  const AHORA = "2026-04-01T09:00:00.000Z";

  it("aprobar sella revisor y fecha", () => {
    const meta = claimAuditMeta(claim("j001", "enviado"), "aprobado", {
      actor: "Ana Financiera",
      now: AHORA,
    });
    expect(meta.reviewedBy).toBe("Ana Financiera");
    expect(meta.reviewedAt).toBe(AHORA);
  });

  it("pagar también", () => {
    const meta = claimAuditMeta(claim("j001", "aprobado"), "pagado", {
      actor: "Ana Financiera",
      now: AHORA,
    });
    expect(meta.reviewedAt).toBe(AHORA);
  });

  it("enviar sella el envío y retira la revisión de la vuelta anterior", () => {
    const previa = claim("j001", "rechazado", {
      submittedAt: "2026-03-01T00:00:00.000Z",
      reviewedAt: "2026-03-02T00:00:00.000Z",
      reviewedBy: "Ana Financiera",
    });
    const meta = claimAuditMeta(previa, "enviado", { actor: "Luis Juez", now: AHORA });
    expect(meta.submittedAt).toBe(AHORA);
    expect(meta.reviewedAt).toBeUndefined();
    expect(meta.reviewedBy).toBeUndefined();
  });

  it("volver a borrador retira la revisión pero conserva cuándo se envió", () => {
    const previa = claim("j001", "aprobado", {
      submittedAt: "2026-03-01T00:00:00.000Z",
      reviewedAt: "2026-03-02T00:00:00.000Z",
      reviewedBy: "Ana Financiera",
    });
    const meta = claimAuditMeta(previa, "borrador", { now: AHORA });
    expect(meta.submittedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(meta.reviewedBy).toBeUndefined();
  });

  it("guardar sin cambiar de estado no reescribe el rastro", () => {
    const previa = claim("j001", "aprobado", {
      reviewedAt: "2026-03-02T00:00:00.000Z",
      reviewedBy: "Ana Financiera",
    });
    expect(claimAuditMeta(previa, "aprobado", { actor: "Otro", now: AHORA })).toEqual({
      submittedAt: undefined,
      reviewedAt: "2026-03-02T00:00:00.000Z",
      reviewedBy: "Ana Financiera",
    });
    expect(claimAuditMeta(previa, undefined, { actor: "Otro", now: AHORA }).reviewedBy).toBe(
      "Ana Financiera",
    );
  });
});
