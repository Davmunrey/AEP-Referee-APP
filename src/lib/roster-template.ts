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

/**
 * `competitions.template` es JSONB: la base de datos no garantiza su forma.
 *
 * Filas escritas por versiones anteriores, importaciones a medias o ediciones
 * manuales pueden traer una sesión sin `roles`, o un `slots` en texto. Lo
 * primero hacía reventar `cloneTemplate` con «session.roles is not iterable»,
 * y como esto se ejecuta al mapear CADA campeonato, **una sola fila mala
 * tumbaba la lista de campeonatos, el panel y la analítica enteros**. Lo
 * segundo era peor por silencioso: `total += role.slots` concatenaba en vez de
 * sumar, así que dos roles de "3" y "2" plazas daban 32 requeridos, que además
 * se persistían.
 *
 * Se sanea en la única puerta por la que el JSONB entra al dominio.
 */
function sanitizeTemplate(template: unknown): RosterSession[] {
  if (!Array.isArray(template)) return [];
  const toSlots = (value: unknown): number => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const toRoles = (value: unknown): RosterRole[] =>
    Array.isArray(value)
      ? value
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            key: r.key as RoleKey,
            rol: typeof r.rol === "string" ? r.rol : String(r.rol ?? ""),
            slots: toSlots(r.slots),
          }))
      : [];

  return template
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      ...(s as unknown as RosterSession),
      sesion: typeof s.sesion === "string" ? s.sesion : String(s.sesion ?? ""),
      nombre: typeof s.nombre === "string" ? s.nombre : String(s.nombre ?? ""),
      dia: typeof s.dia === "string" ? s.dia : String(s.dia ?? ""),
      categorias: Array.isArray(s.categorias) ? s.categorias : [],
      roles: toRoles(s.roles),
      pesajeRoles: toRoles(s.pesajeRoles),
    })) as RosterSession[];
}

/**
 * La plantilla guardada, saneada. Devuelve `[]` solo cuando no hay plantilla.
 *
 * Antes se comparaba con el preset del tipo y, si coincidía, se devolvía `[]`
 * como si el campeonato no tuviera plantilla. Nadie repone el preset al leer:
 * la tarima se quedaba sin sesiones, no se podía asignar a nadie («El hueco no
 * existe en la plantilla del campeonato»), la cobertura caía a cero y las
 * liquidaciones salían sin servicios. En Supabase la comparación casi nunca
 * acertaba —JSONB reordena las claves del objeto, así que el `JSON.stringify`
 * no coincidía— y por eso «Generar plantilla estándar» funcionaba: una mina
 * que estallaba en cuanto cambiase el orden de las claves.
 */
export function normalizeCompetitionTemplate(
  template: RosterSession[] | null | undefined,
  // Se conserva en la firma por compatibilidad con las llamadas existentes.
  _tipo: EventType,
): RosterSession[] {
  if (!template || !Array.isArray(template) || template.length === 0) return [];
  return cloneTemplate(sanitizeTemplate(template));
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

/** Roles de una sesión, competición y pesaje juntos. */
export function sessionRoleEntries(session: {
  roles?: RosterRole[];
  pesajeRoles?: RosterRole[];
}): RosterRole[] {
  return [
    ...(Array.isArray(session.roles) ? session.roles : []),
    ...(Array.isArray(session.pesajeRoles) ? session.pesajeRoles : []),
  ];
}

/**
 * Roles repetidos dentro de una sesión (entre competición y pesaje incluidos).
 *
 * Cada rol debe ir en una sola fila con su número de plazas: dos filas del
 * mismo rol comparten las claves de hueco `${sesion}_${rol}_${indice}`, así que
 * la segunda no aporta huecos asignables.
 */
export function duplicateRoleKeys(session: {
  roles?: RosterRole[];
  pesajeRoles?: RosterRole[];
}): RoleKey[] {
  const seen = new Set<RoleKey>();
  const repeated = new Set<RoleKey>();
  for (const role of sessionRoleEntries(session)) {
    if (seen.has(role.key)) repeated.add(role.key);
    else seen.add(role.key);
  }
  return [...repeated];
}

/**
 * Claves de hueco existentes en la plantilla, **sin repetir**.
 *
 * La clave es `${sesion}_${rol}_${indice}`, así que dos filas con el mismo rol
 * dentro de una sesión —dos «Juez Central», o un rol repetido entre el bloque
 * de competición y el de pesaje— generan la misma clave. Devolverla dos veces
 * hacía que el recuento de plazas (que sumaba `slots`) fuese mayor que el
 * número de huecos realmente asignables: con la tarima entera cubierta
 * quedaba un hueco libre imposible de llenar, la cobertura se estancaba por
 * debajo del 100 % y el campeonato no llegaba nunca a «Completo».
 */
export function enumerateSlotKeys(template: RosterSession[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const session of template) {
    if (!session || typeof session !== "object") continue;
    const roles = [
      ...(Array.isArray(session.roles) ? session.roles : []),
      ...(Array.isArray(session.pesajeRoles) ? session.pesajeRoles : []),
    ];
    for (const role of roles) {
      const slots = Math.floor(Number(role?.slots));
      if (!Number.isFinite(slots)) continue;
      for (let i = 0; i < slots; i++) {
        const key = `${session.sesion}_${role.key}_${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

/** Purga asignaciones y flags que ya no existen en el template. */
/**
 * Fusiona sesiones importadas en una plantilla existente sin borrar las no seleccionadas.
 * Las claves en `replaceSessionKeys` se sustituyen por la versión importada; el resto se conserva.
 */
export function mergeRosterTemplateSessions(
  existing: RosterSession[],
  incoming: RosterSession[],
  replaceSessionKeys: Set<string>,
): RosterSession[] {
  const incomingBySession = new Map(incoming.map((s) => [s.sesion, s]));
  const merged: RosterSession[] = [];
  const replaced = new Set<string>();

  for (const session of existing) {
    if (replaceSessionKeys.has(session.sesion) && incomingBySession.has(session.sesion)) {
      merged.push(cloneTemplate([incomingBySession.get(session.sesion)!])[0]!);
      replaced.add(session.sesion);
      continue;
    }
    // Conserva la sesión existente en cualquier otro caso — incluso si su clave
    // estaba marcada para reemplazo pero el import no trajo una versión: sin
    // sustituto, borrarla sería pérdida de datos.
    merged.push(cloneTemplate([session])[0]!);
  }

  for (const session of incoming) {
    if (!replaced.has(session.sesion) && !existing.some((e) => e.sesion === session.sesion)) {
      merged.push(cloneTemplate([session])[0]!);
    }
  }

  return merged;
}

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
