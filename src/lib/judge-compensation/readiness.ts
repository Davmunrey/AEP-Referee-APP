import { isResolvedIntegerKm, parseIntegerKm } from "./km";
import type { CompensationClaim, CompensationTravelMode, CompensationClubContact } from "./types";
import type { Competition } from "@/lib/types";
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

/**
 * Por qué el botón «Recibo» de un juez está apagado.
 *
 * El botón se deshabilitaba sin decir nada: quien lo miraba no tenía forma de
 * saber que lo único que falta son los km. Mismo motivo que devuelve la ruta
 * de exportación con un 422.
 */
export const RECEIPT_INCOMPLETE_HINT =
  "Faltan los km de desplazamiento de este juez: introdúcelos (o marca que comparte vehículo) para poder exportar su recibo.";

/**
 * Etiqueta del total provisional.
 *
 * Ponía «Provisional (sin km)» siempre, también cuando ya había km metidos y
 * el importe sí los incluía: la cifra y su rótulo decían cosas distintas. Con
 * el número de jueces pendientes se dice lo que de verdad falta.
 */
export function provisionalTotalLabel(pendingTravelCount: number): string {
  if (pendingTravelCount <= 0) return "Provisional";
  return pendingTravelCount === 1
    ? "Provisional · falta el km de 1 juez"
    : `Provisional · faltan los km de ${pendingTravelCount} jueces`;
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

/** Los km se introducen manualmente; no se exige geocodificar la sede. */
export function competitionVenueReady(_comp: Pick<Competition, "sedeDireccion" | "sedeLat" | "sedeLng">): boolean {
  return true;
}

export function isTravelModeResolved(
  travelMode: CompensationTravelMode,
  roundTripKm?: number | null,
  oneWayKm?: number | null,
): boolean {
  if (travelMode === "none") return true;
  // No uses `!`: parseIntegerKm devuelve null para km inválidos (negativos,
  // no finitos) y `null * 2 === 0` marcaría como resuelto un viaje sin distancia.
  const ow = parseIntegerKm(oneWayKm);
  const rt =
    roundTripKm != null
      ? parseIntegerKm(roundTripKm)
      : ow != null
        ? ow * 2
        : null;
  return isResolvedIntegerKm(rt);
}

export function isClaimTravelResolved(claim: Pick<CompensationClaim, "travelMode" | "distanceKmRoundTrip" | "distanceKmOneWay">): boolean {
  return isTravelModeResolved(claim.travelMode, claim.distanceKmRoundTrip, claim.distanceKmOneWay);
}

export function assessCompensationReadiness(input: {
  competition: Competition;
  claims: CompensationClaim[];
  refereesById: Map<string, import("@/lib/types").Referee>;
  organizerIsClub: boolean;
  clubEmails: string[];
}): CompensationReadiness {
  const issues: string[] = [];
  const pendingTravelReferees: string[] = [];

  if (input.organizerIsClub && input.clubEmails.length === 0) {
    issues.push("Configura al menos un e-mail del club organizador.");
  }

  for (const claim of input.claims) {
    if (!isClaimTravelResolved(claim)) {
      pendingTravelReferees.push(claim.refereeName);
    }
  }

  if (pendingTravelReferees.length > 0) {
    issues.push(
      `Km pendientes (introduce manualmente): ${pendingTravelReferees.slice(0, 3).join(", ")}${pendingTravelReferees.length > 3 ? "…" : ""}.`,
    );
  }

  const allTravelResolved = pendingTravelReferees.length === 0;
  const readyForExport =
    allTravelResolved &&
    input.claims.length > 0 &&
    input.claims.every((c) => c.financialComplete && c.totalAmount > 0) &&
    (!input.organizerIsClub || input.clubEmails.length > 0);

  return {
    venueReady: true,
    allTravelResolved,
    pendingTravelReferees,
    missingDomicilioReferees: [],
    issues,
    readyForExport,
  };
}
