// Submódulos concretos: el barrel arrastra receipt-pdf (→ pdfkit) al cold start.
import { buildCompensationClaim } from "@/lib/judge-compensation/calculate";
import { applyCompensationClaimPatch } from "@/lib/judge-compensation/claim-patch";
import type { CompensationHubSummary } from "@/lib/judge-compensation/hub-types";
import { buildHubSummary } from "@/lib/judge-compensation/hub";
import type {
  CompensationClaim,
  CompensationClaimStatus,
  CompensationTravelMode,
  CompetitionCompensationSummary,
} from "@/lib/judge-compensation/types";
import {
  buildClaimInputFromRoster,
  summarizeCompensation,
} from "./compensation-helpers";
import type { Referee } from "@/lib/types";
import * as competitions from "./memory-competitions";
import * as referees from "./memory-referees";

/** Distancia en línea recta (km) entre dos coordenadas — aproximación dev/local. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Colgado de globalThis como el store principal (store.ts): en dev con HMR y
// bundles por ruta cada instancia del módulo tendría su propio Map y las
// claims guardadas desde una ruta no se verían desde otra.
const globalForCompensation = globalThis as unknown as {
  __aepCompensationStore?: Map<string, CompensationClaim>;
};
const store = (globalForCompensation.__aepCompensationStore ??= new Map<
  string,
  CompensationClaim
>());

function claimId(competitionId: string, refereeId: string): string {
  return `cmp-${competitionId}-${refereeId}`;
}

function key(competitionId: string, refereeId: string): string {
  return `${competitionId}::${refereeId}`;
}

const emptySummary = (competitionId: string): CompetitionCompensationSummary => ({
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
});

async function buildSummary(competitionId: string): Promise<CompetitionCompensationSummary> {
  const competition = await competitions.getCompetition(competitionId);
  if (!competition) return emptySummary(competitionId);
  const roster = await competitions.getRoster(competitionId);
  if (!roster) return emptySummary(competitionId);
  const refereeIds = [...new Set(Object.values(roster.assignments).filter(Boolean))];
  const claims: CompensationClaim[] = [];
  const refereesById = new Map<string, Referee>();

  for (const refereeId of refereeIds) {
    const referee = await referees.getReferee(refereeId);
    if (!referee) continue;
    refereesById.set(refereeId, referee);
    const stored = store.get(key(competitionId, refereeId));
    const claimInput = buildClaimInputFromRoster({
      competition,
      referee,
      template: roster.template,
      assignments: roster.assignments,
      existing: stored,
    });
    const claim = buildCompensationClaim(
      stored?.id ?? claimId(competitionId, refereeId),
      claimInput,
      {
        submittedAt: stored?.submittedAt,
        reviewedAt: stored?.reviewedAt,
        reviewedBy: stored?.reviewedBy,
      },
    );
    claims.push(claim);
  }

  return summarizeCompensation(competition, claims, refereesById);
}

export const memoryCompensationService = {
  getSummary: buildSummary,

  recalculate: async (competitionId: string): Promise<CompetitionCompensationSummary> => {
    const summary = await buildSummary(competitionId);
    for (const claim of summary.claims) {
      store.set(key(competitionId, claim.refereeId), claim);
    }
    return summary;
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

    const claim = applyCompensationClaimPatch(existing, patch);
    store.set(key(competitionId, refereeId), claim);
    return claim;
  },

  calculateDistance: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => {
    const competition = await competitions.getCompetition(competitionId);
    const referee = await referees.getReferee(refereeId);
    if (!competition || !referee?.domicilioLat || !referee.domicilioLng) return undefined;
    if (!competition.sedeLat || !competition.sedeLng) return undefined;
    // Distancia real (haversine) desde las coordenadas ya validadas, no un 50 km
    // fijo que facturaba lo mismo a todos los jueces en el backend dev/local.
    const oneWay = Math.max(
      1,
      Math.round(
        haversineKm(
          referee.domicilioLat,
          referee.domicilioLng,
          competition.sedeLat,
          competition.sedeLng,
        ),
      ),
    );
    return memoryCompensationService.updateClaim(competitionId, refereeId, {
      distanceKmOneWay: oneWay,
      distanceKmRoundTrip: oneWay * 2,
      distanceSource: "manual",
    });
  },

  calculateAllDistances: async (competitionId: string) => {
    const summary = await buildSummary(competitionId);
    for (const claim of summary.claims) {
      if (claim.travelMode === "shared_vehicle_passenger" || claim.travelMode === "none") continue;
      await memoryCompensationService.calculateDistance(competitionId, claim.refereeId);
    }
    return buildSummary(competitionId);
  },

  getClaimForExport: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => {
    const summary = await buildSummary(competitionId);
    return summary.claims.find((c) => c.refereeId === refereeId);
  },

  getHub: async (user?: import("@/lib/types").SessionUser): Promise<CompensationHubSummary> => {
    const list = await competitions.getCompetitions(user);
    const summaries = new Map<string, CompetitionCompensationSummary>();
    for (const comp of list) {
      summaries.set(comp.id, await buildSummary(comp.id));
    }
    return buildHubSummary(list, summaries);
  },
};
