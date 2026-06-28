import {
  championshipDayCount,
  competitionManagerRate,
  LODGING_MIN_ROUND_TRIP_KM,
  LODGING_PER_DAY_EUR,
  MIN_FUNCTIONS_FOR_LODGING,
  travelAmountFromKm,
} from "./rates";
import { countDutyTypes } from "./classify-duties";
import { isClaimTravelResolved } from "./readiness";
import { parseIntegerKm } from "./km";
import type {
  CompensationClaim,
  CompensationClaimInput,
  CompensationClaimTotals,
  CompensationTravelMode,
} from "./types";

function resolveTravelAmount(input: {
  travelMode: CompensationTravelMode;
  roundTripKm?: number;
  travelAmountOverride?: number;
  travelApproved: boolean;
}): number {
  switch (input.travelMode) {
    case "none":
    case "shared_vehicle_passenger":
      return 0;
    case "fuel_receipt":
    case "transport_ticket":
      return input.travelApproved && input.travelAmountOverride != null
        ? input.travelAmountOverride
        : 0;
    case "km_rate":
    default:
      if (input.travelAmountOverride != null && input.travelApproved) {
        return input.travelAmountOverride;
      }
      return travelAmountFromKm(input.roundTripKm ?? 0);
  }
}

function resolveLodging(input: {
  fecha: string;
  fechaFin: string;
  functionCount: number;
  roundTripKm?: number;
  lodgingEligibleOverride?: boolean;
  lodgingDaysOverride?: number;
}): { lodgingEligible: boolean; lodgingDays: number; lodgingAmount: number } {
  const championshipDays = championshipDayCount(input.fecha, input.fechaFin);
  const kmOk = (input.roundTripKm ?? 0) > LODGING_MIN_ROUND_TRIP_KM;
  const functionsOk = input.functionCount >= MIN_FUNCTIONS_FOR_LODGING;
  let lodgingEligible = kmOk && functionsOk;
  if (input.lodgingEligibleOverride === true) lodgingEligible = true;
  if (input.lodgingEligibleOverride === false) lodgingEligible = false;

  const lodgingDays =
    input.lodgingDaysOverride != null && input.lodgingDaysOverride >= 0
      ? input.lodgingDaysOverride
      : lodgingEligible
        ? championshipDays
        : 0;

  const lodgingAmount = lodgingEligible ? lodgingDays * LODGING_PER_DAY_EUR : 0;
  return { lodgingEligible, lodgingDays, lodgingAmount };
}

export function calculateCompensationTotals(
  input: CompensationClaimInput,
): CompensationClaimTotals {
  const dutiesAmount = input.dutyLines.reduce((sum, line) => sum + line.amount, 0);
  const { sessionCount, pesajeCount, functionCount } = countDutyTypes(input.dutyLines);
  const championshipDays = championshipDayCount(input.fecha, input.fechaFin);

  const roundTripKmRaw =
    input.distanceKmRoundTrip ??
    (input.distanceKmOneWay != null ? input.distanceKmOneWay * 2 : undefined);
  const roundTripKm = roundTripKmRaw != null ? parseIntegerKm(roundTripKmRaw) ?? undefined : undefined;

  const financialComplete = isClaimTravelResolved({
    travelMode: input.travelMode,
    distanceKmRoundTrip: roundTripKm,
    distanceKmOneWay: input.distanceKmOneWay,
  });

  const travelAmount = financialComplete
    ? resolveTravelAmount({
        travelMode: input.travelMode,
        roundTripKm,
        travelAmountOverride: input.travelAmountOverride,
        travelApproved: input.travelApproved,
      })
    : 0;

  const { lodgingEligible, lodgingDays, lodgingAmount } = financialComplete
    ? resolveLodging({
        fecha: input.fecha,
        fechaFin: input.fechaFin,
        functionCount,
        roundTripKm,
        lodgingEligibleOverride: input.lodgingEligibleOverride,
        lodgingDaysOverride: input.lodgingDaysOverride,
      })
    : { lodgingEligible: false, lodgingDays: 0, lodgingAmount: 0 };

  const competitionManagerAmount = input.isCompetitionManager
    ? competitionManagerRate(
        input.tipo,
        input.ambito,
        input.competitionManagerPerDay,
        championshipDays,
      )
    : 0;

  const totalAmount = financialComplete
    ? Math.round((dutiesAmount + travelAmount + lodgingAmount + competitionManagerAmount) * 100) / 100
    : Math.round((dutiesAmount + competitionManagerAmount) * 100) / 100;

  return {
    dutiesAmount,
    travelAmount,
    lodgingAmount,
    competitionManagerAmount,
    totalAmount,
    sessionCount,
    pesajeCount,
    functionCount,
    championshipDays,
    lodgingEligible,
    lodgingDays,
    financialComplete,
  };
}

export function buildCompensationClaim(
  id: string,
  input: CompensationClaimInput,
  meta?: Pick<CompensationClaim, "submittedAt" | "reviewedAt" | "reviewedBy">,
): CompensationClaim {
  return {
    id,
    ...input,
    ...calculateCompensationTotals(input),
    ...meta,
  };
}
