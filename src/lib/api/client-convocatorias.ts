import { request } from "./request";
import type { ConvocatoriaStaffView, PortalConvocatoria } from "@/lib/convocatorias";

export const convocatoriaApi = {
  // ── Gestión (tarima del campeonato) ──
  getConvocatoria: (competitionId: string) =>
    request<ConvocatoriaStaffView | null>(`/competitions/${competitionId}/convocatoria`),

  createConvocatoria: (
    competitionId: string,
    body: { sesiones: string[]; cierraEl: string; mensaje?: string; zonasExtra?: string[]; ampliarDiasAntes?: number },
  ) =>
    request<ConvocatoriaStaffView>(`/competitions/${competitionId}/convocatoria`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateConvocatoria: (
    competitionId: string,
    body: {
      estado?: "abierta" | "cerrada" | "cancelada";
      cierraEl?: string;
      mensaje?: string;
      sesiones?: string[];
      zonasExtra?: string[];
    },
  ) =>
    request<ConvocatoriaStaffView>(`/competitions/${competitionId}/convocatoria`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** El delegado de la zona invitada acepta o rechaza sumarse. */
  resolverZonaConvocatoria: (convocatoriaId: string, zona: string, aceptar: boolean) =>
    request<{ ok: true }>(`/convocatorias/${convocatoriaId}/zonas/${encodeURIComponent(zona)}`, {
      method: "POST",
      body: JSON.stringify({ aceptar }),
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
