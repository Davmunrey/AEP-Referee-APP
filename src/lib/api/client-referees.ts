import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import { isApiError } from "./types";
import { request } from "./request";
import type {
  JudgesRegistryImportResult,
  Referee,
  RefereeSanction,
  SanctionDurationPreset,
} from "@/lib/types";

export const refereeApi = {
  getReferees: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Referee[]>(`/referees${qs}`);
  },

  getReferee: (id: string) => request<Referee>(`/referees/${id}`),

  createReferee: (body: Partial<Referee>) =>
    request<Referee>("/referees", { method: "POST", body: JSON.stringify(body) }),

  updateReferee: (id: string, body: Partial<Referee>) =>
    request<Referee>(`/referees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteReferee: (id: string) =>
    request<{ deleted: boolean }>(`/referees/${id}`, { method: "DELETE" }),

  listRefereeSanctions: (refereeId: string) =>
    request<RefereeSanction[]>(`/referees/${refereeId}/sanctions`),

  createRefereeSanction: (
    refereeId: string,
    body: {
      motivo: string;
      fechaInicio?: string;
      duration: SanctionDurationPreset;
      fechaFin?: string;
      notas?: string;
    },
  ) =>
    request<RefereeSanction>(`/referees/${refereeId}/sanctions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revokeSanction: (sanctionId: string, motivo?: string) =>
    request<RefereeSanction>(`/sanctions/${sanctionId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "revoke", motivo }),
    }),

  markSanctionNotified: (sanctionId: string) =>
    request<RefereeSanction>(`/sanctions/${sanctionId}/notify`, { method: "POST" }),

  importJudgesRegistry: async (
    file: File,
    options: { replace?: boolean; apply?: boolean } = {},
  ): Promise<JudgesRegistryImportResult> => {
    const { replace = false, apply = false } = options;
    const fd = new FormData();
    fd.append("file", file);
    const params = new URLSearchParams();
    if (replace) params.set("replace", "true");
    if (apply) params.set("apply", "true");
    const qs = params.toString();
    const path = `/referees/import${qs ? `?${qs}` : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      headers: replace && apply ? { "x-confirm-registry-replace": "true" } : undefined,
      body: fd,
    });
    const parsed = await parseApiResponse<JudgesRegistryImportResult>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },
};
