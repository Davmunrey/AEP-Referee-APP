import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import { isApiError } from "./types";
import { request } from "./request";
import type {
  ApprovalProposal,
  AssignmentsMap,
  CrossZoneMap,
  FlagsMap,
  RosterHistoryEntry,
  RosterSession,
  SlotFlags,
} from "@/lib/types";

export const rosterApi = {
  getRoster: (competitionId: string) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster`,
    ),

  saveTemplate: (competitionId: string, template: RosterSession[]) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster/template`,
      { method: "PUT", body: JSON.stringify({ template }) },
    ),

  assignReferee: (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    flags?: SlotFlags,
    crossZoneReason?: string,
  ) =>
    request<{ assignments: AssignmentsMap; flags?: FlagsMap; crossZoneMap?: CrossZoneMap }>(
      `/competitions/${competitionId}/roster/assign`,
      { method: "POST", body: JSON.stringify({ slotKey, refereeId, flags, crossZoneReason }) },
    ),

  clearSlot: (competitionId: string, slotKey: string) =>
    request<{ assignments: AssignmentsMap }>(`/competitions/${competitionId}/roster/clear`, {
      method: "POST",
      body: JSON.stringify({ slotKey }),
    }),

  clearRosterAssignments: (competitionId: string) =>
    request<{ assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster/clear`,
      { method: "DELETE" },
    ),

  clearRosterTemplate: (competitionId: string) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster/template`,
      { method: "DELETE" },
    ),

  saveDraft: (competitionId: string) =>
    request<{ message: string }>(`/competitions/${competitionId}/roster/draft`, { method: "POST" }),

  submitRoster: (competitionId: string) =>
    request<{ message: string; proposal: ApprovalProposal }>(
      `/competitions/${competitionId}/roster/submit`,
      { method: "POST" },
    ),

  exportRosterUrl: (competitionId: string) =>
    `${getApiBaseUrl()}/competitions/${competitionId}/roster/export`,

  fetchRosterExportText: async (competitionId: string): Promise<string> => {
    const res = await fetch(`${getApiBaseUrl()}/competitions/${competitionId}/roster/export`, {
      credentials: "include",
    });
    if (!res.ok) {
      const parsed = await parseApiResponse<unknown>(res);
      if (isApiError(parsed)) throw new Error(parsed.error);
      throw new Error("No se pudo generar el acta");
    }
    return res.text();
  },

  setSlotFlags: (competitionId: string, slotKey: string, flags: SlotFlags) =>
    request<{ flags: FlagsMap }>(`/competitions/${competitionId}/roster/flags`, {
      method: "PATCH",
      body: JSON.stringify({ slotKey, flags }),
    }),

  getRosterHistory: (competitionId: string) =>
    request<RosterHistoryEntry[]>(`/competitions/${competitionId}/roster/history`),

  importSchedule: async (
    competitionId: string,
    file: File,
    apply = false,
    selectedKeys?: string[],
  ): Promise<{
    preview: {
      filename: string;
      pages: number;
      sessionCount: number;
      tipoDetected: string;
      warnings: string[];
      header: { campeonato?: string; sede?: string; fechasTexto?: string; revision?: string; tipo?: string };
    };
    template: RosterSession[];
    assignments?: AssignmentsMap;
    flags?: FlagsMap;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    if (selectedKeys) fd.append("selectedKeys", JSON.stringify(selectedKeys));
    const path = `/competitions/${competitionId}/roster/template/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, { method: "POST", credentials: "include", body: fd });
    const parsed = await parseApiResponse<{
      preview: { filename: string; pages: number; sessionCount: number; tipoDetected: string; warnings: string[]; header: { campeonato?: string; sede?: string; fechasTexto?: string; revision?: string; tipo?: string } };
      template: RosterSession[];
      assignments?: AssignmentsMap;
      flags?: FlagsMap;
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },

  importCalendar: async (
    file: File,
    apply = false,
    selectedKeys?: string[],
  ): Promise<{
    preview: {
      filename: string;
      year: number;
      totalDetected: number;
      eligibleCount: number;
      duplicateCount: number;
      dbDuplicateCount: number;
      toCreateCount: number;
      warnings: string[];
      entries: Array<{
        key: string; rawDate: string; fechaInicio: string | null; fechaFin: string | null;
        nombre: string; localidad: string; organizador: string; tipo: string | null;
        zona?: string; pendiente: boolean; nuevo: boolean; importable: boolean; selected: boolean; reason: string;
      }>;
    };
    created?: number;
    dedupeRemoved?: number;
    errors?: string[];
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    if (selectedKeys) fd.append("selectedKeys", JSON.stringify(selectedKeys));
    const path = `/calendar/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, { method: "POST", credentials: "include", body: fd });
    const parsed = await parseApiResponse<{
      preview: { filename: string; year: number; totalDetected: number; eligibleCount: number; duplicateCount: number; dbDuplicateCount: number; toCreateCount: number; warnings: string[]; entries: Array<{ key: string; rawDate: string; fechaInicio: string | null; fechaFin: string | null; nombre: string; localidad: string; organizador: string; tipo: string | null; zona?: string; pendiente: boolean; nuevo: boolean; importable: boolean; selected: boolean; reason: string }> };
      created?: number; dedupeRemoved?: number; errors?: string[];
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },

  importQuadrantAssignments: async (
    competitionId: string,
    file: File,
    apply = false,
    selectedKeys?: string[],
  ): Promise<{
    preview: {
      filename: string; pages: number; detectedCount: number; importableCount: number; selectedCount: number; warnings: string[];
      candidates: Array<{ key: string; session: string; roleKey: string; roleLabel: string; slotKey: string | null; refereeId: string | null; refereeName: string; matchedName?: string; confidence: "alta" | "media" | "baja"; importable: boolean; selected: boolean; reason: string }>;
    };
    applied?: number; errors?: string[]; assignments?: AssignmentsMap; flags?: FlagsMap;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    if (selectedKeys) fd.append("selectedKeys", JSON.stringify(selectedKeys));
    const path = `/competitions/${competitionId}/roster/assignments/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, { method: "POST", credentials: "include", body: fd });
    const parsed = await parseApiResponse<{
      preview: { filename: string; pages: number; detectedCount: number; importableCount: number; selectedCount: number; warnings: string[]; candidates: Array<{ key: string; session: string; roleKey: string; roleLabel: string; slotKey: string | null; refereeId: string | null; refereeName: string; matchedName?: string; confidence: "alta" | "media" | "baja"; importable: boolean; selected: boolean; reason: string }> };
      applied?: number; errors?: string[]; assignments?: AssignmentsMap; flags?: FlagsMap;
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },
};
