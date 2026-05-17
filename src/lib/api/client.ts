import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  FlagsMap,
  SlotFlags,
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

// Nota: el login/logout se gestiona directamente con el cliente Supabase
// en /sign-in y el sidebar — no hay método de API REST para auth.
export const api = {
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
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${eventId}/roster`,
    ),

  saveTemplate: (eventId: string, template: RosterSession[]) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${eventId}/roster/template`,
      { method: "PUT", body: JSON.stringify({ template }) },
    ),

  importCalendar: async (
    file: File,
    apply = false,
  ): Promise<{
    preview: {
      filename: string;
      year: number;
      totalDetected: number;
      eligibleCount: number;
      duplicateCount: number;
      toCreateCount: number;
      warnings: string[];
      entries: Array<{
        rawDate: string;
        fechaInicio: string | null;
        fechaFin: string | null;
        nombre: string;
        localidad: string;
        organizador: string;
        tipo: string | null;
        zona?: string;
        pendiente: boolean;
        nuevo: boolean;
      }>;
    };
    created?: number;
    errors?: string[];
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    const path = `/calendar/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const parsed = await parseApiResponse<{
      preview: {
        filename: string;
        year: number;
        totalDetected: number;
        eligibleCount: number;
        duplicateCount: number;
        toCreateCount: number;
        warnings: string[];
        entries: Array<{
          rawDate: string;
          fechaInicio: string | null;
          fechaFin: string | null;
          nombre: string;
          localidad: string;
          organizador: string;
          tipo: string | null;
          zona?: string;
          pendiente: boolean;
          nuevo: boolean;
        }>;
      };
      created?: number;
      errors?: string[];
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },

  importSchedule: async (
    eventId: string,
    file: File,
    apply = false,
  ): Promise<{
    preview: {
      filename: string;
      pages: number;
      sessionCount: number;
      tipoDetected: string;
      warnings: string[];
      header: {
        campeonato?: string;
        sede?: string;
        fechasTexto?: string;
        revision?: string;
        tipo?: string;
      };
    };
    template: RosterSession[];
    assignments?: AssignmentsMap;
    flags?: FlagsMap;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    const path = `/competitions/${eventId}/roster/template/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const parsed = await parseApiResponse<{
      preview: {
        filename: string;
        pages: number;
        sessionCount: number;
        tipoDetected: string;
        warnings: string[];
        header: {
          campeonato?: string;
          sede?: string;
          fechasTexto?: string;
          revision?: string;
          tipo?: string;
        };
      };
      template: RosterSession[];
      assignments?: AssignmentsMap;
      flags?: FlagsMap;
    }>(res);
    if (isApiError(parsed)) {
      throw new Error(parsed.error);
    }
    return parsed.data;
  },

  setSlotFlags: (eventId: string, slotKey: string, flags: SlotFlags) =>
    request<{ flags: FlagsMap }>(`/competitions/${eventId}/roster/flags`, {
      method: "PATCH",
      body: JSON.stringify({ slotKey, flags }),
    }),

  getRosterHistory: (eventId: string) =>
    request<RosterHistoryEntry[]>(`/competitions/${eventId}/roster/history`),

  assignReferee: (
    eventId: string,
    slotKey: string,
    refereeId: string,
    flags?: SlotFlags,
  ) =>
    request<{ assignments: AssignmentsMap; flags?: FlagsMap }>(
      `/competitions/${eventId}/roster/assign`,
      {
        method: "POST",
        body: JSON.stringify({ slotKey, refereeId, flags }),
      },
    ),

  clearSlot: (eventId: string, slotKey: string) =>
    request<{ assignments: AssignmentsMap }>(`/competitions/${eventId}/roster/clear`, {
      method: "POST",
      body: JSON.stringify({ slotKey }),
    }),

  saveDraft: (eventId: string) =>
    request<{ message: string }>(`/competitions/${eventId}/roster/draft`, { method: "POST" }),

  submitRoster: (eventId: string) =>
    request<{ message: string; proposal: ApprovalProposal }>(
      `/competitions/${eventId}/roster/submit`,
      { method: "POST" },
    ),

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

  reviewPromotion: (id: string, approve: boolean, comment?: string) =>
    request<PromotionRequest>(`/promotions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve, comment }),
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

  updateReport: (
    id: string,
    body: {
      titulo?: string;
      tipo?: ReportType;
      evento?: string;
      contenido?: string;
      adjuntoUrl?: string;
    },
  ) =>
    request<RefereeReport>(`/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteReport: (id: string) =>
    request<{ deleted: boolean }>(`/reports/${id}`, { method: "DELETE" }),

  toggleUserActive: (id: string, activo: boolean) =>
    request<{ id: string; activo: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }),

  updateUser: (
    id: string,
    body: {
      activo?: boolean;
      role?: "super_admin" | "delegado_jueces" | "delegado_zona" | "solo_ver";
      zona?: string | null;
      rolLabel?: string;
      nombre?: string;
    },
  ) =>
    request<{ id: string; activo: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<{ deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
};
