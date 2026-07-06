import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import { isApiError } from "./types";
import { request } from "./request";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  DashboardPayload,
  ExamResult,
  ExamType,
  PromotionRequest,
  RefereeExam,
  RefereeLevel,
  RefereeReport,
  RegulationRule,
  ReportType,
} from "@/lib/types";

export const miscApi = {
  getMeta: () => request<AppMeta>("/meta"),
  getDashboard: () => request<DashboardPayload>("/dashboard"),

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
    request<RefereeExam>("/exams", { method: "POST", body: JSON.stringify(body) }),

  updateExam: (id: string, body: { resultado?: ExamResult; puntuacion?: number; notas?: string; fecha?: string; examinador?: string }) =>
    request<RefereeExam>(`/exams/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteExam: (id: string) =>
    request<{ deleted: boolean }>(`/exams/${id}`, { method: "DELETE" }),

  getReports: (refereeId?: string) =>
    request<RefereeReport[]>(`/reports${refereeId ? `?refereeId=${refereeId}` : ""}`),

  createReport: (body: {
    subjectType: "competicion" | "juez";
    refereeId?: string;
    competitionId?: string;
    titulo: string;
    tipo: ReportType;
    evento?: string;
    contenido: string;
    adjuntoUrl?: string;
  }) =>
    request<RefereeReport>("/reports", { method: "POST", body: JSON.stringify(body) }),

  updateReport: (id: string, body: { titulo?: string; tipo?: ReportType; evento?: string; contenido?: string; adjuntoUrl?: string }) =>
    request<RefereeReport>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteReport: (id: string) =>
    request<{ deleted: boolean }>(`/reports/${id}`, { method: "DELETE" }),

  getApprovals: () => request<ApprovalProposal[]>("/approvals"),

  reviewApproval: (id: string, approve: boolean, comment?: string) =>
    request<ApprovalProposal>(`/approvals/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve, comment }),
    }),

  getPromotions: () => request<PromotionRequest[]>("/promotions"),

  createPromotion: (body: { refereeId: string; toLevel: string; motivo?: string }) =>
    request<PromotionRequest>("/promotions", { method: "POST", body: JSON.stringify(body) }),

  reviewPromotion: (id: string, approve: boolean, comment?: string) =>
    request<PromotionRequest>(`/promotions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve, comment }),
    }),

  getAnalytics: () => request<AnalyticsPayload>("/analytics"),

  /** Asistente IA (Gemini). Lanza si no está configurado o falla → fallback local. */
  askAssistant: (question: string, history: { role: "user" | "model"; text: string }[]) =>
    request<{ reply: string }>("/assistant", {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),

  analyticsExportUrl: () => `${getApiBaseUrl()}/analytics/export`,

  fetchAnalyticsExportText: async (year?: number): Promise<string> => {
    const qs = year != null ? `?year=${year}` : "";
    const res = await fetch(`${getApiBaseUrl()}/analytics/export${qs}`, { credentials: "include" });
    if (!res.ok) {
      const parsed = await parseApiResponse<unknown>(res);
      if (isApiError(parsed)) throw new Error(parsed.error);
      throw new Error("No se pudo generar el CSV");
    }
    return res.text();
  },
};
