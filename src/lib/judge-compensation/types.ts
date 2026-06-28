import type { EventType } from "@/lib/types";

/** Ámbito del campeonato para baremo (nacional AEP vs internacional). */
export type CompetitionAmbito = "nacional" | "epf" | "ipf";

export type CompensationDutyType = "session" | "pesaje";

export type CompensationTravelMode =
  | "km_rate"
  | "fuel_receipt"
  | "transport_ticket"
  | "shared_vehicle_passenger"
  | "none";

export type CompensationClaimStatus =
  | "borrador"
  | "enviado"
  | "aprobado"
  | "pagado"
  | "rechazado";

export interface CompensationDutyLine {
  dutyType: CompensationDutyType;
  session: string;
  unitAmount: number;
  quantity: number;
  amount: number;
  slotKeys: string[];
}

export interface CompensationLocation {
  address?: string;
  lat?: number;
  lng?: number;
}

export interface CompensationClaimInput {
  competitionId: string;
  refereeId: string;
  refereeName: string;
  tipo: EventType;
  ambito: CompetitionAmbito;
  fecha: string;
  fechaFin: string;
  dutyLines: CompensationDutyLine[];
  travelMode: CompensationTravelMode;
  distanceKmOneWay?: number;
  distanceKmRoundTrip?: number;
  distanceSource?: "google_maps" | "manual";
  travelAmountOverride?: number;
  travelApproved: boolean;
  travelNotes?: string;
  isCompetitionManager: boolean;
  competitionManagerPerDay: boolean;
  lodgingDaysOverride?: number;
  lodgingEligibleOverride?: boolean;
  status: CompensationClaimStatus;
  reviewComment?: string;
}

export interface CompensationClaimTotals {
  dutiesAmount: number;
  travelAmount: number;
  lodgingAmount: number;
  competitionManagerAmount: number;
  totalAmount: number;
  sessionCount: number;
  pesajeCount: number;
  functionCount: number;
  championshipDays: number;
  lodgingEligible: boolean;
  lodgingDays: number;
}

export interface CompensationClaim extends CompensationClaimInput, CompensationClaimTotals {
  id: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CompetitionCompensationSummary {
  competitionId: string;
  claims: CompensationClaim[];
  grandTotal: number;
}
