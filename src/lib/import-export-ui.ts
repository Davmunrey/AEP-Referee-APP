/**
 * Shared copy, types, and helpers for import/export wizards.
 * DoD: preview before apply, formatApiError on failures, focus trap + Escape, aria-live on result.
 */

export type TransferStep = "upload" | "preview" | "result";

export type TransferKind =
  | "calendar"
  | "schedule"
  | "judges"
  | "roster_export"
  | "analytics_export";

/** UI entry → permission helper (see permissions.ts). */
export const TRANSFER_PERMISSION_MATRIX: Record<
  "calendar" | "judges",
  { fn: "canImportCalendar" | "canImportJudgesRegistry"; entry: string }
> = {
  calendar: { fn: "canImportCalendar", entry: "competitions/page, calendar-import-button" },
  judges: { fn: "canImportJudgesRegistry", entry: "referees/page, judges-registry-import" },
};

export const TRANSFER_DEFINITION_OF_DONE = {
  previewBeforeApply: true,
  formatApiError: true,
  focusTrap: true,
  escapeCloses: true,
  ariaLiveOnResult: true,
} as const;

export const TRANSFER_STEP_LABELS: Record<TransferStep, string> = {
  upload: "Archivo",
  preview: "Vista previa",
  result: "Resultado",
};

export interface TransferKindCopy {
  title: string;
  subtitle: string;
  uploadCta: string;
  applyCta: string;
  acceptedHint: string;
}

export const TRANSFER_KIND_COPY: Record<TransferKind, TransferKindCopy> = {
  calendar: {
    title: "Importar calendario AEP",
    subtitle:
      "PDF o CSV del calendario anual. Crea campeonatos en el listado; no sustituye la plantilla de tarima.",
    uploadCta: "Seleccionar calendario",
    applyCta: "Crear campeonatos en el listado",
    acceptedHint: "PDF / CSV · calendario anual AEP",
  },
  schedule: {
    title: "Importar horario del campeonato",
    subtitle:
      "PDF del horario de esta competición. Sustituye la plantilla de tarima (sesiones y plazas).",
    uploadCta: "Seleccionar PDF del horario",
    applyCta: "Aplicar plantilla en la tarima",
    acceptedHint: "PDF · horario del campeonato",
  },
  judges: {
    title: "Importar Control de jueces",
    subtitle: "Excel «Copia de Control jueces». Vista previa antes de guardar en la base de datos.",
    uploadCta: "Seleccionar Excel (.xlsx)",
    applyCta: "Confirmar importación",
    acceptedHint: "XLSX / XLS",
  },
  roster_export: {
    title: "Exportar acta de tarima",
    subtitle: "Texto plano con sesiones, plazas y asignaciones del campeonato.",
    uploadCta: "",
    applyCta: "Descargar .txt",
    acceptedHint: "",
  },
  analytics_export: {
    title: "Exportar estadísticas",
    subtitle: "CSV con histórico anual, actividad por zona y campeonatos del año activo.",
    uploadCta: "",
    applyCta: "Descargar .csv",
    acceptedHint: "",
  },
};

const MIME_BY_KIND: Partial<Record<TransferKind, string>> = {
  calendar: "application/pdf,text/csv,.csv",
  schedule: "application/pdf",
  judges:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
};

export function getAcceptedMime(kind: TransferKind): string {
  return MIME_BY_KIND[kind] ?? "";
}

export function formatFileMeta(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Generic preview gate: at least one actionable row or explicit apply allowed. */
export function canApplyPreview(preview: {
  toCreateCount?: number;
  eligibleCount?: number;
  sessionCount?: number;
  refereeCount?: number;
}): boolean {
  if (preview.toCreateCount != null && preview.toCreateCount > 0) return true;
  if (preview.eligibleCount != null && preview.eligibleCount > 0) return true;
  if (preview.sessionCount != null && preview.sessionCount > 0) return true;
  if (preview.refereeCount != null && preview.refereeCount > 0) return true;
  return false;
}

/** Sum competition + pesaje slots across parsed template sessions. */
export function countScheduleSlots(
  sessions: Array<{ roles: Array<{ slots: number }>; pesajeRoles: Array<{ slots: number }> }>,
): number {
  return sessions.reduce(
    (sum, s) =>
      sum +
      s.roles.reduce((a, r) => a + r.slots, 0) +
      s.pesajeRoles.reduce((a, r) => a + r.slots, 0),
    0,
  );
}

export function scheduleReplaceWarning(hasExistingTemplate: boolean): string | null {
  if (!hasExistingTemplate) return null;
  return "La plantilla actual de tarima se reemplazará por completo. Las asignaciones pueden quedar desalineadas hasta que vuelvas a asignar jueces.";
}

export const EXPORT_PREVIEW_MAX_LINES = 40;

export function truncateTextPreview(text: string, maxLines = EXPORT_PREVIEW_MAX_LINES): {
  preview: string;
  truncated: boolean;
  totalLines: number;
} {
  const lines = text.split(/\r?\n/);
  const truncated = lines.length > maxLines;
  return {
    preview: (truncated ? lines.slice(0, maxLines) : lines).join("\n"),
    truncated,
    totalLines: lines.length,
  };
}

export function downloadBlob(content: string | Blob, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
