import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  DashboardPayload,
  PromotionRequest,
  Referee,
  RegulationRule,
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

  switchDemoPersona: (userId: string) =>
    request<{ user: SessionUser }>("/auth/switch", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

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

  getPromotions: () => request<PromotionRequest[]>("/promotions"),

  reviewPromotion: (id: string, approve: boolean) =>
    request<PromotionRequest>(`/promotions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    }),

  getAnalytics: () => request<AnalyticsPayload>("/analytics"),

  getRegulations: () => request<RegulationRule[]>("/regulations"),
};
