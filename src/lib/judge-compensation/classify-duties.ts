import { parseSlotKey } from "@/lib/roster-template";
import type { AssignmentsMap, RoleKey, RosterSession } from "@/lib/types";
import type { CompensationDutyLine, CompensationDutyType } from "./types";
import { unitRateForDuty } from "./rates";
import type { CompetitionAmbito } from "./types";
import type { EventType } from "@/lib/types";

const PESAJE_ROLE_KEYS = new Set<RoleKey>(["pesaje", "equipamiento", "material"]);

function dutyTypeForRole(roleKey: RoleKey): CompensationDutyType {
  return PESAJE_ROLE_KEYS.has(roleKey) ? "pesaje" : "session";
}

/** Agrupa asignaciones del juez en líneas de compensación (una por sesión × tipo). */
export function classifyCompensationDuties(input: {
  template: RosterSession[];
  assignments: AssignmentsMap;
  refereeId: string;
  tipo: EventType;
  ambito: CompetitionAmbito;
}): CompensationDutyLine[] {
  const byKey = new Map<string, { dutyType: CompensationDutyType; session: string; slotKeys: string[] }>();

  for (const [slotKey, assignedId] of Object.entries(input.assignments)) {
    if (assignedId !== input.refereeId) continue;
    const parsed = parseSlotKey(slotKey);
    if (!parsed) continue;
    const dutyType = dutyTypeForRole(parsed.roleKey);
    const mapKey = `${parsed.session}::${dutyType}`;
    const existing = byKey.get(mapKey);
    if (existing) {
      existing.slotKeys.push(slotKey);
    } else {
      byKey.set(mapKey, { dutyType, session: parsed.session, slotKeys: [slotKey] });
    }
  }

  const lines: CompensationDutyLine[] = [];
  for (const entry of byKey.values()) {
    const unitAmount = unitRateForDuty(entry.dutyType, input.tipo, input.ambito);
    lines.push({
      dutyType: entry.dutyType,
      session: entry.session,
      unitAmount,
      quantity: 1,
      amount: unitAmount,
      slotKeys: entry.slotKeys,
    });
  }

  return lines.sort(
    (a, b) => a.session.localeCompare(b.session, "es") || a.dutyType.localeCompare(b.dutyType),
  );
}

export function countDutyTypes(lines: CompensationDutyLine[]): {
  sessionCount: number;
  pesajeCount: number;
  functionCount: number;
} {
  const sessionCount = lines.filter((l) => l.dutyType === "session").length;
  const pesajeCount = lines.filter((l) => l.dutyType === "pesaje").length;
  return { sessionCount, pesajeCount, functionCount: sessionCount + pesajeCount };
}
