import type { EventType, FlagsMap, RosterRole, RosterSession, RoleKey } from "./types";
import {
  PRESET_AEP1,
  PRESET_AEP2,
  PRESET_AEP3,
  cloneRosterRoles,
} from "./mock-data";

/** Preset por tipo de competición (cuadrantes reales AEP). */
export function getPresetForEventType(tipo: EventType): RosterSession[] {
  switch (tipo) {
    case "AEP-1":
      return cloneTemplate(PRESET_AEP1);
    case "AEP-2":
      return cloneTemplate(PRESET_AEP2);
    case "AEP-3":
      return cloneTemplate(PRESET_AEP3);
    default:
      return cloneTemplate(PRESET_AEP1);
  }
}

export function isPresetTemplate(
  template: RosterSession[] | null | undefined,
  tipo: EventType,
): boolean {
  if (!template || template.length === 0) return false;
  return JSON.stringify(template) === JSON.stringify(getPresetForEventType(tipo));
}

export function normalizeCompetitionTemplate(
  template: RosterSession[] | null | undefined,
  tipo: EventType,
): RosterSession[] {
  if (!template || template.length === 0) return [];
  return isPresetTemplate(template, tipo) ? [] : cloneTemplate(template);
}

export function cloneTemplate(sessions: RosterSession[]): RosterSession[] {
  return sessions.map((s) => ({
    ...s,
    categorias: s.categorias.map((c) => ({ ...c })),
    roles: cloneRosterRoles(s.roles),
    pesajeRoles: cloneRosterRoles(s.pesajeRoles ?? []),
    grupos: s.grupos
      ? s.grupos.map((g) => ({
          nombre: g.nombre,
          categorias: g.categorias.map((c) => ({ ...c })),
          levantadores: g.levantadores,
        }))
      : undefined,
  }));
}

/**
 * Divide una slotKey con formato `${sesion}_${rol}_${indice}`.
 * Como `sesion` puede contener guiones bajos (el editor permite texto libre),
 * tomamos el índice (último segmento) y el rol (penúltimo), y el resto es la
 * sesión. Devuelve `null` si el formato no es válido.
 */
export function parseSlotKey(
  slotKey: string,
): { session: string; roleKey: RoleKey; index: number } | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  const index = Number(parts[parts.length - 1]);
  const roleKey = parts[parts.length - 2] as RoleKey;
  const session = parts.slice(0, -2).join("_");
  if (!session || !roleKey || !Number.isInteger(index) || index < 0) return null;
  return { session, roleKey, index };
}

/** Todas las claves de slot válidas para un template. */
export function enumerateSlotKeys(template: RosterSession[]): string[] {
  const keys: string[] = [];
  for (const session of template) {
    for (const role of [...session.roles, ...(session.pesajeRoles ?? [])]) {
      for (let i = 0; i < role.slots; i++) {
        keys.push(`${session.sesion}_${role.key}_${i}`);
      }
    }
  }
  return keys;
}

/** Purga asignaciones y flags que ya no existen en el template. */
export function pruneAssignments(
  template: RosterSession[],
  assignments: Record<string, string>,
  flags: FlagsMap,
): { assignments: Record<string, string>; flags: FlagsMap } {
  const valid = new Set(enumerateSlotKeys(template));
  const nextAssignments: Record<string, string> = {};
  const nextFlags: FlagsMap = {};
  for (const [key, refId] of Object.entries(assignments)) {
    if (valid.has(key)) nextAssignments[key] = refId;
  }
  for (const [key, f] of Object.entries(flags)) {
    if (valid.has(key)) nextFlags[key] = f;
  }
  return { assignments: nextAssignments, flags: nextFlags };
}

export function countTemplateSlots(template: RosterSession[]): number {
  return template.reduce(
    (acc, s) =>
      acc +
      s.roles.reduce((a, r) => a + r.slots, 0) +
      (s.pesajeRoles ?? []).reduce((a, r) => a + r.slots, 0),
    0,
  );
}

export function defaultCompetitionRoles(tipo: EventType): RosterRole[] {
  const preset = getPresetForEventType(tipo);
  return cloneRosterRoles(preset[0]?.roles ?? []);
}

export function defaultPesajeRoles(): RosterRole[] {
  return cloneRosterRoles(PRESET_AEP1[0]?.pesajeRoles ?? []);
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  central: "Juez Central",
  lateral: "Juez Lateral",
  ordenador: "Ordenador",
  speaker: "Speaker / Mesa",
  control: "Juez Control",
  jurado: "Jurado",
  pesaje: "Pesaje",
  equipamiento: "Control Equipamiento",
  material: "Material",
  mesa: "Mesa",
  liftingcast: "Liftingcast / OpenLifter",
};

/** Grupo de plazas requeridas mostrado en el resumen (tarima, mesa, control, pesaje). */
export interface RequiredSlotGroup {
  key: string;
  label: string;
  count: number;
}

// Agrupa los roles por área operativa para el resumen "plazas requeridas".
// Ej: 1 central + 2 laterales = "Tarima 3"; speaker + ordenador = "Mesa/Ordenador 2".
const REQUIRED_SLOT_GROUPS: { key: string; label: string; roles: RoleKey[] }[] = [
  { key: "tarima", label: "Tarima", roles: ["central", "lateral"] },
  { key: "jurado", label: "Jurado", roles: ["jurado"] },
  { key: "mesa", label: "Mesa/Ordenador", roles: ["speaker", "ordenador", "mesa", "liftingcast"] },
  { key: "control", label: "Control", roles: ["control"] },
  { key: "pesaje", label: "Pesaje", roles: ["pesaje", "equipamiento", "material"] },
];

/**
 * Resume las plazas requeridas por área (tarima, mesa/ordenador, control, pesaje)
 * de una sesión o de toda la plantilla. Solo devuelve los grupos con plazas > 0.
 */
export function summarizeRequiredSlots(
  input: RosterSession | RosterSession[],
): RequiredSlotGroup[] {
  const sessions = Array.isArray(input) ? input : [input];
  const counts = new Map<RoleKey, number>();
  for (const session of sessions) {
    for (const role of [...session.roles, ...(session.pesajeRoles ?? [])]) {
      counts.set(role.key, (counts.get(role.key) ?? 0) + role.slots);
    }
  }
  const groups: RequiredSlotGroup[] = [];
  for (const group of REQUIRED_SLOT_GROUPS) {
    const count = group.roles.reduce((acc, key) => acc + (counts.get(key) ?? 0), 0);
    if (count > 0) groups.push({ key: group.key, label: group.label, count });
  }
  return groups;
}

/** Texto compacto del resumen de plazas: "Tarima 3 · Mesa/Ordenador 2 · Control 1 · Pesaje 2". */
export function formatRequiredSlots(input: RosterSession | RosterSession[]): string {
  return summarizeRequiredSlots(input)
    .map((group) => `${group.label} ${group.count}`)
    .join(" · ");
}

export function roleKeyFromLabel(label: string): RoleKey {
  const normalized = label.toLowerCase();
  if (normalized.includes("central")) return "central";
  if (normalized.includes("lateral")) return "lateral";
  if (normalized.includes("ordenador")) return "ordenador";
  if (normalized.includes("speaker") || normalized.includes("mesa")) return "speaker";
  if (normalized.includes("control") && normalized.includes("equip")) return "equipamiento";
  if (normalized.includes("control")) return "control";
  if (normalized.includes("jurado")) return "jurado";
  if (normalized.includes("pesaje")) return "pesaje";
  if (normalized.includes("lifting") || normalized.includes("openlifter")) return "liftingcast";
  if (normalized.includes("material")) return "material";
  return "central";
}
