import { request } from "./request";
import type { Competition } from "@/lib/types";

export const competitionApi = {
  getCompetitions: () => request<Competition[]>("/competitions"),

  createCompetition: (body: Partial<Competition>) =>
    request<Competition>("/competitions", { method: "POST", body: JSON.stringify(body) }),

  getCompetition: (id: string) => request<Competition>(`/competitions/${id}`),

  updateCompetition: (
    id: string,
    body: Partial<Pick<Competition, "nombre" | "tipo" | "fecha" | "fechaFin" | "sede" | "zona">>,
  ) =>
    request<Competition>(`/competitions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

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
};
