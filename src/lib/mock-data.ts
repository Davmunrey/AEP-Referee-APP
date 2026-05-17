import type {
  ActivityItem,
  AssignmentsMap,
  CalendarDayEvent,
  Competition,
  DashboardKpi,
  Referee,
  RefereeLevel,
  RosterSession,
  Zone,
} from "./types";

/** Sincronizado con `src/data.jsx` (fuente actualizada en el proyecto). */
export const ZONES: Zone[] = [
  { code: "AND", name: "Andalucía" },
  { code: "MAD", name: "Madrid" },
  { code: "CAT", name: "Cataluña" },
  { code: "VAL", name: "C. Valenciana" },
  { code: "GAL", name: "Galicia" },
  { code: "PVA", name: "País Vasco" },
  { code: "CAN", name: "Canarias" },
  { code: "CYL", name: "Castilla y León" },
  { code: "ARA", name: "Aragón" },
  { code: "AST", name: "Asturias" },
];

export const LEVELS: RefereeLevel[] = [
  "Regional",
  "Nacional",
  "IPF Cat. 2",
  "IPF Cat. 1",
];

export const REFEREES: Referee[] = [
  { id: "j001", nombre: "Carlos Méndez", zona: "MAD", nivel: "IPF Cat. 1", estado: "Activo", eventos: 8, ultimo: "14 días", disp: true, iniciales: "CM" },
  { id: "j002", nombre: "Marta Ruiz", zona: "CAT", nivel: "IPF Cat. 2", estado: "Activo", eventos: 6, ultimo: "21 días", disp: true, iniciales: "MR" },
  { id: "j003", nombre: "David Ortega", zona: "AND", nivel: "Nacional", estado: "Activo", eventos: 5, ultimo: "7 días", disp: true, iniciales: "DO" },
  { id: "j004", nombre: "Lucía Pérez", zona: "VAL", nivel: "Nacional", estado: "Activo", eventos: 4, ultimo: "35 días", disp: false, iniciales: "LP" },
  { id: "j005", nombre: "Iván Castro", zona: "MAD", nivel: "Nacional", estado: "Activo", eventos: 7, ultimo: "3 días", disp: true, iniciales: "IC" },
  { id: "j006", nombre: "Sara Domínguez", zona: "CAT", nivel: "Regional", estado: "Activo", eventos: 2, ultimo: "48 días", disp: true, iniciales: "SD" },
  { id: "j007", nombre: "Pablo Hernández", zona: "PVA", nivel: "IPF Cat. 2", estado: "Activo", eventos: 9, ultimo: "2 días", disp: true, iniciales: "PH" },
  { id: "j008", nombre: "Elena Vidal", zona: "GAL", nivel: "Nacional", estado: "Inactivo", eventos: 1, ultimo: "127 días", disp: false, iniciales: "EV" },
  { id: "j009", nombre: "Andrés Molina", zona: "AND", nivel: "Regional", estado: "Activo", eventos: 3, ultimo: "18 días", disp: true, iniciales: "AM" },
  { id: "j010", nombre: "Cristina Soto", zona: "MAD", nivel: "IPF Cat. 2", estado: "Activo", eventos: 6, ultimo: "9 días", disp: true, iniciales: "CS" },
  { id: "j011", nombre: "Javier Romero", zona: "CAT", nivel: "Nacional", estado: "Sancionado", eventos: 0, ultimo: "94 días", disp: false, iniciales: "JR" },
  { id: "j012", nombre: "Nuria Blanco", zona: "VAL", nivel: "Regional", estado: "Activo", eventos: 2, ultimo: "41 días", disp: true, iniciales: "NB" },
  { id: "j013", nombre: "Roberto Aguilar", zona: "CYL", nivel: "Nacional", estado: "Activo", eventos: 5, ultimo: "11 días", disp: true, iniciales: "RA" },
  { id: "j014", nombre: "Patricia Navarro", zona: "MAD", nivel: "Nacional", estado: "Activo", eventos: 4, ultimo: "23 días", disp: true, iniciales: "PN" },
  { id: "j015", nombre: "Sergio Lozano", zona: "ARA", nivel: "Regional", estado: "Activo", eventos: 3, ultimo: "30 días", disp: false, iniciales: "SL" },
  { id: "j016", nombre: "Ana Cabrera", zona: "CAN", nivel: "Nacional", estado: "Activo", eventos: 4, ultimo: "17 días", disp: true, iniciales: "AC" },
];

export const COMPETITIONS: Competition[] = [
  {
    id: "evt-001",
    nombre: "Cto. de España Junior y Sub-23",
    tipo: "AEP-1",
    fecha: "2026-06-12",
    fechaFin: "2026-06-14",
    sede: "Madrid · Polideportivo Magariños",
    sesiones: 6,
    requeridos: 15,
    confirmados: 12,
    estado: "Incompleto",
    aprobacion: "Pendiente aprobación nacional",
    zona: "MAD",
  },
  {
    id: "evt-002",
    nombre: "Copa de Andalucía",
    tipo: "AEP-3",
    fecha: "2026-05-29",
    fechaFin: "2026-05-30",
    sede: "Sevilla · Centro Deportivo San Pablo",
    sesiones: 4,
    requeridos: 10,
    confirmados: 10,
    estado: "Completo",
    aprobacion: "Aprobado",
    zona: "AND",
  },
  {
    id: "evt-003",
    nombre: "Open Internacional Cataluña",
    tipo: "AEP-2",
    fecha: "2026-06-05",
    fechaFin: "2026-06-07",
    sede: "Barcelona · Pavelló Vall d'Hebron",
    sesiones: 5,
    requeridos: 13,
    confirmados: 8,
    estado: "Crítico",
    aprobacion: "Propuesta recibida",
    zona: "CAT",
  },
  {
    id: "evt-004",
    nombre: "Cto. Regional País Vasco",
    tipo: "AEP-3",
    fecha: "2026-06-19",
    fechaFin: "2026-06-21",
    sede: "Bilbao · BEC Arena",
    sesiones: 3,
    requeridos: 9,
    confirmados: 7,
    estado: "Incompleto",
    aprobacion: "Pendiente aprobación regional",
    zona: "PVA",
  },
  {
    id: "evt-005",
    nombre: "Cto. de España Absoluto",
    tipo: "AEP-1",
    fecha: "2026-07-03",
    fechaFin: "2026-07-05",
    sede: "Valencia · Pabellón Fuente de San Luis",
    sesiones: 6,
    requeridos: 15,
    confirmados: 4,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    zona: "VAL",
  },
  {
    id: "evt-006",
    nombre: "Copa Madrid Bench Press",
    tipo: "AEP-3",
    fecha: "2026-05-22",
    fechaFin: "2026-05-22",
    sede: "Madrid · CDM Triángulo de Oro",
    sesiones: 2,
    requeridos: 6,
    confirmados: 6,
    estado: "Completo",
    aprobacion: "Aprobado",
    zona: "MAD",
  },
];

/** 9 roles de competición — orden oficial del acta AEP. */
const COMPETICION_ROLES: RosterSession["roles"] = [
  { rol: "Juez Central", slots: 1, key: "central" },
  { rol: "Juez Lateral", slots: 2, key: "lateral" },
  { rol: "Ordenador", slots: 1, key: "ordenador" },
  { rol: "Speaker / Mesa", slots: 1, key: "speaker" },
  { rol: "Juez Control", slots: 1, key: "control" },
  { rol: "Jurado", slots: 3, key: "jurado" },
];

/** Bloque de pesaje y revisión de equipamiento. */
const PESAJE_ROLES: RosterSession["roles"] = [
  { rol: "Pesaje", slots: 1, key: "pesaje" },
  { rol: "Control Equipamiento", slots: 1, key: "equipamiento" },
];

export const ROSTER_TEMPLATE: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74 kg (C) · -83 kg (C)" }],
    horarioCompeticion: "10:30 - 13:45",
    horarioPesaje: "08:30 - 10:00",
    roles: COMPETICION_ROLES.map((r) => ({ ...r })),
    pesajeRoles: PESAJE_ROLES.map((r) => ({ ...r })),
  },
  {
    sesion: "S2",
    nombre: "Sesión 2",
    dia: "Sábado",
    categorias: [{ genero: "Mujeres", pesos: "-57 kg (A) · -63 kg (A)" }],
    horarioCompeticion: "16:00 - 19:15",
    horarioPesaje: "14:00 - 15:30",
    roles: COMPETICION_ROLES.map((r) => ({ ...r })),
    pesajeRoles: PESAJE_ROLES.map((r) => ({ ...r })),
  },
  {
    sesion: "S3",
    nombre: "Sesión 3",
    dia: "Domingo",
    categorias: [{ genero: "Hombres", pesos: "-93 kg (A) · -105 kg (A)" }],
    horarioCompeticion: "10:30 - 13:45",
    horarioPesaje: "08:30 - 10:00",
    roles: COMPETICION_ROLES.map((r) => ({ ...r })),
    pesajeRoles: PESAJE_ROLES.map((r) => ({ ...r })),
  },
  {
    sesion: "S4",
    nombre: "Sesión 4",
    dia: "Domingo",
    categorias: [{ genero: "Mujeres", pesos: "-69 kg (A) · -76 kg (A)" }],
    horarioCompeticion: "16:00 - 19:15",
    horarioPesaje: "14:00 - 15:30",
    roles: COMPETICION_ROLES.map((r) => ({ ...r })),
    pesajeRoles: PESAJE_ROLES.map((r) => ({ ...r })),
  },
];

export const INITIAL_ASSIGNMENTS: AssignmentsMap = {
  S1_central_0: "j005",
  S1_lateral_0: "j007",
  S1_lateral_1: "j010",
  S1_ordenador_0: "j009",
  S1_speaker_0: "j006",
  S1_control_0: "j003",
  S1_jurado_0: "j001",
  S1_jurado_1: "j002",
  S1_pesaje_0: "j003",
  S1_equipamiento_0: "j009",
  S2_central_0: "j007",
  S2_lateral_0: "j005",
  S2_lateral_1: "j010",
  S2_jurado_0: "j002",
  S2_jurado_1: "j001",
  S2_pesaje_0: "j014",
  S3_central_0: "j010",
  S3_lateral_0: "j007",
  S3_jurado_0: "j001",
};

export const CALENDAR_EVENTS: Record<string, CalendarDayEvent> = {
  "2026-05-22": { id: "evt-006", label: "Copa Madrid BP", tipo: "AEP-3", estado: "Completo" },
  "2026-05-29": { id: "evt-002", label: "Copa Andalucía", tipo: "AEP-3", estado: "Completo" },
  "2026-06-05": { id: "evt-003", label: "Open Cataluña", tipo: "AEP-2", estado: "Crítico" },
  "2026-06-12": { id: "evt-001", label: "Cto. Junior", tipo: "AEP-1", estado: "Incompleto" },
  "2026-06-19": { id: "evt-004", label: "Cto. País Vasco", tipo: "AEP-3", estado: "Incompleto" },
  "2026-07-03": { id: "evt-005", label: "Cto. Absoluto", tipo: "AEP-1", estado: "Borrador" },
};

export const ACTIVITY: ActivityItem[] = [
  { tipo: "propuesta", actor: "Resp. Cataluña", accion: "propuso roster para", evento: "Open Internacional Cataluña", hace: "hace 14 min" },
  { tipo: "aprobacion", actor: "Tú", accion: "aprobaste roster para", evento: "Copa de Andalucía", hace: "hace 2 h" },
  { tipo: "rechazo", actor: "Carlos Méndez", accion: "rechazó asignación en", evento: "Cto. de España Absoluto", hace: "hace 4 h" },
  { tipo: "cambio", actor: "Resp. P. Vasco", accion: "modificó disponibilidad en", evento: "Cto. Regional País Vasco", hace: "hace 6 h" },
  { tipo: "ascenso", actor: "Marta Ruiz", accion: "solicitó ascenso a", evento: "IPF Cat. 1", hace: "hace 1 d" },
  { tipo: "propuesta", actor: "Resp. Madrid", accion: "envió propuesta para", evento: "Cto. España Junior", hace: "hace 1 d" },
];

export const DASHBOARD_KPIS: DashboardKpi[] = [
  {
    label: "Árbitros Activos",
    value: String(REFEREES.filter((r) => r.estado === "Activo").length),
    sub: `/ ${REFEREES.length} federados`,
    trend: "cuota operativa 2026",
    trendDir: "up",
    accent: "neutral",
  },
  {
    label: "Próximas Competiciones",
    value: String(COMPETITIONS.length),
    sub: "campeonatos en calendario",
    trend: "3 AEP-1 · 1 AEP-2 · 2 AEP-3",
    trendDir: "up",
    accent: "red",
  },
  {
    label: "Conflictos de Asignación",
    value: "14",
    sub: "árbitros sin cubrir en 3 eventos",
    trend: "2 eventos en estado crítico",
    trendDir: "warn",
    accent: "yellow",
  },
  {
    label: "Aprobaciones Pendientes",
    value: "3",
    sub: "propuestas regionales",
    trend: "esperan 36 h de media",
    trendDir: "flat",
    accent: "blue",
  },
];

const assignmentsStore = new Map<string, AssignmentsMap>();

export function getAssignments(eventId: string): AssignmentsMap {
  if (!assignmentsStore.has(eventId)) {
    assignmentsStore.set(
      eventId,
      eventId === "evt-001" ? { ...INITIAL_ASSIGNMENTS } : {},
    );
  }
  return { ...assignmentsStore.get(eventId)! };
}

export function setAssignments(eventId: string, assignments: AssignmentsMap) {
  assignmentsStore.set(eventId, { ...assignments });
}

export function getRefereeById(id: string) {
  return REFEREES.find((r) => r.id === id);
}

export function getCompetitionById(id: string) {
  return COMPETITIONS.find((c) => c.id === id);
}

export function getZoneName(code: string) {
  return ZONES.find((z) => z.code === code)?.name ?? code;
}

export function getUpcomingCompetitions(limit?: number) {
  const sorted = [...COMPETITIONS].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return limit ? sorted.slice(0, limit) : sorted;
}

export const CURRENT_USER = {
  nombre: "Laura Iglesias",
  rol: "Responsable Nacional de Árbitros",
  iniciales: "LI",
  email: "l.iglesias@fechap.es",
};

export const DEFAULT_ROSTER_EVENT_ID = "evt-001";
