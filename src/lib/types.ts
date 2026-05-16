export type RefereeLevel = "Regional" | "Nacional" | "IPF Cat. 1" | "IPF Cat. 2";
export type RefereeStatus = "Activo" | "Inactivo" | "Sancionado";
export type EventStatus =
  | "Completo"
  | "Incompleto"
  | "Crítico"
  | "Borrador";
export type EventType = "AEP-1" | "AEP-2" | "AEP-3";
export type RoleKey =
  | "jurado"
  | "central"
  | "lateral"
  | "pesaje"
  | "material";

export type UserRole = "nacional" | "regional" | "lectura";
export type ApprovalStatus = "pendiente" | "aprobado" | "rechazado";

export interface Zone {
  code: string;
  name: string;
}

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

export interface RosterSession {
  sesion: string;
  nombre: string;
  fecha: string;
  grupos: string[];
  roles: RosterRole[];
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
  generatedAt: string;
}

export interface ApprovalProposal {
  id: string;
  eventId: string;
  eventName: string;
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
  eventId: string;
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface AnalyticsPayload {
  coverageByZone: { zona: string; name: string; pct: number; eventos: number }[];
  topReferees: { id: string; nombre: string; eventos: number; nivel: RefereeLevel }[];
  rejectionRate: number;
  criticalEvents: Competition[];
  totals: {
    activeReferees: number;
    totalReferees: number;
    pendingApprovals: number;
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
