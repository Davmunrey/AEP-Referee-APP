import { getSession } from "@/lib/auth/session";
import { isLocalOnly } from "@/lib/runtime";
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
  RosterSession,
} from "@/lib/types";
import { dataService } from "@/server/services";
import { isApiError } from "./types";

function shouldUseInternalServices(): boolean {
  if (isLocalOnly()) return true;
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured) return true;
  try {
    const base = new URL(getApiBaseUrl());
    return base.pathname.endsWith("/api/v1");
  } catch {
    return true;
  }
}

async function serverRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    credentials: "include",
  });
  const parsed = await parseApiResponse<T>(res);
  if (isApiError(parsed)) {
    throw new Error(parsed.error);
  }
  return parsed.data;
}

async function withUser<T>(fn: (user: NonNullable<Awaited<ReturnType<typeof getSession>>>) => T): Promise<T> {
  const user = await getSession();
  if (!user) throw new Error("No autenticado");
  if (shouldUseInternalServices()) {
    return fn(user);
  }
  throw new Error("Use API externa");
}

export const serverApi = {
  getMeta: async (): Promise<AppMeta> => {
    const user = await getSession();
    if (!user) throw new Error("No autenticado");
    if (shouldUseInternalServices()) return dataService.getMeta(user);
    return serverRequest<AppMeta>("/meta");
  },

  getDashboard: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getDashboard(user)
        : serverRequest<DashboardPayload>("/dashboard"),
    ),

  getReferees: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getReferees({ user })
        : serverRequest<Referee[]>("/referees"),
    ),

  getReferee: (id: string) =>
    withUser(() =>
      shouldUseInternalServices()
        ? Promise.resolve(dataService.getReferee(id))
        : serverRequest<Referee>(`/referees/${id}`),
    ),

  getCompetitions: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getCompetitions(user)
        : serverRequest<Competition[]>("/competitions"),
    ),

  getCompetition: (id: string) =>
    withUser(() => {
      if (shouldUseInternalServices()) {
        const event = dataService.getCompetition(id);
        if (!event) throw new Error("Competición no encontrada");
        return event;
      }
      return serverRequest<Competition>(`/competitions/${id}`);
    }),

  getRoster: (eventId: string) =>
    withUser(() => {
      if (shouldUseInternalServices()) {
        const roster = dataService.getRoster(eventId);
        if (!roster) throw new Error("Competición no encontrada");
        return roster;
      }
      return serverRequest<{ template: RosterSession[]; assignments: AssignmentsMap }>(
        `/competitions/${eventId}/roster`,
      );
    }),

  getApprovals: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getApprovals(user)
        : serverRequest<ApprovalProposal[]>("/approvals"),
    ),

  getPromotions: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getPromotions(user)
        : serverRequest<PromotionRequest[]>("/promotions"),
    ),

  getAnalytics: () =>
    withUser((user) =>
      shouldUseInternalServices()
        ? dataService.getAnalytics(user)
        : serverRequest<AnalyticsPayload>("/analytics"),
    ),

  getRegulations: () =>
    shouldUseInternalServices()
      ? Promise.resolve(dataService.getRegulations())
      : serverRequest<RegulationRule[]>("/regulations"),
};
