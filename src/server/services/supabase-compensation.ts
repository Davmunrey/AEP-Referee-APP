import {
  buildCompensationClaim,
  fetchDrivingDistanceKm,
  geocodeAddress,
  osmThrottle,
} from "@/lib/judge-compensation";
import type { CompensationHubSummary } from "@/lib/judge-compensation/hub-types";
import { buildHubSummary } from "@/lib/judge-compensation/hub";
import type {
  CompensationClaim,
  CompensationClaimInput,
  CompensationClaimStatus,
  CompensationTravelMode,
  CompetitionCompensationSummary,
} from "@/lib/judge-compensation/types";
import { parseIntegerKm, roundTripKmFromOneWay, oneWayKmFromRoundTrip } from "@/lib/judge-compensation/km";
import type { Competition, Referee, SessionUser } from "@/lib/types";
import {
  claimToDbRow,
  mapCompensationClaimRow,
  mapCompensationDutyLine,
} from "@/server/db/mappers";
import {
  buildClaimInputFromRoster,
  summarizeCompensation,
} from "./compensation-helpers";
import { competitionService } from "./supabase-competitions";
import { refereeService } from "./supabase-referees";
import { rosterService } from "./supabase-roster";
import { db } from "./supabase-helpers";

function claimId(competitionId: string, refereeId: string): string {
  return `cmp-${competitionId}-${refereeId}`;
}

function dutyLineId(claimIdValue: string, index: number): string {
  return `${claimIdValue}-dl-${index}`;
}

async function loadDutyLinesByClaim(
  claimIds: string[],
): Promise<Map<string, ReturnType<typeof mapCompensationDutyLine>[]>> {
  const map = new Map<string, ReturnType<typeof mapCompensationDutyLine>[]>();
  if (claimIds.length === 0) return map;
  const supabase = db();
  const { data } = await supabase
    .from("judge_compensation_duty_lines")
    .select("*")
    .in("claim_id", claimIds);
  for (const row of data ?? []) {
    const cid = String((row as Record<string, unknown>).claim_id);
    const lines = map.get(cid) ?? [];
    lines.push(mapCompensationDutyLine(row as Record<string, unknown>));
    map.set(cid, lines);
  }
  return map;
}

async function loadStoredClaims(
  competitionId: string,
  competition: Competition,
): Promise<Map<string, CompensationClaim>> {
  const supabase = db();
  const { data } = await supabase
    .from("judge_compensation_claims")
    .select("*")
    .eq("competition_id", competitionId);
  const rows = data ?? [];
  const dutyMap = await loadDutyLinesByClaim(rows.map((r) => String((r as Record<string, unknown>).id)));
  const result = new Map<string, CompensationClaim>();
  for (const row of rows) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.id);
    const claim = mapCompensationClaimRow(rec, dutyMap.get(id) ?? [], competition);
    result.set(String(rec.referee_id), claim);
  }
  return result;
}

function assignedRefereeIds(assignments: Record<string, string>): string[] {
  return [...new Set(Object.values(assignments).filter(Boolean))];
}

function mergeClaimFromRoster(input: {
  competition: Competition;
  referee: Referee;
  template: import("@/lib/types").RosterSession[];
  assignments: Record<string, string>;
  existing?: CompensationClaim;
}): CompensationClaim {
  const id = input.existing?.id ?? claimId(input.competition.id, input.referee.id);
  const claimInput = buildClaimInputFromRoster({
    competition: input.competition,
    referee: input.referee,
    template: input.template,
    assignments: input.assignments,
    existing: input.existing,
  });
  return buildCompensationClaim(id, claimInput, {
    submittedAt: input.existing?.submittedAt,
    reviewedAt: input.existing?.reviewedAt,
    reviewedBy: input.existing?.reviewedBy,
  });
}

async function persistClaim(claim: CompensationClaim): Promise<void> {
  const supabase = db();
  const row = claimToDbRow(claim);
  const { error } = await supabase.from("judge_compensation_claims").upsert(row);
  if (error) throw error;

  await supabase.from("judge_compensation_duty_lines").delete().eq("claim_id", claim.id);
  if (claim.dutyLines.length > 0) {
    const lines = claim.dutyLines.map((line, index) => ({
      id: dutyLineId(claim.id, index),
      claim_id: claim.id,
      duty_type: line.dutyType,
      session_label: line.session,
      role_key: line.roleKey ?? null,
      role_label: line.roleLabel ?? null,
      unit_amount: line.unitAmount,
      quantity: line.quantity,
      amount: line.amount,
      slot_keys: line.slotKeys,
    }));
    const { error: lineError } = await supabase.from("judge_compensation_duty_lines").insert(lines);
    if (lineError) throw lineError;
  }
}

async function buildSummary(competitionId: string): Promise<CompetitionCompensationSummary> {
  const competition = await competitionService.getCompetition(competitionId);
  if (!competition) {
    return emptySummary(competitionId);
  }
  const roster = await rosterService.getRoster(competitionId, competitionService.getCompetition);
  if (!roster) {
    return emptySummary(competitionId);
  }
  const stored = await loadStoredClaims(competitionId, competition);
  const claims: CompensationClaim[] = [];
  const refereesById = new Map<string, Referee>();

  for (const refereeId of assignedRefereeIds(roster.assignments)) {
    const referee = await refereeService.getReferee(refereeId);
    if (!referee) continue;
    refereesById.set(refereeId, referee);
    const existing = stored.get(refereeId);
    claims.push(
      mergeClaimFromRoster({
        competition,
        referee,
        template: roster.template,
        assignments: roster.assignments,
        existing,
      }),
    );
  }

  return summarizeCompensation(competition, claims, refereesById);
}

function emptySummary(competitionId: string): CompetitionCompensationSummary {
  return {
    competitionId,
    claims: [],
    grandTotal: 0,
    provisionalTotal: 0,
    readiness: {
      venueReady: false,
      allTravelResolved: true,
      pendingTravelReferees: [],
      missingDomicilioReferees: [],
      issues: [],
      readyForExport: false,
    },
  };
}

export const compensationService = {
  getSummary: buildSummary,

  recalculate: async (competitionId: string): Promise<CompetitionCompensationSummary> => {
    const competition = await competitionService.getCompetition(competitionId);
    if (!competition) return emptySummary(competitionId);

    const roster = await rosterService.getRoster(competitionId, competitionService.getCompetition);
    if (!roster) return emptySummary(competitionId);
    const stored = await loadStoredClaims(competitionId, competition);
    const claims: CompensationClaim[] = [];
    const refereesById = new Map<string, Referee>();

    for (const refereeId of assignedRefereeIds(roster.assignments)) {
      const referee = await refereeService.getReferee(refereeId);
      if (!referee) continue;
      refereesById.set(refereeId, referee);
      const existing = stored.get(refereeId);
      const claim = mergeClaimFromRoster({
        competition,
        referee,
        template: roster.template,
        assignments: roster.assignments,
        existing: existing
          ? { ...existing, status: existing.status === "pagado" ? "pagado" : "borrador" }
          : undefined,
      });
      await persistClaim(claim);
      claims.push(claim);
    }

    const activeIds = new Set(claims.map((c) => c.refereeId));
    const supabase = db();
    for (const [refereeId, storedClaim] of stored) {
      if (!activeIds.has(refereeId)) {
        await supabase.from("judge_compensation_claims").delete().eq("id", storedClaim.id);
      }
    }

    return summarizeCompensation(competition, claims, refereesById);
  },

  updateClaim: async (
    competitionId: string,
    refereeId: string,
    patch: Partial<{
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
    }>,
  ): Promise<CompensationClaim | undefined> => {
    const summary = await buildSummary(competitionId);
    const existing = summary.claims.find((c) => c.refereeId === refereeId);
    if (!existing) return undefined;

    const normalizedPatch = { ...patch };
    if (patch.distanceKmRoundTrip !== undefined) {
      normalizedPatch.distanceKmRoundTrip =
        patch.distanceKmRoundTrip != null ? parseIntegerKm(patch.distanceKmRoundTrip) : null;
      if (normalizedPatch.distanceKmRoundTrip != null) {
        normalizedPatch.distanceKmOneWay = oneWayKmFromRoundTrip(normalizedPatch.distanceKmRoundTrip);
      }
    }
    if (patch.distanceKmOneWay !== undefined && patch.distanceKmRoundTrip === undefined) {
      normalizedPatch.distanceKmOneWay =
        patch.distanceKmOneWay != null ? parseIntegerKm(patch.distanceKmOneWay) : null;
      if (normalizedPatch.distanceKmOneWay != null) {
        normalizedPatch.distanceKmRoundTrip = roundTripKmFromOneWay(normalizedPatch.distanceKmOneWay);
      }
    }

    const input: CompensationClaimInput = {
      competitionId: existing.competitionId,
      refereeId: existing.refereeId,
      refereeName: existing.refereeName,
      tipo: existing.tipo,
      ambito: existing.ambito,
      fecha: existing.fecha,
      fechaFin: existing.fechaFin,
      dutyLines: existing.dutyLines,
      travelMode: normalizedPatch.travelMode ?? existing.travelMode,
      distanceKmOneWay:
        normalizedPatch.distanceKmOneWay !== undefined
          ? (normalizedPatch.distanceKmOneWay ?? undefined)
          : existing.distanceKmOneWay,
      distanceKmRoundTrip:
        normalizedPatch.distanceKmRoundTrip !== undefined
          ? (normalizedPatch.distanceKmRoundTrip ?? undefined)
          : existing.distanceKmRoundTrip,
      distanceSource:
        normalizedPatch.distanceSource !== undefined
          ? (normalizedPatch.distanceSource ?? undefined)
          : existing.distanceSource,
      travelApproved: normalizedPatch.travelApproved ?? existing.travelApproved,
      travelNotes:
        normalizedPatch.travelNotes !== undefined ? (normalizedPatch.travelNotes ?? undefined) : existing.travelNotes,
      isCompetitionManager: normalizedPatch.isCompetitionManager ?? existing.isCompetitionManager,
      competitionManagerPerDay:
        normalizedPatch.competitionManagerPerDay ?? existing.competitionManagerPerDay,
      isComputerSetup: normalizedPatch.isComputerSetup ?? existing.isComputerSetup,
      computerSetupManualAmount:
        normalizedPatch.computerSetupAmount !== undefined
          ? (normalizedPatch.computerSetupAmount ?? undefined)
          : existing.computerSetupAmount,
      lodgingEligibleOverride:
        normalizedPatch.lodgingEligibleOverride !== undefined
          ? (normalizedPatch.lodgingEligibleOverride ?? undefined)
          : existing.lodgingEligibleOverride,
      lodgingDaysOverride:
        normalizedPatch.lodgingDaysOverride !== undefined
          ? (normalizedPatch.lodgingDaysOverride ?? undefined)
          : existing.lodgingDaysOverride,
      status: normalizedPatch.status ?? existing.status,
      reviewComment:
        normalizedPatch.reviewComment !== undefined
          ? (normalizedPatch.reviewComment ?? undefined)
          : existing.reviewComment,
    };

    const claim = buildCompensationClaim(existing.id, input, {
      submittedAt: existing.submittedAt,
      reviewedAt: existing.reviewedAt,
      reviewedBy: existing.reviewedBy,
    });
    await persistClaim(claim);
    return claim;
  },

  calculateDistance: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => {
    const competition = await competitionService.getCompetition(competitionId);
    const referee = await refereeService.getReferee(refereeId);
    if (!competition || !referee) return undefined;

    const origin = {
      address: referee.domicilio,
      lat: referee.domicilioLat,
      lng: referee.domicilioLng,
    };
    const destination = {
      address: competition.sedeDireccion ?? competition.sede,
      lat: competition.sedeLat,
      lng: competition.sedeLng,
    };

    if (origin.lat == null || origin.lng == null) {
      if (!referee.domicilio?.trim()) return undefined;
      const geo = await geocodeAddress(referee.domicilio);
      origin.lat = geo.lat;
      origin.lng = geo.lng;
      await osmThrottle();
    }
    if (destination.lat == null || destination.lng == null) {
      const addr = competition.sedeDireccion ?? competition.sede;
      if (!addr?.trim()) return undefined;
      const geo = await geocodeAddress(addr);
      destination.lat = geo.lat;
      destination.lng = geo.lng;
      await osmThrottle();
    }

    const result = await fetchDrivingDistanceKm(origin, destination);
    const roundTrip = roundTripKmFromOneWay(result.distanceKmOneWay);

    return compensationService.updateClaim(competitionId, refereeId, {
      distanceKmOneWay: result.distanceKmOneWay,
      distanceKmRoundTrip: roundTrip,
      distanceSource: "osm",
      travelMode: "km_rate",
    });
  },

  calculateAllDistances: async (competitionId: string): Promise<CompetitionCompensationSummary> => {
    const summary = await buildSummary(competitionId);
    for (const claim of summary.claims) {
      if (claim.travelMode === "shared_vehicle_passenger" || claim.travelMode === "none") continue;
      await compensationService.calculateDistance(competitionId, claim.refereeId);
      await osmThrottle(300);
    }
    return buildSummary(competitionId);
  },

  getHub: async (user: SessionUser): Promise<CompensationHubSummary> => {
    const competitions = await competitionService.getCompetitions(user);
    const summaries = new Map<string, CompetitionCompensationSummary>();
    for (const comp of competitions) {
      summaries.set(comp.id, await buildSummary(comp.id));
    }
    return buildHubSummary(competitions, summaries);
  },

  getClaimForExport: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => {
    const summary = await buildSummary(competitionId);
    return summary.claims.find((c) => c.refereeId === refereeId);
  },
};
