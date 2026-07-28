import { enumerateSlotKeys, parseSlotKey } from "./roster-template";
import type {
  AssignValidation,
  AssignmentsMap,
  EventType,
  FlagsMap,
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

function sessionIndex(template: RosterSession[], session: string): number {
  return template.findIndex((item) => item.sesion.toLowerCase() === session.toLowerCase());
}

/**
 * Franja horaria del rol dentro de una sesión:
 * - "tarima": ocurre durante la competición (todos a la vez en tarima/mesa).
 * - "pesaje": ocurre en el pesaje, ~2 h antes de levantar (franja distinta).
 *
 * Dos roles de la misma franja en la misma sesión se solapan en el tiempo;
 * roles de franjas distintas (tarima + pesaje de la misma sesión) son
 * secuenciales y por tanto compatibles para un mismo juez.
 */
type RoleTimeSlot = "tarima" | "pesaje";

function roleTimeSlot(roleKey: RoleKey): RoleTimeSlot {
  switch (roleKey) {
    case "central":
    case "lateral":
    case "control":
    case "ordenador":
    case "speaker":
    case "jurado":
    case "mesa":
    case "liftingcast":
      return "tarima";
    case "pesaje":
    case "equipamiento":
    case "material":
      return "pesaje";
    default: {
      const _exhaustive: never = roleKey;
      return _exhaustive;
    }
  }
}

/** El asterisco (*) marca un puesto como compartido y permite forzar el solape. */
function isShared(flags: FlagsMap | undefined, slotKey: string): boolean {
  return Boolean(flags?.[slotKey]?.compartido);
}

export function validateRosterOperation(input: {
  template: RosterSession[];
  assignments: AssignmentsMap;
  slotKey: string;
  refereeId: string;
  /** Marcadores de slot; un puesto con `compartido` (*) permite forzar el solape. */
  flags?: FlagsMap;
}): AssignValidation {
  const target = parseSlotKey(input.slotKey);
  if (!target) return { ok: false, error: "Slot inválido" };

  const targetIndex = sessionIndex(input.template, target.session);
  const targetSlot = roleTimeSlot(target.roleKey);
  const targetShared = isShared(input.flags, input.slotKey);

  for (const [slotKey, assignedRefereeId] of Object.entries(input.assignments)) {
    if (slotKey === input.slotKey || assignedRefereeId !== input.refereeId) continue;
    const existing = parseSlotKey(slotKey);
    if (!existing) continue;

    // El * en cualquiera de los dos huecos en conflicto permite forzar el solape.
    const overridden = targetShared || isShared(input.flags, slotKey);

    if (existing.session === target.session) {
      // Mismo puesto exacto repetido: nunca tiene sentido (no es solo un solape).
      if (existing.roleKey === target.roleKey) {
        return {
          ok: false,
          error: "Ese juez ya ocupa ese mismo puesto en esta sesión",
        };
      }
      // Dos puestos de la misma franja (tarima+tarima o pesaje+pesaje) se solapan.
      // Tarima + pesaje de la misma sesión son secuenciales → compatibles.
      if (roleTimeSlot(existing.roleKey) === targetSlot && !overridden) {
        return {
          ok: false,
          error:
            "Ese juez ya está asignado en otra posición en esta misma sesión (marca * para permitirlo)",
          overridable: true,
        };
      }
      continue;
    }

    const existingIndex = sessionIndex(input.template, existing.session);
    if (existingIndex < 0 || targetIndex < 0) continue;
    // Solo hay solape real entre sesiones consecutivas DEL MISMO DÍA: el pesaje
    // de la primera sesión del sábado no choca con la tarima del viernes.
    const sameDay =
      input.template[existingIndex]?.dia === input.template[targetIndex]?.dia;
    const existingSlot = roleTimeSlot(existing.roleKey);
    const targetIsNextPesaje =
      sameDay &&
      existingSlot === "tarima" && targetSlot === "pesaje" && targetIndex === existingIndex + 1;
    const targetIsPreviousTarima =
      sameDay &&
      existingSlot === "pesaje" && targetSlot === "tarima" && existingIndex === targetIndex + 1;

    if ((targetIsNextPesaje || targetIsPreviousTarima) && !overridden) {
      return {
        ok: false,
        error:
          "No puede estar en tarima/jurado y en pesaje o material de la sesión siguiente (marca * para permitirlo)",
        overridable: true,
      };
    }
  }

  return { ok: true };
}

export function countOpenSlots(
  template: {
    sesion?: string;
    roles: { slots: number; key?: string }[];
    pesajeRoles?: { slots: number; key?: string }[];
  }[],
  assignments: Record<string, string>,
): number {
  const validKeys = new Set(enumerateSlotKeys(template as RosterSession[]));
  let total = 0;
  for (const session of template) {
    for (const role of session.roles) total += role.slots;
    for (const role of session.pesajeRoles ?? []) total += role.slots;
  }
  const filled = Object.entries(assignments).filter(
    ([key, refereeId]) => Boolean(refereeId) && validKeys.has(key),
  ).length;
  return Math.max(0, total - filled);
}

export function isSlotKeyInTemplate(template: RosterSession[], slotKey: string): boolean {
  return enumerateSlotKeys(template).includes(slotKey);
}
