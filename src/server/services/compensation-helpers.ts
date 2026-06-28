import {
  buildCompensationClaim,
  calculateCompensationTotals,
  classifyCompensationDuties,
} from "@/lib/judge-compensation";
import type {
  CompetitionAmbito,
  CompensationClaim,
  CompensationClaimInput,
  CompensationDutyLine,
  CompetitionCompensationSummary,
} from "@/lib/judge-compensation/types";
import type { Competition, CompensationOrganizerType, AssignmentsMap, Referee, RosterSession } from "@/lib/types";
import type { CompensationReceiptOrganizer } from "@/lib/judge-compensation/receipt-document";

export function competitionAmbito(comp: Competition): CompetitionAmbito {
  return comp.ambito === "epf" || comp.ambito === "ipf" ? comp.ambito : "nacional";
}

export function receiptOrganizerFromCompetition(comp: Competition): CompensationReceiptOrganizer {
  const organizer: CompensationOrganizerType = comp.compensationOrganizer ?? "club";
  if (organizer === "aep") {
    return { type: "aep" };
  }
  return {
    type: "club",
    clubName: comp.compensationClubName ?? comp.sede,
    clubEmail: comp.compensationClubEmail ?? "",
    volunteer: comp.compensationVolunteer ?? false,
  };
}

export function buildClaimInputFromRoster(input: {
  competition: Competition;
  referee: Referee;
  template: RosterSession[];
  assignments: AssignmentsMap;
  existing?: Partial<CompensationClaimInput>;
}): CompensationClaimInput {
  const ambito = competitionAmbito(input.competition);
  const dutyLines = classifyCompensationDuties({
    template: input.template,
    assignments: input.assignments,
    refereeId: input.referee.id,
    tipo: input.competition.tipo,
    ambito,
  });

  return {
    competitionId: input.competition.id,
    refereeId: input.referee.id,
    refereeName: input.referee.nombre,
    tipo: input.competition.tipo,
    ambito,
    fecha: input.competition.fecha,
    fechaFin: input.competition.fechaFin,
    dutyLines,
    travelMode: input.existing?.travelMode ?? "km_rate",
    distanceKmOneWay: input.existing?.distanceKmOneWay,
    distanceKmRoundTrip: input.existing?.distanceKmRoundTrip,
    distanceSource: input.existing?.distanceSource,
    travelAmountOverride: input.existing?.travelAmountOverride,
    travelApproved: input.existing?.travelApproved ?? false,
    travelNotes: input.existing?.travelNotes,
    isCompetitionManager: input.existing?.isCompetitionManager ?? false,
    competitionManagerPerDay: input.existing?.competitionManagerPerDay ?? false,
    lodgingDaysOverride: input.existing?.lodgingDaysOverride,
    lodgingEligibleOverride: input.existing?.lodgingEligibleOverride,
    status: input.existing?.status ?? "borrador",
    reviewComment: input.existing?.reviewComment,
  };
}

export function summarizeCompensation(claims: CompensationClaim[]): CompetitionCompensationSummary {
  const grandTotal = claims.reduce((sum, c) => sum + c.totalAmount, 0);
  return {
    competitionId: claims[0]?.competitionId ?? "",
    claims,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

export function mergeDutyLinesIntoClaim(
  id: string,
  input: CompensationClaimInput,
  meta?: Pick<CompensationClaim, "submittedAt" | "reviewedAt" | "reviewedBy">,
): CompensationClaim {
  return buildCompensationClaim(id, input, meta);
}

export function recalculateClaimTotals(claim: CompensationClaim): CompensationClaim {
  const totals = calculateCompensationTotals(claim);
  return { ...claim, ...totals };
}

export type { CompensationDutyLine };
