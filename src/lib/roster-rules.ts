import type { AssignValidation, EventType, Referee, RefereeLevel, RoleKey } from "./types";

const LEVEL_RANK: Record<RefereeLevel, number> = {
  Regional: 1,
  Nacional: 2,
  "IPF Cat. 2": 3,
  "IPF Cat. 1": 4,
};

const MIN_LEVEL_BY_ROLE: Partial<Record<RoleKey, RefereeLevel>> = {
  central: "Nacional",
  lateral: "Nacional",
  jurado: "Regional",
};

export function minLevelForRole(roleKey: RoleKey, eventType: EventType): RefereeLevel {
  if (eventType === "AEP-1") {
    if (roleKey === "central" || roleKey === "lateral") return "IPF Cat. 2";
    if (roleKey === "jurado") return "Nacional";
  }
  return MIN_LEVEL_BY_ROLE[roleKey] ?? "Regional";
}

export function validateAssignment(
  referee: Referee,
  roleKey: RoleKey,
  eventType: EventType,
): AssignValidation {
  if (referee.estado !== "Activo") {
    return { ok: false, error: "El árbitro no está activo" };
  }
  if (!referee.disp) {
    return { ok: false, error: "El árbitro no está disponible" };
  }
  const required = minLevelForRole(roleKey, eventType);
  if (LEVEL_RANK[referee.nivel] < LEVEL_RANK[required]) {
    return {
      ok: false,
      error: `Nivel mínimo para este rol: ${required} (tiene ${referee.nivel})`,
    };
  }
  return { ok: true };
}

export function countOpenSlots(
  template: { roles: { slots: number }[] }[],
  assignments: Record<string, string>,
): number {
  let total = 0;
  let filled = 0;
  for (const session of template) {
    for (const role of session.roles) {
      total += role.slots;
    }
  }
  filled = Object.values(assignments).filter(Boolean).length;
  return Math.max(0, total - filled);
}
