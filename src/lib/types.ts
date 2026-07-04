export type RefereeLevel = "Regional" | "Nacional" | "IPF Cat. 1" | "IPF Cat. 2";
export type RefereeStatus = "Activo" | "Inactivo" | "Sancionado";
export type EventStatus =
  | "Completo"
  | "Incompleto"
  | "Crítico"
  | "Borrador";
export type EventType = "AEP-1" | "AEP-2" | "AEP-3";

/** Ámbito internacional para baremo de compensación (EPF/IPF). */
export type CompetitionAmbito = "epf" | "ipf";
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
  | "responsable_financiero_jueces"
  | "solo_ver";

/** Etiqueta legible para cada rol de usuario. */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  delegado_jueces: "Delegado de Jueces",
  delegado_zona: "Delegado de Zona",
  responsable_financiero_jueces: "Responsable Financiero Jueces",
  solo_ver: "Solo Ver",
};

/** Conjunto canónico de roles asignables. Fuente única para validar en la API. */
export const USER_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

/** Organizador del campeonato para el recibo de compensación. */
export type CompensationOrganizerType = "club" | "aep";
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
  /** Cuenta de usuario del juez (profiles.id), si está registrado; para push. */
  userId?: string;
  email?: string;
  licencia?: string;
  localidad?: string;
  domicilio?: string;
  domicilioLat?: number;
  domicilioLng?: number;
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
  sampleReferees: Array<{
    nombre: string;
    zona: string;
    nivel: string;
    localidad?: string;
    telefono?: string;
    genero?: string;
    antiguedad?: string;
    notas?: string;
  }>;
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
  sedeDireccion?: string;
  sedeLat?: number;
  sedeLng?: number;
  /** null = nacional AEP; epf/ipf activa baremo internacional */
  ambito?: CompetitionAmbito;
  /** Cabecera del recibo: club organizador o AEP nacional. */
  compensationOrganizer?: CompensationOrganizerType;
  compensationClubName?: string;
  compensationClubEmail?: string;
  /** Varios clubes organizadores con e-mails múltiples. */
  compensationClubs?: import("@/lib/judge-compensation/types").CompensationClubContact[];
  /** Texto del recibo: voluntario vs colaborador deportivo. */
  compensationVolunteer?: boolean;
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
  categorias: RosterCategoria[];
  horarioCompeticion: string;
  horarioPesaje: string;
  roles: RosterRole[];
  pesajeRoles: RosterRole[];
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

/** Mapa slot_key → true para slots asignados con juez de fuera de zona. */
export type CrossZoneMap = Record<string, boolean>;

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
  /** UUID (profiles.id) del remitente, si se conoce; para notificarle. */
  submittedById?: string;
  submittedAt: string;
  status: ApprovalStatus;
  assignments: AssignmentsMap;
  comment?: string;
  reviewedBy?: string;
  reviewedById?: string;
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
  reviewComment?: string;
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
  positions: RefereeCompetitionPosition[];
  slotCount: number;
}

export interface RefereeCompetitionPosition {
  slotKey: string;
  session: string;
  roleKey: RoleKey;
  roleLabel: string;
  slotIndex: number;
  flags?: SlotFlags;
}

export type { SanctionStatus, SanctionDurationPreset, ZoneDelegate, SanctionDelegateNotify } from "./types/sanction-support";
export type { AssignValidation, IpfArticle, IpfChapter } from "./types/ipf";

export interface RefereeSanction {
  id: string;
  refereeId: string;
  refereeName: string;
  zona: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  status: import("./types/sanction-support").SanctionStatus;
  impuestaPorId?: string;
  impuestaPorNombre: string;
  revocadaPorNombre?: string;
  revocadaAt?: string;
  notas?: string;
  delegateNotify: import("./types/sanction-support").SanctionDelegateNotify;
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
    crossZoneSlots?: number;
  }[];
  crossZoneSummary?: {
    totalCrossZoneSlots: number;
    pctOfFilledSlots: number;
  };
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
