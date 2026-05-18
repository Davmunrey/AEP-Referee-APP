"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/data-transfer/file-drop-zone";
import { TransferDialogShell } from "@/components/data-transfer/transfer-dialog-shell";
import { TransferPreviewStats } from "@/components/data-transfer/transfer-preview-stats";
import { TransferResultBanner } from "@/components/data-transfer/transfer-result-banner";
import { TransferStepper } from "@/components/data-transfer/transfer-stepper";
import { TransferWarnings } from "@/components/data-transfer/transfer-warnings";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import { TRANSFER_KIND_COPY, type TransferStep } from "@/lib/import-export-ui";
import { Loader2 } from "lucide-react";

interface CalendarPreview {
  filename: string;
  year: number;
  totalDetected: number;
  eligibleCount: number;
  duplicateCount: number;
  dbDuplicateCount: number;
  toCreateCount: number;
  warnings: string[];
  entries: Array<{
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
  }>;
}

interface CalendarImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarImportDialog({ open, onClose }: CalendarImportDialogProps) {
  const router = useRouter();
  const copy = TRANSFER_KIND_COPY.calendar;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CalendarPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    created: number;
    dedupeRemoved: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setError(null);
      setLoading(false);
      setApplyResult(null);
    }
  }, [open]);

  const step: TransferStep = applyResult ? "result" : preview ? "preview" : "upload";

  const runPreview = async (selected: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setApplyResult(null);
    try {
      const res = await api.importCalendar(selected, false);
      setPreview(res.preview);
    } catch (e) {
      setError(formatApiError(e, "Error procesando el calendario"));
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
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importCalendar(file, true);
      setApplyResult({
        created: res.created ?? 0,
        dedupeRemoved: res.dedupeRemoved ?? 0,
      });
      router.refresh();
    } catch (e) {
      setError(formatApiError(e, "No se pudieron crear los campeonatos"));
    } finally {
      setLoading(false);
    }
  };

  const canApply =
    !!preview && (preview.toCreateCount > 0 || preview.dbDuplicateCount > 0);

  const applyLabel =
    preview && preview.dbDuplicateCount > 0 && preview.toCreateCount === 0
      ? `Limpiar ${preview.dbDuplicateCount} duplicado${preview.dbDuplicateCount !== 1 ? "s" : ""}`
      : `Aplicar (${preview?.toCreateCount ?? 0} nuevas${
          preview && preview.dbDuplicateCount > 0
            ? `, limpia ${preview.dbDuplicateCount} dup.`
            : ""
        })`;

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        {applyResult ? "Cerrar" : "Cancelar"}
      </Button>
      {!applyResult && (
        <Button type="button" onClick={() => void apply()} disabled={!canApply || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Aplicando…
            </>
          ) : (
            applyLabel
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
      titleId="calendar-import-title"
      footer={footer}
    >
      <TransferStepper step={step} />

      <FileDropZone
        kind="calendar"
        file={file}
        onFile={handleFile}
        disabled={loading}
        hint={copy.acceptedHint}
      />

      {loading && !preview && !applyResult ? (
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

      {applyResult ? (
        <TransferResultBanner variant="success" title="Calendario aplicado">
          {applyResult.dedupeRemoved > 0 && (
            <span>
              Se eliminaron {applyResult.dedupeRemoved} duplicado
              {applyResult.dedupeRemoved !== 1 ? "s" : ""} en la base de datos.{" "}
            </span>
          )}
          Se crearon {applyResult.created} competición
          {applyResult.created !== 1 ? "es" : ""}. Ya disponibles en el listado.
        </TransferResultBanner>
      ) : null}

      {preview && !applyResult ? (
        <div className="space-y-3 transfer-enter">
          <TransferPreviewStats
            items={[
              { label: "Año", value: preview.year },
              { label: "Detectadas", value: preview.totalDetected },
              { label: "Elegibles", value: preview.eligibleCount },
              { label: "Dup. PDF/BD", value: preview.duplicateCount, tone: "warning" },
              { label: "Dup. en BD", value: preview.dbDuplicateCount, tone: "warning" },
              { label: "A crear", value: preview.toCreateCount, tone: "success" },
            ]}
          />
          <TransferWarnings warnings={preview.warnings} />
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-subtle-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left">Fecha</th>
                  <th className="px-2 py-1.5 text-left">Tipo</th>
                  <th className="px-2 py-1.5 text-left">Nombre</th>
                  <th className="px-2 py-1.5 text-left">Localidad</th>
                  <th className="px-2 py-1.5 text-left">Zona</th>
                  <th className="px-2 py-1.5 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.entries.map((e, i) => (
                  <tr
                    key={i}
                    className="transfer-row-stagger border-t border-border"
                    style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}
                  >
                    <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {e.fechaInicio ?? "pendiente"}
                      {e.fechaFin && e.fechaFin !== e.fechaInicio && ` → ${e.fechaFin}`}
                    </td>
                    <td className="px-2 py-1.5 text-foreground">{e.tipo}</td>
                    <td className="px-2 py-1.5 text-foreground">{e.nombre}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{e.localidad}</td>
                    <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {e.zona ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-[10.5px]">
                      {e.pendiente ? (
                        <span className="rounded bg-warning-muted px-1.5 py-0.5 text-warning">
                          pendiente
                        </span>
                      ) : e.nuevo ? (
                        <span className="rounded bg-success-muted px-1.5 py-0.5 text-success">
                          nueva
                        </span>
                      ) : (
                        <span className="text-subtle-muted">duplicada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-subtle-muted">
            Al aplicar: primero se eliminan duplicados en BD (mismo nombre, fecha y tipo; se
            conserva el que más tarima tenga), luego se crean las {preview.toCreateCount} marcadas
            «nueva».
          </p>
        </div>
      ) : null}
    </TransferDialogShell>
  );
}
