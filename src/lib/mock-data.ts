import { AEP_ZONES } from "@/lib/aep-zones";
import type { RefereeLevel, RosterSession } from "./types";

/** Zonas geográficas oficiales AEP 2026 (§4.1 Guía). */
export const ZONES = AEP_ZONES;

export const LEVELS: RefereeLevel[] = [
  "Regional",
  "Nacional",
  "IPF Cat. 2",
  "IPF Cat. 1",
];

export function cloneRosterRoles(roles: RosterSession["roles"]): RosterSession["roles"] {
  return roles.map((r) => ({ ...r }));
}

/** AEP-1 — jueces de competición AEP-2/3 + Jurado×3. */
export const COMPETICION_ROLES_AEP1: RosterSession["roles"] = [
  { rol: "Juez Central", slots: 1, key: "central" },
  { rol: "Juez Lateral", slots: 2, key: "lateral" },
  { rol: "Ordenador", slots: 1, key: "ordenador" },
  { rol: "Speaker / Mesa", slots: 2, key: "speaker" },
  { rol: "Juez Control", slots: 1, key: "control" },
  { rol: "Jurado", slots: 3, key: "jurado" },
];

/** AEP-2/3 — jueces fijos: central, lateral×2, ordenador, speaker/mesa×2, control. */
export const COMPETICION_ROLES_AEP2: RosterSession["roles"] = [
  { rol: "Juez Central", slots: 1, key: "central" },
  { rol: "Juez Lateral", slots: 2, key: "lateral" },
  { rol: "Ordenador", slots: 1, key: "ordenador" },
  { rol: "Speaker / Mesa", slots: 2, key: "speaker" },
  { rol: "Juez Control", slots: 1, key: "control" },
];

/** Variante AEP-2 con Liftingcast (Intend Power). */
export const COMPETICION_ROLES_AEP2_LIFT: RosterSession["roles"] = [
  { rol: "Juez Central", slots: 1, key: "central" },
  { rol: "Juez Lateral", slots: 2, key: "lateral" },
  { rol: "Liftingcast / OpenLifter", slots: 1, key: "liftingcast" },
  { rol: "Juez Control", slots: 1, key: "control" },
  { rol: "Mesa", slots: 1, key: "mesa" },
];

/** Bloque pesaje y revisión equipamiento. */
export const PESAJE_ROLES: RosterSession["roles"] = [
  { rol: "Pesaje", slots: 1, key: "pesaje" },
  { rol: "Control Equipamiento", slots: 1, key: "equipamiento" },
];

function session(
  sesion: string,
  nombre: string,
  dia: string,
  categorias: RosterSession["categorias"],
  horarioCompeticion: string,
  horarioPesaje: string,
  roles: RosterSession["roles"],
): RosterSession {
  return {
    sesion,
    nombre,
    dia,
    categorias,
    horarioCompeticion,
    horarioPesaje,
    roles: cloneRosterRoles(roles),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
  };
}

/** AEP-1 — 4 sesiones base (expandible a 10 en editor; Junior real). */
export const PRESET_AEP1: RosterSession[] = [
  session("S1", "Sesión 1", "Viernes", [{ genero: "Hombres", pesos: "-74 kg (C) · -83 kg (C)" }], "12:30 - 15:45", "10:30 - 12:00", COMPETICION_ROLES_AEP1),
  session("S2", "Sesión 2", "Viernes", [{ genero: "Hombres", pesos: "-93 kg (C) · -93 kg (B)" }], "16:00 - 18:15", "14:00 - 15:30", COMPETICION_ROLES_AEP1),
  session("S3", "Sesión 3", "Viernes", [{ genero: "Hombres", pesos: "-74 kg (B) · -83 kg (B)" }], "18:45 - 21:45", "16:45 - 18:15", COMPETICION_ROLES_AEP1),
  session("S4", "Sesión 4", "Sábado", [
    { genero: "Mujeres", pesos: "-57 kg (B)" },
    { genero: "Hombres", pesos: "-66 kg (B) · -105 kg (B)" },
  ], "09:00 - 12:30", "07:00 - 08:30", COMPETICION_ROLES_AEP1),
];

/** AEP-2 — 5 sesiones (Intend Power). */
export const PRESET_AEP2: RosterSession[] = [
  session("S1", "Sesión 1", "Sábado", [{ genero: "Hombres", pesos: "-83 kg (B) · -83 kg (A)" }], "10:00 - 13:30", "08:00 - 09:30", COMPETICION_ROLES_AEP2),
  session("S2", "Sesión 2", "Sábado", [{ genero: "Mujeres", pesos: "-63 · -69 · -84 kg" }], "14:00 - 17:00", "12:00 - 13:30", COMPETICION_ROLES_AEP2),
  session("S3", "Sesión 3", "Sábado", [{ genero: "Hombres", pesos: "-74 · -105 kg" }], "17:30 - 20:30", "15:30 - 17:00", COMPETICION_ROLES_AEP2),
  session("S4", "Sesión 4", "Domingo", [
    { genero: "Mujeres", pesos: "-57 · -76 · +84 kg" },
    { genero: "Hombres", pesos: "-59 · -66 kg" },
  ], "10:00 - 13:00", "08:00 - 09:30", COMPETICION_ROLES_AEP2),
  session("S5", "Sesión 5", "Domingo", [{ genero: "Hombres", pesos: "-93 (B/A) · -120 kg" }], "13:30 - 16:30", "11:30 - 13:00", COMPETICION_ROLES_AEP2),
];

/** AEP-3 — 3 sesiones (Bollodromo) o 2 (Young Ambition). */
export const PRESET_AEP3: RosterSession[] = [
  session("S1", "Sesión 1", "Sábado", [{ genero: "Hombres", pesos: "-74 · -93 kg" }], "09:30 - 13:00", "07:30 - 09:00", COMPETICION_ROLES_AEP2),
  session("S2", "Sesión 2", "Sábado", [
    { genero: "Mujeres", pesos: "Todas las categorías" },
    { genero: "Hombres", pesos: "-66 · -120 · +120 kg" },
  ], "13:30 - 17:00", "11:30 - 13:00", COMPETICION_ROLES_AEP2),
  session("S3", "Sesión 3", "Sábado", [{ genero: "Hombres", pesos: "-83 · -105 kg" }], "17:30 - 21:00", "15:30 - 17:00", COMPETICION_ROLES_AEP2),
];

/** Preset corto AEP-3 (2 sesiones). */
export const PRESET_AEP3_SHORT: RosterSession[] = [
  session("S1", "Sesión 1", "Sábado", [{ genero: "Mujeres", pesos: "Todas las categorías" }], "10:00 - 13:45", "08:00 - 09:45", COMPETICION_ROLES_AEP2),
  session("S2", "Sesión 2", "Sábado", [{ genero: "Hombres", pesos: "Todas las categorías" }], "14:15 - 18:00", "12:15 - 14:00", COMPETICION_ROLES_AEP2),
];

/** @deprecated Usar getPresetForEventType. */
export const ROSTER_TEMPLATE: RosterSession[] = PRESET_AEP1;
