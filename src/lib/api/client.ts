import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import type {
  AnalyticsPayload,
  AppMeta,
  ApprovalProposal,
  AssignmentsMap,
  CrossZoneMap,
  FlagsMap,
  SlotFlags,
  Competition,
  DashboardPayload,
  ExamResult,
  ExamType,
  PromotionRequest,
  Referee,
  RefereeSanction,
  SanctionDurationPreset,
  RefereeExam,
  JudgesRegistryImportResult,
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

  listRefereeSanctions: (refereeId: string) =>
    request<RefereeSanction[]>(`/referees/${refereeId}/sanctions`),

  getCompetitionAvailability: (competitionId: string) =>
    request<{ confirmedIds: string[] }>(`/competitions/${competitionId}/availability`),

  addCompetitionAvailability: (competitionId: string, refereeId: string) =>
    request<{ ok: boolean }>(`/competitions/${competitionId}/availability`, {
      method: "POST",
      body: JSON.stringify({ refereeId }),
    }),

  removeCompetitionAvailability: (competitionId: string, refereeId: string) =>
    request<{ ok: boolean }>(`/competitions/${competitionId}/availability/${refereeId}`, {
      method: "DELETE",
    }),

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

  getCompetitions: () => request<Competition[]>("/competitions"),

  createCompetition: (body: Partial<Competition>) =>
    request<Competition>("/competitions", { method: "POST", body: JSON.stringify(body) }),

  getCompetition: (id: string) => request<Competition>(`/competitions/${id}`),

  updateCompetition: (id: string, body: Partial<Pick<Competition, "nombre" | "tipo" | "fecha" | "fechaFin" | "sede" | "zona">>) =>
    request<Competition>(`/competitions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getRoster: (competitionId: string) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster`,
    ),

  saveTemplate: (competitionId: string, template: RosterSession[]) =>
    request<{ template: RosterSession[]; assignments: AssignmentsMap; flags: FlagsMap }>(
      `/competitions/${competitionId}/roster/template`,
      { method: "PUT", body: JSON.stringify({ template }) },
    ),

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
        key: string;
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
        importable: boolean;
        selected: boolean;
        reason: string;
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
        dbDuplicateCount: number;
        toCreateCount: number;
        warnings: string[];
        entries: Array<{
          key: string;
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
          importable: boolean;
          selected: boolean;
          reason: string;
        }>;
      };
      created?: number;
      dedupeRemoved?: number;
      errors?: string[];
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },

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

  fetchAnalyticsExportText: async (): Promise<string> => {
    const res = await fetch(`${getApiBaseUrl()}/analytics/export`, {
      credentials: "include",
    });
    if (!res.ok) {
      const parsed = await parseApiResponse<unknown>(res);
      if (isApiError(parsed)) throw new Error(parsed.error);
      throw new Error("No se pudo generar el CSV");
    }
    return res.text();
  },

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
    if (selectedKeys) fd.append("selectedKeys", JSON.stringify(selectedKeys));
    const path = `/competitions/${competitionId}/roster/template/import${apply ? "?apply=true" : ""}`;
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

  importQuadrantAssignments: async (
    competitionId: string,
    file: File,
    apply = false,
    selectedKeys?: string[],
  ): Promise<{
    preview: {
      filename: string;
      pages: number;
      detectedCount: number;
      importableCount: number;
      selectedCount: number;
      warnings: string[];
      candidates: Array<{
        key: string;
        session: string;
        roleKey: string;
        roleLabel: string;
        slotKey: string | null;
        refereeId: string | null;
        refereeName: string;
        matchedName?: string;
        confidence: "alta" | "media" | "baja";
        importable: boolean;
        selected: boolean;
        reason: string;
      }>;
    };
    applied?: number;
    errors?: string[];
    assignments?: AssignmentsMap;
    flags?: FlagsMap;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    if (selectedKeys) fd.append("selectedKeys", JSON.stringify(selectedKeys));
    const path = `/competitions/${competitionId}/roster/assignments/import${apply ? "?apply=true" : ""}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const parsed = await parseApiResponse<{
      preview: {
        filename: string;
        pages: number;
        detectedCount: number;
        importableCount: number;
        selectedCount: number;
        warnings: string[];
        candidates: Array<{
          key: string;
          session: string;
          roleKey: string;
          roleLabel: string;
          slotKey: string | null;
          refereeId: string | null;
          refereeName: string;
          matchedName?: string;
          confidence: "alta" | "media" | "baja";
          importable: boolean;
          selected: boolean;
          reason: string;
        }>;
      };
      applied?: number;
      errors?: string[];
      assignments?: AssignmentsMap;
      flags?: FlagsMap;
    }>(res);
    if (isApiError(parsed)) throw new Error(parsed.error);
    return parsed.data;
  },

  setSlotFlags: (competitionId: string, slotKey: string, flags: SlotFlags) =>
    request<{ flags: FlagsMap }>(`/competitions/${competitionId}/roster/flags`, {
      method: "PATCH",
      body: JSON.stringify({ slotKey, flags }),
    }),

  getRosterHistory: (competitionId: string) =>
    request<RosterHistoryEntry[]>(`/competitions/${competitionId}/roster/history`),

  assignReferee: (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    flags?: SlotFlags,
    crossZoneReason?: string,
  ) =>
    request<{ assignments: AssignmentsMap; flags?: FlagsMap; crossZoneMap?: CrossZoneMap }>(
      `/competitions/${competitionId}/roster/assign`,
      {
        method: "POST",
        body: JSON.stringify({ slotKey, refereeId, flags, crossZoneReason }),
      },
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

  getCompetitionDuplicates: () =>
    request<{
      groupCount: number;
      duplicateCount: number;
      groups: Array<{
        key: string;
        competitions: Array<{
          id: string;
          nombre: string;
          fecha: string;
          tipo: string;
          confirmados: number;
          estado: string;
        }>;
      }>;
    }>("/competitions/dedupe"),

  removeCompetitionDuplicates: () =>
    request<{ removed: string[]; kept: string[]; groups: number }>(
      "/competitions/dedupe",
      { method: "POST" },
    ),

  getPromotions: () => request<PromotionRequest[]>("/promotions"),

  createPromotion: (body: {
    refereeId: string;
    toLevel: string;
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
    subjectType: "competicion" | "juez";
    refereeId?: string;
    competitionId?: string;
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
