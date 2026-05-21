export type RefereeLevel = "Regional" | "Nacional" | "IPF Cat. 1" | "IPF Cat. 2";
export type RefereeStatus = "Activo" | "Inactivo" | "Sancionado";
export type EventStatus =
  | "Completo"
  | "Incompleto"
  | "Crítico"
  | "Borrador";
export type EventType = "AEP-1" | "AEP-2" | "AEP-3";
export type RoleKey =
  | "central"
  | "lateral"
  | "ordenador"
  | "speaker"
  | "control"
  | "jurado"
  | "pesaje"
  | "equipamiento"
  | "material"
  | "mesa"
  | "liftingcast";

export type UserRole =
  | "super_admin"
  | "delegado_jueces"
  | "delegado_zona"
  | "solo_ver";

/** Etiqueta legible para cada rol de usuario. */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  delegado_jueces: "Delegado de Jueces",
  delegado_zona: "Delegado de Zona",
  solo_ver: "Solo Ver",
};
export type ApprovalStatus = "pendiente" | "aprobado" | "rechazado";

export interface Zone {
  code: string;
  name: string;
}

import type { RefereeArbitrajeStats } from "@/lib/judges-registry/arbitraje-stats";

export type { RefereeArbitrajeStats };

export interface Referee {
  id: string;
  nombre: string;
  zona: string;
  nivel: RefereeLevel;
  estado: RefereeStatus;
  eventos: number;
  ultimo: string;
  disp: boolean;
  iniciales: string;
  email?: string;
  licencia?: string;
  localidad?: string;
  telefono?: string;
  genero?: string;
  /** Fecha ISO (YYYY-MM-DD) de antigüedad como juez. */
  antiguedad?: string;
  /** ID en hoja «Datos» del Excel maestro. */
  excelId?: number;
  notas?: string;
  ultimoFecha?: string;
  /** Etiqueta zona en Excel (ej. «2- CENTRO»); `zona` guarda el código macro canónico. */
  excelMacroZone?: string;
  arbitrajeStats?: RefereeArbitrajeStats;
}

export interface JudgesRegistryImportPreview {
  filename: string;
  refereeCount: number;
  competitionCount: number;
  warnings: string[];
  sampleReferees: Array<{ nombre: string; zona: string; nivel: string }>;
  replaceRequested: boolean;
}

export interface JudgesRegistryImportApplyResult {
  refereesCreated?: number;
  refereesUpdated?: number;
  refereesSkipped?: number;
  competitionsCreated?: number;
  competitionsSkipped?: number;
  warnings?: string[];
}

export interface JudgesRegistryImportResult extends JudgesRegistryImportApplyResult {
  preview: JudgesRegistryImportPreview;
}

export interface Competition {
  id: string;
  nombre: string;
  tipo: EventType;
  fecha: string;
  fechaFin: string;
  sede: string;
  sesiones: number;
  requeridos: number;
  confirmados: number;
  estado: EventStatus;
  aprobacion: string;
  zona?: string;
}

export interface RosterRole {
  rol: string;
  slots: number;
  key: RoleKey;
}

/** Categoría que compite en una sesión: género + clases de peso. */
export interface RosterCategoria {
  genero: "Hombres" | "Mujeres";
  pesos: string;
}

/** Grupo dentro de una sesión (Grupo 1, Grupo 2…) — categorías y nº levantadores. */
export interface RosterGrupo {
  nombre: string;
  categorias: RosterCategoria[];
  levantadores?: number;
}

export interface RosterSession {
  sesion: string;
  nombre: string;
  /** Día al que pertenece la sesión — agrupa columnas (ej. "Viernes 15 may"). */
  dia: string;
  /** Categorías que compiten en la sesión. */
  categorias: RosterCategoria[];
  /** Horario de competición (ej. "12:30 - 15:45"). */
  horarioCompeticion: string;
  /** Horario de pesaje y revisión de equipamiento (ej. "10:30 - 12:00"). */
  horarioPesaje: string;
  /** Roles de competición (9 plazas). */
  roles: RosterRole[];
  /** Roles del bloque de pesaje y revisión de equipamiento. */
  pesajeRoles: RosterRole[];
  /** Grupos opcionales — desglose por sesión (Grupo 1, Grupo 2…). */
  grupos?: RosterGrupo[];
}

export interface ActivityItem {
  tipo: "propuesta" | "aprobacion" | "rechazo" | "cambio" | "ascenso";
  actor: string;
  accion: string;
  evento: string;
  hace: string;
}

export interface CalendarDayEvent {
  id: string;
  label: string;
  tipo: EventType;
  estado: EventStatus;
  fecha: string;
  fechaFin: string;
  rangePosition: "single" | "start" | "middle" | "end";
}

export interface DashboardKpi {
  label: string;
  value: string;
  sub: string;
  trend: string;
  trendDir: "up" | "down" | "warn" | "flat";
  accent: "red" | "yellow" | "blue" | "neutral";
}

export type AssignmentsMap = Record<string, string>;

/** Flags de slot en acta AEP: * comparte sesión, ↑↓ intercambio pesaje H/M. */
export interface SlotFlags {
  compartido?: boolean;
  intercambio?: boolean;
}

export type FlagsMap = Record<string, SlotFlags>;

export interface CurrentUser {
  nombre: string;
  rol: string;
  iniciales: string;
  email: string;
}

export interface SessionUser extends CurrentUser {
  id: string;
  role: UserRole;
  zona?: string;
}

export interface AppMeta {
  zones: Zone[];
  levels: RefereeLevel[];
  currentUser: SessionUser;
}

export type InsightSeverity = "crítico" | "alerta" | "sugerencia" | "ok";

export interface InsightAction {
  label: string;
  href: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  metric?: string;
  action?: InsightAction;
}

export type HealthStatus = "óptimo" | "estable" | "atención" | "crítico";

export interface HealthFactor {
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface OperationalHealth {
  score: number;
  status: HealthStatus;
  summary: string;
  factors: HealthFactor[];
  /** Variación del índice frente a la captura anterior (retroalimentación). */
  delta?: number;
  previousScore?: number;
}

export interface EventCoverage {
  id: string;
  nombre: string;
  fecha: string;
  estado: EventStatus;
  filled: number;
  open: number;
  required: number;
}

export interface DashboardPayload {
  kpis: DashboardKpi[];
  activity: ActivityItem[];
  calendar: Record<string, CalendarDayEvent>;
  upcomingCompetitions: Competition[];
  currentUser: SessionUser;
  health: OperationalHealth;
  insights: Insight[];
  coverage: EventCoverage[];
  sanctionAlerts: SanctionAlert[];
  generatedAt: string;
}

export interface ApprovalProposal {
  id: string;
  competitionId: string;
  competitionName: string;
  zona: string;
  submittedBy: string;
  submittedAt: string;
  status: ApprovalStatus;
  assignments: AssignmentsMap;
  comment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PromotionRequest {
  id: string;
  refereeId: string;
  refereeName: string;
  fromLevel: RefereeLevel;
  toLevel: RefereeLevel;
  zona: string;
  status: ApprovalStatus;
  submittedAt: string;
  eventosCompletados: number;
  motivo?: string;
}

export interface RegulationRule {
  id: string;
  rol: string;
  roleKey: RoleKey;
  minLevel: RefereeLevel;
  eventTypes: EventType[];
  note: string;
}

export interface RosterHistoryEntry {
  id: string;
  competitionId: string;
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export type ExamType =
  | "Nuevo juez"
  | "Ascenso IPF"
  | "Recertificación";
export type ExamResult = "Aprobado" | "Suspenso" | "Pendiente";

export interface RefereeExam {
  id: string;
  refereeId: string;
  refereeName: string;
  tipo: ExamType;
  nivelObjetivo: RefereeLevel;
  fecha: string;
  examinador: string;
  puntuacion?: number;
  puntuacionMaxima: number;
  resultado: ExamResult;
  notas?: string;
  createdAt?: string;
}

export type ReportType =
  | "General"
  | "Competición"
  | "Juez"
  | "Incidencia"
  | "Evaluación";

export type ReportSubjectType = "competicion" | "juez";

export interface RefereeReport {
  id: string;
  subjectType: ReportSubjectType;
  zona?: string;
  refereeId?: string;
  refereeName?: string;
  competitionId?: string;
  competitionName?: string;
  titulo: string;
  tipo: ReportType;
  evento?: string;
  contenido: string;
  adjuntoUrl?: string;
  autor: string;
  createdAt?: string;
}

export interface RefereeCompetitionHistoryItem {
  competitionId: string;
  competitionName: string;
  tipo: EventType;
  fecha: string;
  fechaFin: string;
  sede: string;
  estado: EventStatus;
  aprobacion: string;
  roles: string[];
  slotCount: number;
}

export type SanctionStatus = "activa" | "cumplida" | "revocada";

export type SanctionDurationPreset =
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "custom";

export interface ZoneDelegate {
  id: string;
  nombre: string;
  email: string;
}

export interface SanctionDelegateNotify {
  delegates: ZoneDelegate[];
  mailtoUrl: string;
  notifiedAt?: string;
}

export interface RefereeSanction {
  id: string;
  refereeId: string;
  refereeName: string;
  zona: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  status: SanctionStatus;
  impuestaPorId?: string;
  impuestaPorNombre: string;
  revocadaPorNombre?: string;
  revocadaAt?: string;
  notas?: string;
  delegateNotify: SanctionDelegateNotify;
  createdAt?: string;
  updatedAt?: string;
}

export interface SanctionAlert {
  id: string;
  refereeId: string;
  refereeName: string;
  zona: string;
  zonaName: string;
  fechaFin: string;
  daysLeft: number;
  kind: "activa" | "por_vencer";
}

export interface JudgeProfile {
  referee: Referee;
  exams: RefereeExam[];
  reports: RefereeReport[];
  sanctions: RefereeSanction[];
  activeSanction?: RefereeSanction;
  competitionHistory: RefereeCompetitionHistoryItem[];
  examsPassed: number;
  examsTotal: number;
  avgScore: number | null;
  lastExam?: RefereeExam;
}

export interface AnalyticsPayload {
  availableYears: number[];
  selectedYear: number;
  yearlyHistory: {
    year: number;
    competitions: number;
    criticalCompetitions: number;
    requiredSlots: number;
    filledSlots: number;
    uniqueAssignedReferees: number;
  }[];
  activityByZone: {
    zona: string;
    name: string;
    competitions: number;
    criticalCompetitions: number;
    requiredSlots: number;
    filledSlots: number;
    uniqueAssignedReferees: number;
    activeReferees: number;
  }[];
  topReferees: {
    id: string;
    nombre: string;
    nivel: RefereeLevel;
    assignedCompetitions: number;
    assignedSlots: number;
  }[];
  rejectionRate: number;
  criticalEvents: Competition[];
  totals: {
    competitions: number;
    criticalCompetitions: number;
    activeReferees: number;
    totalReferees: number;
    pendingApprovals: number;
    uniqueAssignedReferees: number;
    filledSlots: number;
    openSlots: number;
  };
}

export interface AssignValidation {
  ok: boolean;
  error?: string;
}

export interface IpfArticle {
  num: string;
  title?: string;
  text: string;
}

export interface IpfChapter {
  num: string;
  title: string;
  articles: IpfArticle[];
}
