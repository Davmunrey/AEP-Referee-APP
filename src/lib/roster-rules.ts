import type {
  AssignValidation,
  AssignmentsMap,
  EventType,
  Referee,
  RefereeLevel,
  RoleKey,
  RosterSession,
} from "./types";

const LEVEL_RANK: Record<RefereeLevel, number> = {
  Regional: 1,
  Nacional: 2,
  "IPF Cat. 2": 3,
  "IPF Cat. 1": 4,
};

const MIN_LEVEL_BY_ROLE: Partial<Record<RoleKey, RefereeLevel>> = {
  central: "Nacional",
  lateral: "Nacional",
  control: "Nacional",
  jurado: "Regional",
  ordenador: "Regional",
  speaker: "Regional",
  pesaje: "Regional",
  equipamiento: "Regional",
  material: "Regional",
  mesa: "Regional",
  liftingcast: "Regional",
};

export function minLevelForRole(roleKey: RoleKey, eventType: EventType): RefereeLevel {
  void eventType;
  if (roleKey === "jurado") return "IPF Cat. 2";
  return MIN_LEVEL_BY_ROLE[roleKey] ?? "Regional";
}

export function validateAssignment(
  referee: Referee,
  roleKey: RoleKey,
  eventType: EventType,
): AssignValidation {
  void roleKey;
  void eventType;
  if (referee.estado !== "Activo") {
    return { ok: false, error: "El juez no está activo" };
  }
  if (!referee.disp) {
    return { ok: false, error: "El juez no está disponible" };
  }
  return { ok: true };
}

export function isBelowRecommendedLevel(
  refereeLevel: RefereeLevel,
  roleKey: RoleKey,
): boolean {
  if (roleKey !== "jurado") return false;
  return LEVEL_RANK[refereeLevel] < LEVEL_RANK["IPF Cat. 2"];
}

function parseSlotKey(slotKey: string): { session: string; roleKey: RoleKey } | null {
  const [session, roleKey] = slotKey.split("_");
  if (!session || !roleKey) return null;
  return { session, roleKey: roleKey as RoleKey };
}

function sessionIndex(template: RosterSession[], session: string): number {
  return template.findIndex((item) => item.sesion.toLowerCase() === session.toLowerCase());
}

function isTarimaRole(roleKey: RoleKey): boolean {
  return ["central", "lateral", "control", "ordenador", "speaker", "jurado"].includes(roleKey);
}

function isPesajeOrMaterialRole(roleKey: RoleKey): boolean {
  return ["pesaje", "equipamiento", "material"].includes(roleKey);
}

export function validateRosterOperation(input: {
  template: RosterSession[];
  assignments: AssignmentsMap;
  slotKey: string;
  refereeId: string;
}): AssignValidation {
  const target = parseSlotKey(input.slotKey);
  if (!target) return { ok: false, error: "Slot inválido" };

  const targetIndex = sessionIndex(input.template, target.session);
  for (const [slotKey, assignedRefereeId] of Object.entries(input.assignments)) {
    if (slotKey === input.slotKey || assignedRefereeId !== input.refereeId) continue;
    const existing = parseSlotKey(slotKey);
    if (!existing) continue;

    if (existing.session === target.session && existing.roleKey === target.roleKey) {
      return {
        ok: false,
        error: "Ese juez ya ocupa ese mismo puesto en esta sesión",
      };
    }

    const existingIndex = sessionIndex(input.template, existing.session);
    if (existingIndex < 0 || targetIndex < 0) continue;
    const targetIsNextPesaje =
      isTarimaRole(existing.roleKey) &&
      isPesajeOrMaterialRole(target.roleKey) &&
      targetIndex === existingIndex + 1;
    const targetIsPreviousTarima =
      isPesajeOrMaterialRole(existing.roleKey) &&
      isTarimaRole(target.roleKey) &&
      existingIndex === targetIndex + 1;

    if (targetIsNextPesaje || targetIsPreviousTarima) {
      return {
        ok: false,
        error: "No puede estar en tarima/jurado y en pesaje o material de la sesión siguiente",
      };
    }
  }

  return { ok: true };
}

export function countOpenSlots(
  template: {
    roles: { slots: number }[];
    pesajeRoles?: { slots: number }[];
  }[],
  assignments: Record<string, string>,
): number {
  let total = 0;
  for (const session of template) {
    for (const role of session.roles) total += role.slots;
    for (const role of session.pesajeRoles ?? []) total += role.slots;
  }
  const filled = Object.values(assignments).filter(Boolean).length;
  return Math.max(0, total - filled);
}
