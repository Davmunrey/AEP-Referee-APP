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
  lines: Array<{
    roleLabel: string;
    dutyType: CompensationDutyLine["dutyType"];
    amount: number;
    unitAmount: number;
  }>;
}

function dutyRoleLabel(line: CompensationDutyLine): string {
  return line.roleLabel ?? (line.dutyType === "pesaje" ? "Pesaje" : "Tarima");
}

/** Agrupa funciones por sesión Sx (posición en tarima + pesaje si aplica). */
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
        if (a.dutyType !== b.dutyType) return a.dutyType === "session" ? -1 : 1;
        return dutyRoleLabel(a).localeCompare(dutyRoleLabel(b), "es");
      });

      return {
        session,
        label: sessionLabel(session),
        lines: sorted.map((duty) => ({
          roleLabel: dutyRoleLabel(duty),
          dutyType: duty.dutyType,
          amount: duty.amount,
          unitAmount: duty.unitAmount,
        })),
      };
    });
}

export function buildClaimBreakdown(claim: CompensationClaim): CompensationBreakdownLine[] {
  const lines: CompensationBreakdownLine[] = [];

  for (const group of groupDutiesBySession(claim.dutyLines)) {
    for (const line of group.lines) {
      lines.push({
        group: group.label,
        label: `${group.label} · ${line.roleLabel}`,
        detail: formatReceiptAmountEur(line.unitAmount),
        amount: line.amount,
      });
    }
  }

  if (claim.isComputerSetup && (claim.computerSetupAmount ?? 0) > 0) {
    lines.push({
      label: "Montaje sistema (Liftingcast / OpenLifter / Goodlift)",
      amount: claim.computerSetupAmount ?? 0,
    });
  }

  if (claim.travelMode === "shared_vehicle_passenger") {
    lines.push({
      label: "Desplazamiento",
      detail: claim.distanceKmRoundTrip != null ? `${claim.distanceKmRoundTrip} km i+v (comparte vehículo)` : "Comparte vehículo",
      amount: 0,
    });
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

function roleAbbrev(roleLabel: string, dutyType: CompensationDutyLine["dutyType"]): string {
  if (dutyType === "pesaje") return "Pz";
  const short = roleLabel
    .replace(/^Juez\s+/i, "")
    .replace(/\s*\/.*$/, "")
    .split(/\s+/)[0]
    ?.slice(0, 4);
  return short ?? "Tar";
}

/** Resumen compacto por sesión: S1(Cent+Pz) · S2 */
export function formatDutySessionsSummary(claim: Pick<CompensationClaim, "dutyLines">): string {
  const groups = groupDutiesBySession(claim.dutyLines);
  if (groups.length === 0) return "—";

  return groups
    .map((g) => {
      const parts = g.lines.map((l) => roleAbbrev(l.roleLabel, l.dutyType));
      const unique = [...new Set(parts)];
      return unique.length > 1 ? `${g.label}(${unique.join("+")})` : `${g.label}${unique[0] === "Pz" ? "P" : ""}`;
    })
    .join(" · ");
}
