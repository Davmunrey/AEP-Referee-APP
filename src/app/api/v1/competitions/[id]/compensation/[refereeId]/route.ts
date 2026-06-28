import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type {
  CompensationClaimStatus,
  CompensationTravelMode,
} from "@/lib/judge-compensation/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string; refereeId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id, refereeId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Cuerpo inválido", 400);

  const updated = await dataService.updateCompensationClaim(id, refereeId, {
    travelMode: body.travelMode as CompensationTravelMode | undefined,
    distanceKmOneWay: body.distanceKmOneWay as number | null | undefined,
    distanceKmRoundTrip: body.distanceKmRoundTrip as number | null | undefined,
    distanceSource: body.distanceSource as "osm" | "google_maps" | "manual" | null | undefined,
    travelApproved: typeof body.travelApproved === "boolean" ? body.travelApproved : undefined,
    travelNotes: body.travelNotes as string | null | undefined,
    isCompetitionManager:
      typeof body.isCompetitionManager === "boolean" ? body.isCompetitionManager : undefined,
    competitionManagerPerDay:
      typeof body.competitionManagerPerDay === "boolean"
        ? body.competitionManagerPerDay
        : undefined,
    isComputerSetup:
      typeof body.isComputerSetup === "boolean" ? body.isComputerSetup : undefined,
    lodgingEligibleOverride:
      body.lodgingEligibleOverride === null
        ? null
        : typeof body.lodgingEligibleOverride === "boolean"
          ? body.lodgingEligibleOverride
          : undefined,
    lodgingDaysOverride:
      body.lodgingDaysOverride === null
        ? null
        : typeof body.lodgingDaysOverride === "number"
          ? body.lodgingDaysOverride
          : undefined,
    status: body.status as CompensationClaimStatus | undefined,
    reviewComment: body.reviewComment as string | null | undefined,
  });

  if (!updated) return jsonError("Claim no encontrado para este juez", 404);
  return jsonOk(updated);
}
