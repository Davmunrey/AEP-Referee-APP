"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/data-transfer/file-drop-zone";
import { TransferDialogShell } from "@/components/data-transfer/transfer-dialog-shell";
import { TransferPreviewStats } from "@/components/data-transfer/transfer-preview-stats";
import { TransferResultBanner } from "@/components/data-transfer/transfer-result-banner";
import { TransferStepper } from "@/components/data-transfer/transfer-stepper";
import { TransferWarnings } from "@/components/data-transfer/transfer-warnings";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import {
  countScheduleSlots,
  scheduleReplaceWarning,
  TRANSFER_KIND_COPY,
  type TransferStep,
} from "@/lib/import-export-ui";
import type { RosterSession } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ImportPreview {
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
  };
}

interface ScheduleImportDialogProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onApplied: (template: RosterSession[]) => void;
  hasExistingTemplate?: boolean;
}

export function ScheduleImportDialog({
  eventId,
  open,
  onClose,
  onApplied,
  hasExistingTemplate = false,
}: ScheduleImportDialogProps) {
  const copy = TRANSFER_KIND_COPY.schedule;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [template, setTemplate] = useState<RosterSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setTemplate(null);
      setError(null);
      setLoading(false);
      setApplied(false);
      setConfirmReplace(false);
    }
  }, [open]);

  const step: TransferStep = applied ? "result" : preview ? "preview" : "upload";
  const replaceWarning = scheduleReplaceWarning(hasExistingTemplate);
  const needsReplaceConfirm = hasExistingTemplate && !!preview && !applied;

  const runPreview = async (selected: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setTemplate(null);
    setConfirmReplace(false);
    try {
      const res = await api.importSchedule(eventId, selected, false);
      setPreview(res.preview);
      setTemplate(res.template);
    } catch (e) {
      setError(formatApiError(e, "Error procesando el PDF"));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    void runPreview(f);
  };

  const apply = async () => {
    if (!template || !file) return;
    if (needsReplaceConfirm && !confirmReplace) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importSchedule(eventId, file, true);
      setApplied(true);
      await new Promise<void>((r) => setTimeout(r, 900));
      onApplied(res.template);
    } catch (e) {
      setError(formatApiError(e, "No se pudo guardar la plantilla"));
      setLoading(false);
    }
  };

  const slotCount = template ? countScheduleSlots(template) : 0;
  const canApply =
    !!template && template.length > 0 && (!needsReplaceConfirm || confirmReplace) && !applied;

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        {applied ? "Cerrar" : "Cancelar"}
      </Button>
      {!applied && (
        <Button type="button" onClick={() => void apply()} disabled={!canApply || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Procesando…
            </>
          ) : (
            copy.applyCta
          )}
        </Button>
      )}
    </div>
  );

  return (
    <TransferDialogShell
      open={open}
      onClose={onClose}
      title={copy.title}
      subtitle={copy.subtitle}
      titleId="schedule-import-title"
      footer={footer}
    >
      <TransferStepper step={step} />

      <FileDropZone
        kind="schedule"
        file={file}
        onFile={handleFile}
        disabled={loading || applied}
        hint={copy.acceptedHint}
      />

      {loading && !preview && !applied ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procesando PDF…
        </div>
      ) : null}

      {error ? (
        <TransferResultBanner variant="error" title="No se pudo importar">
          {error}
        </TransferResultBanner>
      ) : null}

      {applied ? (
        <TransferResultBanner variant="success" title="Plantilla aplicada">
          Cerrando…
        </TransferResultBanner>
      ) : null}

      {preview && template && !applied ? (
        <div className="space-y-3 transfer-enter">
          <TransferPreviewStats
            items={[
              { label: "Sesiones", value: preview.sessionCount, tone: "success" },
              { label: "Plazas", value: slotCount, tone: "success" },
              { label: "Páginas", value: preview.pages },
              { label: "Tipo", value: preview.tipoDetected },
            ]}
          />

          {(preview.header.campeonato || preview.header.sede || preview.header.fechasTexto) && (
            <div className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs sm:grid-cols-2">
              {preview.header.campeonato ? (
                <div>
                  <span className="text-subtle-muted">Campeonato:</span>{" "}
                  <span className="font-medium text-foreground">{preview.header.campeonato}</span>
                </div>
              ) : null}
              {preview.header.sede ? (
                <div>
                  <span className="text-subtle-muted">Sede:</span>{" "}
                  <span className="font-medium text-foreground">{preview.header.sede}</span>
                </div>
              ) : null}
              {preview.header.fechasTexto ? (
                <div className="sm:col-span-2">
                  <span className="text-subtle-muted">Fechas:</span>{" "}
                  <span className="font-medium text-foreground">{preview.header.fechasTexto}</span>
                </div>
              ) : null}
            </div>
          )}

          <TransferWarnings warnings={preview.warnings} />

          {replaceWarning ? (
            <div className="rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning">
              <p className="font-semibold">Reemplazo de plantilla</p>
              <p className="mt-1">{replaceWarning}</p>
              {needsReplaceConfirm ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Entiendo que se reemplaza la plantilla actual de tarima</span>
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Día</th>
                  <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Sesión</th>
                  <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Categorías</th>
                  <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Pesaje</th>
                  <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Competición</th>
                </tr>
              </thead>
              <tbody>
                {template.map((s, i) => (
                  <tr
                    key={s.sesion}
                    className="transfer-row-stagger border-t border-border hover:bg-muted/40"
                    style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}
                  >
                    <td className="px-2 py-1.5 text-foreground">{s.dia}</td>
                    <td className="px-2 py-1.5 font-medium text-foreground">{s.sesion}</td>
                    <td className="px-2 py-1.5 text-foreground">
                      {s.categorias.map((c) => `${c.genero} ${c.pesos}`).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{s.horarioPesaje || "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {s.horarioCompeticion || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </TransferDialogShell>
  );
}
