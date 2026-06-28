import { isPositiveIntegerKm, parseIntegerKm } from "./km";
import type { CompensationClaim, CompensationTravelMode, CompensationClubContact } from "./types";
import type { Competition, Referee } from "@/lib/types";
import { normalizeClubEmails } from "@/lib/organizer-clubs";

export interface CompensationReadiness {
  venueReady: boolean;
  venueIssue?: string;
  allTravelResolved: boolean;
  pendingTravelReferees: string[];
  missingDomicilioReferees: string[];
  issues: string[];
  readyForExport: boolean;
}

export function competitionClubContacts(
  comp: Pick<Competition, "compensationClubs" | "compensationClubName" | "compensationClubEmail">,
): CompensationClubContact[] {
  if (comp.compensationClubs?.length) return comp.compensationClubs;
  if (comp.compensationClubName?.trim()) {
    return [
      {
        name: comp.compensationClubName.trim(),
        emails: comp.compensationClubEmail ? normalizeClubEmails(comp.compensationClubEmail) : [],
      },
    ];
  }
  return [];
}

export function allClubEmailsFromCompetition(
  comp: Pick<Competition, "compensationClubs" | "compensationClubName" | "compensationClubEmail">,
): string[] {
  const emails = competitionClubContacts(comp).flatMap((c) => c.emails);
  return [...new Set(emails)];
}

export function competitionVenueReady(comp: Pick<Competition, "sedeDireccion" | "sedeLat" | "sedeLng">): boolean {
  return Boolean(comp.sedeDireccion?.trim() && comp.sedeLat != null && comp.sedeLng != null);
}

export function refereeDomicilioReady(ref: Pick<Referee, "domicilio" | "domicilioLat" | "domicilioLng">): boolean {
  return Boolean(ref.domicilio?.trim() && ref.domicilioLat != null && ref.domicilioLng != null);
}

export function isTravelModeResolved(
  travelMode: CompensationTravelMode,
  roundTripKm?: number | null,
  oneWayKm?: number | null,
): boolean {
  if (travelMode === "shared_vehicle_passenger" || travelMode === "none") return true;
  const rt =
    roundTripKm != null
      ? parseIntegerKm(roundTripKm)
      : oneWayKm != null
        ? parseIntegerKm(oneWayKm)! * 2
        : null;
  return isPositiveIntegerKm(rt);
}

export function isClaimTravelResolved(claim: Pick<CompensationClaim, "travelMode" | "distanceKmRoundTrip" | "distanceKmOneWay">): boolean {
  return isTravelModeResolved(claim.travelMode, claim.distanceKmRoundTrip, claim.distanceKmOneWay);
}

export function assessCompensationReadiness(input: {
  competition: Competition;
  claims: CompensationClaim[];
  refereesById: Map<string, Referee>;
  organizerIsClub: boolean;
  clubEmails: string[];
}): CompensationReadiness {
  const issues: string[] = [];
  const pendingTravelReferees: string[] = [];
  const missingDomicilioReferees: string[] = [];

  if (!competitionVenueReady(input.competition)) {
    issues.push("Falta la dirección de la sede en Google Maps (competición).");
  }

  if (input.organizerIsClub && input.clubEmails.length === 0) {
    issues.push("Configura al menos un e-mail del club organizador.");
  }

  for (const claim of input.claims) {
    const ref = input.refereesById.get(claim.refereeId);
    if (claim.travelMode === "km_rate") {
      if (ref && !refereeDomicilioReady(ref)) {
        missingDomicilioReferees.push(claim.refereeName);
      }
      if (!isClaimTravelResolved(claim)) {
        pendingTravelReferees.push(claim.refereeName);
      }
    } else if (!isClaimTravelResolved(claim)) {
      pendingTravelReferees.push(claim.refereeName);
    }
  }

  if (missingDomicilioReferees.length > 0) {
    issues.push(
      `Domicilio sin geocodificar: ${missingDomicilioReferees.slice(0, 3).join(", ")}${missingDomicilioReferees.length > 3 ? "…" : ""}.`,
    );
  }

  if (pendingTravelReferees.length > 0) {
    issues.push(
      `Km pendientes: ${pendingTravelReferees.slice(0, 3).join(", ")}${pendingTravelReferees.length > 3 ? "…" : ""}.`,
    );
  }

  const venueReady = competitionVenueReady(input.competition);
  const allTravelResolved = pendingTravelReferees.length === 0;
  const readyForExport =
    venueReady &&
    allTravelResolved &&
    input.claims.length > 0 &&
    input.claims.every((c) => c.financialComplete && c.totalAmount > 0) &&
    (!input.organizerIsClub || input.clubEmails.length > 0);

  return {
    venueReady,
    venueIssue: venueReady ? undefined : "Indica la dirección completa de la sede y geocodifícala.",
    allTravelResolved,
    pendingTravelReferees,
    missingDomicilioReferees,
    issues,
    readyForExport,
  };
}
