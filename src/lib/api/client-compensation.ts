import { getApiBaseUrl } from "./config";
import { request } from "./request";
import type {
  CompensationClaim,
  CompetitionCompensationSummary,
  CompensationTravelMode,
  CompensationClaimStatus,
} from "@/lib/judge-compensation/types";

export type CompensationClaimPatch = Partial<{
  travelMode: CompensationTravelMode;
  distanceKmOneWay: number | null;
  distanceKmRoundTrip: number | null;
  distanceSource: "google_maps" | "manual" | null;
  travelApproved: boolean;
  travelNotes: string | null;
  isCompetitionManager: boolean;
  competitionManagerPerDay: boolean;
  lodgingEligibleOverride: boolean | null;
  lodgingDaysOverride: number | null;
  status: CompensationClaimStatus;
  reviewComment: string | null;
}>;

export const compensationApi = {
  getCompensation: (competitionId: string) =>
    request<CompetitionCompensationSummary>(`/competitions/${competitionId}/compensation`),

  recalculateCompensation: (competitionId: string) =>
    request<CompetitionCompensationSummary>(
      `/competitions/${competitionId}/compensation/recalculate`,
      { method: "POST" },
    ),

  updateCompensationClaim: (
    competitionId: string,
    refereeId: string,
    body: CompensationClaimPatch,
  ) =>
    request<CompensationClaim>(`/competitions/${competitionId}/compensation/${refereeId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  calculateCompensationDistance: (competitionId: string, refereeId: string) =>
    request<CompensationClaim>(
      `/competitions/${competitionId}/compensation/${refereeId}/distance`,
      { method: "POST" },
    ),

  exportCompensationReceipt: async (competitionId: string, refereeId: string, iban: string) => {
    const res = await fetch(
      `${getApiBaseUrl()}/competitions/${competitionId}/compensation/${refereeId}/export`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban }),
        credentials: "include",
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Error al exportar recibo");
    }
    return res.blob();
  },
};
