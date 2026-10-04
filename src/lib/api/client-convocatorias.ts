import { request } from "./request";
import type { ConvocatoriaStaffView, PortalConvocatoria } from "@/lib/convocatorias";

export const convocatoriaApi = {
  // ── Gestión (tarima del campeonato) ──
  getConvocatoria: (competitionId: string) =>
    request<ConvocatoriaStaffView | null>(`/competitions/${competitionId}/convocatoria`),

  createConvocatoria: (competitionId: string, body: { sesiones: string[]; cierraEl: string; mensaje?: string }) =>
    request<ConvocatoriaStaffView>(`/competitions/${competitionId}/convocatoria`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateConvocatoria: (
    competitionId: string,
    body: { estado?: "abierta" | "cerrada" | "cancelada"; cierraEl?: string; mensaje?: string; sesiones?: string[] },
  ) =>
    request<ConvocatoriaStaffView>(`/competitions/${competitionId}/convocatoria`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // ── Portal del juez ──
  apuntarseConvocatoria: (convocatoriaId: string, sesion: string, nota?: string) =>
    request<PortalConvocatoria>(`/portal/convocatorias/${convocatoriaId}/inscripciones`, {
      method: "POST",
      body: JSON.stringify({ sesion, nota }),
    }),

  retirarseConvocatoria: (convocatoriaId: string, sesion: string) =>
    request<PortalConvocatoria>(
      `/portal/convocatorias/${convocatoriaId}/inscripciones?sesion=${encodeURIComponent(sesion)}`,
      { method: "DELETE" },
    ),
};
