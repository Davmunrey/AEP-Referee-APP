import { formatReceiptAmountEur } from "./receipt-document";
import type { CompensationClaim } from "./types";

export interface CompensationBreakdownLine {
  label: string;
  detail?: string;
  amount: number;
}

export function buildClaimBreakdown(claim: CompensationClaim): CompensationBreakdownLine[] {
  const lines: CompensationBreakdownLine[] = [];

  for (const duty of claim.dutyLines) {
    const kind = duty.dutyType === "pesaje" ? "Pesaje" : "Sesión";
    lines.push({
      label: `${kind} ${duty.session}`,
      detail: `${duty.quantity} × ${formatReceiptAmountEur(duty.unitAmount)}`,
      amount: duty.amount,
    });
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
