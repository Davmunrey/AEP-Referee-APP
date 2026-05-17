import type { EventType, FlagsMap, RosterRole, RosterSession, RoleKey } from "./types";
import {
  PRESET_AEP1,
  PRESET_AEP2,
  PRESET_AEP3,
  cloneRosterRoles,
} from "./mock-data";

/** Preset por tipo de evento (cuadrantes reales AEP). */
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
