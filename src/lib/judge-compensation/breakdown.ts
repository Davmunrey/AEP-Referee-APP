import { formatReceiptAmountEur } from "./receipt-document";
import { compareSessions, sessionLabel } from "@/lib/session-order";
import type { CompensationClaim, CompensationDutyLine } from "./types";

export interface CompensationBreakdownLine {
  label: string;
  detail?: string;
  amount: number;
  group?: string;
}

export interface CompensationSessionBreakdown {
  session: string;
  label: string;
  ordenadorAmount: number;
  pesajeAmount: number;
  lines: Array<{
    kind: "ordenador" | "pesaje";
    amount: number;
    unitAmount: number;
  }>;
}

function dutyKindLabel(dutyType: CompensationDutyLine["dutyType"]): "ordenador" | "pesaje" {
  return dutyType === "pesaje" ? "pesaje" : "ordenador";
}

/** Agrupa funciones por sesión Sx (ordenador + pesaje). */
export function groupDutiesBySession(dutyLines: CompensationDutyLine[]): CompensationSessionBreakdown[] {
  const map = new Map<string, CompensationDutyLine[]>();

  for (const duty of dutyLines) {
    const list = map.get(duty.session) ?? [];
    list.push(duty);
    map.set(duty.session, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => compareSessions(a, b))
    .map(([session, duties]) => {
      const sorted = [...duties].sort((a, b) => {
        if (a.dutyType === b.dutyType) return 0;
        return a.dutyType === "session" ? -1 : 1;
      });

      let ordenadorAmount = 0;
      let pesajeAmount = 0;
      const lines: CompensationSessionBreakdown["lines"] = [];

      for (const duty of sorted) {
        const kind = dutyKindLabel(duty.dutyType);
        if (kind === "ordenador") ordenadorAmount += duty.amount;
        else pesajeAmount += duty.amount;
        lines.push({ kind, amount: duty.amount, unitAmount: duty.unitAmount });
      }

      return {
        session,
        label: sessionLabel(session),
        ordenadorAmount,
        pesajeAmount,
        lines,
      };
    });
}

export function buildClaimBreakdown(claim: CompensationClaim): CompensationBreakdownLine[] {
  const lines: CompensationBreakdownLine[] = [];

  for (const group of groupDutiesBySession(claim.dutyLines)) {
    for (const line of group.lines) {
      const kindLabel = line.kind === "pesaje" ? "Pesaje" : "Ordenador";
      lines.push({
        group: group.label,
        label: `${group.label} · ${kindLabel}`,
        detail: formatReceiptAmountEur(line.unitAmount),
        amount: line.amount,
      });
    }
  }

  if (claim.travelMode === "shared_vehicle_passenger") {
    lines.push({ label: "Desplazamiento", detail: "Comparte vehículo", amount: 0 });
  } else if (claim.travelMode === "none") {
    lines.push({ label: "Desplazamiento", detail: "Sin desplazamiento", amount: 0 });
  } else if (claim.distanceKmRoundTrip != null) {
    lines.push({
      label: "Desplazamiento",
      detail: `${claim.distanceKmRoundTrip} km i+v`,
      amount: claim.travelAmount,
    });
  } else {
    lines.push({ label: "Desplazamiento", detail: "Km pendiente", amount: 0 });
  }

  if (claim.lodgingAmount > 0) {
    lines.push({
      label: "Alojamiento",
      detail: `${claim.lodgingDays} día(s)`,
      amount: claim.lodgingAmount,
    });
  }

  if (claim.competitionManagerAmount > 0) {
    lines.push({
      label: "Responsable competición",
      amount: claim.competitionManagerAmount,
    });
  }

  return lines;
}

/** Resumen compacto por sesión: S1 · S2P · S3 */
export function formatDutySessionsSummary(claim: Pick<CompensationClaim, "dutyLines">): string {
  const groups = groupDutiesBySession(claim.dutyLines);
  if (groups.length === 0) return "—";

  return groups
    .map((g) => {
      if (g.ordenadorAmount > 0 && g.pesajeAmount > 0) return `${g.label}(O+P)`;
      if (g.pesajeAmount > 0) return `${g.label}P`;
      return g.label;
    })
    .join(" · ");
}
