import { buildCompensationClaim } from "./calculate";
import { oneWayKmFromRoundTrip, parseIntegerKm, roundTripKmFromOneWay } from "./km";
import type {
  CompensationClaim,
  CompensationClaimInput,
  CompensationClaimStatus,
  CompensationTravelMode,
} from "./types";

export type CompensationClaimPatch = Partial<{
  travelMode: CompensationTravelMode;
  distanceKmOneWay: number | null;
  distanceKmRoundTrip: number | null;
  distanceSource: "osm" | "google_maps" | "manual" | null;
  travelApproved: boolean;
  travelNotes: string | null;
  isCompetitionManager: boolean;
  competitionManagerPerDay: boolean;
  isComputerSetup: boolean;
  computerSetupAmount: number | null;
  lodgingEligibleOverride: boolean | null;
  lodgingDaysOverride: number | null;
  status: CompensationClaimStatus;
  reviewComment: string | null;
}>;

export function normalizeCompensationClaimPatch(patch: CompensationClaimPatch): CompensationClaimPatch {
  const normalized = { ...patch };
  if (patch.distanceKmRoundTrip !== undefined) {
    normalized.distanceKmRoundTrip =
      patch.distanceKmRoundTrip != null ? parseIntegerKm(patch.distanceKmRoundTrip) : null;
    if (normalized.distanceKmRoundTrip != null) {
      normalized.distanceKmOneWay = oneWayKmFromRoundTrip(normalized.distanceKmRoundTrip);
    } else {
      normalized.distanceKmOneWay = null;
    }
  } else if (patch.distanceKmOneWay !== undefined) {
    normalized.distanceKmOneWay =
      patch.distanceKmOneWay != null ? parseIntegerKm(patch.distanceKmOneWay) : null;
    if (normalized.distanceKmOneWay != null) {
      normalized.distanceKmRoundTrip = roundTripKmFromOneWay(normalized.distanceKmOneWay);
    }
  }
  return normalized;
}

export function applyCompensationClaimPatch(
  existing: CompensationClaim,
  patch: CompensationClaimPatch,
): CompensationClaim {
  const normalized = normalizeCompensationClaimPatch(patch);
  const input: CompensationClaimInput = {
    competitionId: existing.competitionId,
    refereeId: existing.refereeId,
    refereeName: existing.refereeName,
    tipo: existing.tipo,
    ambito: existing.ambito,
    fecha: existing.fecha,
    fechaFin: existing.fechaFin,
    dutyLines: existing.dutyLines,
    travelMode: normalized.travelMode ?? existing.travelMode,
    distanceKmOneWay:
      normalized.distanceKmOneWay !== undefined
        ? (normalized.distanceKmOneWay ?? undefined)
        : existing.distanceKmOneWay,
    distanceKmRoundTrip:
      normalized.distanceKmRoundTrip !== undefined
        ? (normalized.distanceKmRoundTrip ?? undefined)
        : existing.distanceKmRoundTrip,
    distanceSource:
      normalized.distanceSource !== undefined
        ? (normalized.distanceSource ?? undefined)
        : existing.distanceSource,
    travelApproved: normalized.travelApproved ?? existing.travelApproved,
    travelNotes:
      normalized.travelNotes !== undefined ? (normalized.travelNotes ?? undefined) : existing.travelNotes,
    isCompetitionManager: normalized.isCompetitionManager ?? existing.isCompetitionManager,
    competitionManagerPerDay:
      normalized.competitionManagerPerDay ?? existing.competitionManagerPerDay,
    isComputerSetup: normalized.isComputerSetup ?? existing.isComputerSetup,
    computerSetupManualAmount:
      normalized.computerSetupAmount !== undefined
        ? (normalized.computerSetupAmount ?? undefined)
        : existing.computerSetupAmount,
    lodgingEligibleOverride:
      normalized.lodgingEligibleOverride !== undefined
        ? (normalized.lodgingEligibleOverride ?? undefined)
        : existing.lodgingEligibleOverride,
    lodgingDaysOverride:
      normalized.lodgingDaysOverride !== undefined
        ? (normalized.lodgingDaysOverride ?? undefined)
        : existing.lodgingDaysOverride,
    status: normalized.status ?? existing.status,
    reviewComment:
      normalized.reviewComment !== undefined
        ? (normalized.reviewComment ?? undefined)
        : existing.reviewComment,
    travelAmountOverride: existing.travelAmountOverride,
  };
  return buildCompensationClaim(existing.id, input, {
    submittedAt: existing.submittedAt,
    reviewedAt: existing.reviewedAt,
    reviewedBy: existing.reviewedBy,
  });
}
