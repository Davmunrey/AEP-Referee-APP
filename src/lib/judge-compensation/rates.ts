import type { EventType } from "@/lib/types";
import type { CompetitionAmbito, CompensationDutyType } from "./types";

/** Baremo AEP — revisión 31/10/2025. */
export const COMPENSATION_RATES_REVISION = "2025-10-31";

export const KM_RATE_EUR = 0.13;
export const LODGING_MIN_ROUND_TRIP_KM = 150;
export const LODGING_PER_DAY_EUR = 25;
export const MIN_FUNCTIONS_FOR_LODGING = 2;

const SESSION_EUR: Record<EventType, { nacional: number; internacional: number }> = {
  "AEP-3": { nacional: 30, internacional: 40 },
  "AEP-2": { nacional: 30, internacional: 40 },
  "AEP-1": { nacional: 40, internacional: 40 },
};

const PESAJE_EUR: Record<EventType, { nacional: number; internacional: number }> = {
  "AEP-3": { nacional: 15, internacional: 20 },
  "AEP-2": { nacional: 15, internacional: 20 },
  "AEP-1": { nacional: 20, internacional: 20 },
};

const MANAGER_EUR: Record<EventType, number> = {
  "AEP-3": 20,
  "AEP-2": 20,
  "AEP-1": 20,
};

export function isInternationalAmbito(ambito: CompetitionAmbito): boolean {
  return ambito === "epf" || ambito === "ipf";
}

export function unitRateForDuty(
  dutyType: CompensationDutyType,
  tipo: EventType,
  ambito: CompetitionAmbito,
): number {
  if (isInternationalAmbito(ambito)) {
    return dutyType === "pesaje" ? PESAJE_EUR[tipo].internacional : SESSION_EUR[tipo].internacional;
  }
  return dutyType === "pesaje" ? PESAJE_EUR[tipo].nacional : SESSION_EUR[tipo].nacional;
}

export function competitionManagerRate(
  tipo: EventType,
  ambito: CompetitionAmbito,
  perDay: boolean,
  championshipDays: number,
): number {
  if (isInternationalAmbito(ambito)) return 0;
  const base = MANAGER_EUR[tipo];
  return perDay ? base * championshipDays : base;
}

export function travelAmountFromKm(roundTripKm: number): number {
  if (!Number.isFinite(roundTripKm) || roundTripKm <= 0) return 0;
  return Math.round(roundTripKm * KM_RATE_EUR * 100) / 100;
}

export function championshipDayCount(fecha: string, fechaFin: string): number {
  const start = new Date(fecha);
  const end = new Date(fechaFin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
