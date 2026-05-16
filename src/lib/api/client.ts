import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  DashboardPayload,
  ExamResult,
  ExamType,
  PromotionRequest,
  Referee,
  RefereeExam,
  RefereeLevel,
  RefereeReport,
  RegulationRule,
  ReportType,
  RosterHistoryEntry,
  RosterSession,
  SessionUser,
} from "@/lib/types";
import { isApiError } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const parsed = await parseApiResponse<T>(res);
  if (isApiError(parsed)) {
    throw new Error(parsed.error);
  }
  return parsed.data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  getMeta: () => request<AppMeta>("/meta"),
  getDashboard: () => request<DashboardPayload>("/dashboard"),

  getReferees: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Referee[]>(`/referees${qs}`);
  },

  getReferee: (id: string) => request<Referee>(`/referees/${id}`),

  createReferee: (body: Partial<Referee>) =>
    request<Referee>("/referees", { method: "POST", body: JSON.stringify(body) }),

  updateReferee: (id: string, body: Partial<Referee>) =>
    request<Referee>(`/referees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getCompetitions: () => request<Competition[]>("/competitions"),

  createCompetition: (body: Partial<Competition>) =>
    request<Competition>("/competitions", { method: "POST", body: JSON.stringify(body) }),

  getCompetition: (id: string) => request<Competition>(`/competitions/${id}`),

  getRoster: (eventId: string) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap }>(
      `/competitions/${eventId}/roster`,
    ),

  getRosterHistory: (eventId: string) =>
    request<RosterHistoryEntry[]>(`/competitions/${eventId}/roster/history`),

  assignReferee: (eventId: string, slotKey: string, refereeId: string) =>
    request<{ assignments: AssignmentsMap }>(`/competitions/${eventId}/roster/assign`, {
      method: "POST",
      body: JSON.stringify({ slotKey, refereeId }),
    }),

  clearSlot: (eventId: string, slotKey: string) =>
    request<{ assignments: AssignmentsMap }>(`/competitions/${eventId}/roster/clear`, {
      method: "POST",
      body: JSON.stringify({ slotKey }),
    }),

  saveDraft: (eventId: string) =>
    request<{ message: string }>(`/competitions/${eventId}/roster/draft`, { method: "POST" }),

  submitRoster: (eventId: string) =>
    request<{ message: string }>(`/competitions/${eventId}/roster/submit`, {
      method: "POST",
    }),

  exportRosterUrl: (eventId: string) =>
    `${getApiBaseUrl()}/competitions/${eventId}/roster/export`,

  getApprovals: () => request<ApprovalProposal[]>("/approvals"),

  reviewApproval: (id: string, approve: boolean, comment?: string) =>
    request<ApprovalProposal>(`/approvals/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve, comment }),
    }),

  deleteReferee: (id: string) =>
    request<{ deleted: boolean }>(`/referees/${id}`, { method: "DELETE" }),

  deleteCompetition: (id: string) =>
    request<{ deleted: boolean }>(`/competitions/${id}`, { method: "DELETE" }),

  getPromotions: () => request<PromotionRequest[]>("/promotions"),

  createPromotion: (body: {
    refereeId: string;
    toLevel: string;
    zona: string;
    motivo?: string;
  }) =>
    request<PromotionRequest>("/promotions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  reviewPromotion: (id: string, approve: boolean) =>
    request<PromotionRequest>(`/promotions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    }),

  getAnalytics: () => request<AnalyticsPayload>("/analytics"),

  analyticsExportUrl: () => `${getApiBaseUrl()}/analytics/export`,

  getRegulations: () => request<RegulationRule[]>("/regulations"),

  getExams: (refereeId?: string) =>
    request<RefereeExam[]>(`/exams${refereeId ? `?refereeId=${refereeId}` : ""}`),

  createExam: (body: {
    refereeId: string;
    tipo: ExamType;
    nivelObjetivo: RefereeLevel;
    fecha: string;
    examinador: string;
    puntuacion?: number;
    puntuacionMaxima?: number;
    resultado?: ExamResult;
    notas?: string;
  }) =>
    request<RefereeExam>("/exams", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateExam: (
    id: string,
    body: {
      resultado?: ExamResult;
      puntuacion?: number;
      notas?: string;
      fecha?: string;
      examinador?: string;
    },
  ) =>
    request<RefereeExam>(`/exams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteExam: (id: string) =>
    request<{ deleted: boolean }>(`/exams/${id}`, { method: "DELETE" }),

  getReports: (refereeId?: string) =>
    request<RefereeReport[]>(
      `/reports${refereeId ? `?refereeId=${refereeId}` : ""}`,
    ),

  createReport: (body: {
    refereeId: string;
    titulo: string;
    tipo: ReportType;
    evento?: string;
    contenido: string;
    adjuntoUrl?: string;
  }) =>
    request<RefereeReport>("/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteReport: (id: string) =>
    request<{ deleted: boolean }>(`/reports/${id}`, { method: "DELETE" }),

  toggleUserActive: (id: string, activo: boolean) =>
    request<{ id: string; activo: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }),

  deleteUser: (id: string) =>
    request<{ deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
};
