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

async function withUser<T>(
  fn: (user: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<T>,
): Promise<T> {
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
    if (shouldUseInternalServices()) return await dataService.getMeta(user);
    return serverRequest<AppMeta>("/meta");
  },

  getDashboard: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getDashboard(user)
        : serverRequest<DashboardPayload>("/dashboard"),
    ),

  getReferees: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getReferees({ user })
        : serverRequest<Referee[]>("/referees"),
    ),

  getReferee: (id: string) =>
    withUser(async () =>
      shouldUseInternalServices()
        ? await dataService.getReferee(id)
        : serverRequest<Referee>(`/referees/${id}`),
    ),

  getCompetitions: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getCompetitions(user)
        : serverRequest<Competition[]>("/competitions"),
    ),

  getCompetition: (id: string) =>
    withUser(async () => {
      if (shouldUseInternalServices()) {
        const competition = await dataService.getCompetition(id);
        if (!competition) throw new Error("Competición no encontrada");
        return competition;
      }
      return serverRequest<Competition>(`/competitions/${id}`);
    }),

  getRoster: (competitionId: string) =>
    withUser(async () => {
      if (shouldUseInternalServices()) {
        const roster = await dataService.getRoster(competitionId);
        if (!roster) throw new Error("Competición no encontrada");
        return roster;
      }
      return serverRequest<{
        template: RosterSession[];
        assignments: AssignmentsMap;
        flags: import("@/lib/types").FlagsMap;
      }>(`/competitions/${competitionId}/roster`);
    }),

  getApprovals: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getApprovals(user)
        : serverRequest<ApprovalProposal[]>("/approvals"),
    ),

  getPromotions: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getPromotions(user)
        : serverRequest<PromotionRequest[]>("/promotions"),
    ),

  getAnalytics: () =>
    withUser(async (user) =>
      shouldUseInternalServices()
        ? await dataService.getAnalytics(user)
        : serverRequest<AnalyticsPayload>("/analytics"),
    ),

  getRegulations: async () =>
    shouldUseInternalServices()
      ? dataService.getRegulations()
      : serverRequest<RegulationRule[]>("/regulations"),
};
