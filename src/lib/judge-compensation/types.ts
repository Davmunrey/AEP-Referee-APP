import type { EventType, RoleKey } from "@/lib/types";

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
  roleKey?: RoleKey;
  roleLabel?: string;
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
  distanceSource?: "osm" | "google_maps" | "manual";
  travelAmountOverride?: number;
  travelApproved: boolean;
  travelNotes?: string;
  isCompetitionManager: boolean;
  competitionManagerPerDay: boolean;
  /** Montaje del ordenador (se paga aparte, una función de sesión). */
  isComputerSetup: boolean;
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
  computerSetupAmount: number;
  totalAmount: number;
  sessionCount: number;
  pesajeCount: number;
  functionCount: number;
  championshipDays: number;
  lodgingEligible: boolean;
  lodgingDays: number;
  /** Falso hasta que km/desplazamiento esté resuelto para este juez. */
  financialComplete: boolean;
}

export interface CompensationClubContact {
  name: string;
  emails: string[];
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
  /** Suma solo de claims con financialComplete. */
  grandTotal: number;
  /** Suma provisional (funciones + resp.) aunque falten km. */
  provisionalTotal: number;
  readiness: import("./readiness").CompensationReadiness;
}
