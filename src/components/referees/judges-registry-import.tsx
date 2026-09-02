"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  canApplyPreview,
  TRANSFER_KIND_COPY,
  type TransferStep,
} from "@/lib/import-export-ui";
import type { JudgesRegistryImportPreview, JudgesRegistryImportResult } from "@/lib/types";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface JudgesRegistryImportProps {
  open: boolean;
  onClose: () => void;
}

export function JudgesRegistryImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Importar Excel maestro
      </Button>
      <JudgesRegistryImportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function JudgesRegistryImportDialog({ open, onClose }: JudgesRegistryImportProps) {
  const router = useRouter();
  const copy = TRANSFER_KIND_COPY.judges;
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<JudgesRegistryImportPreview | null>(null);
  const [result, setResult] = useState<JudgesRegistryImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setReplace(false);
      setPreview(null);
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const step: TransferStep = result ? "result" : preview ? "preview" : "upload";

  // Marcar y desmarcar «reemplazar» (o elegir otro fichero) mientras hay una
  // previsualización en vuelo lanzaba dos peticiones: si ganaba la lenta, el
  // resumen mostrado correspondía a la otra opción y «Importar» acababa
  // aplicando un borrado completo que el usuario nunca vio previsualizado. Solo
  // se atiende la respuesta de la última petición emitida.
  const previewSeq = useRef(0);

  const runPreview = async (selected: File, replaceFlag: boolean) => {
    const seq = ++previewSeq.current;
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await api.importJudgesRegistry(selected, { replace: replaceFlag, apply: false });
      if (seq !== previewSeq.current) return;
      setPreview(res.preview);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setError(formatApiError(e, "Error al leer el Excel"));
    } finally {
      if (seq === previewSeq.current) setLoading(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    void runPreview(f, replace);
  };

  const handleReplaceChange = (checked: boolean) => {
    setReplace(checked);
    if (file) void runPreview(file, checked);
  };

  const apply = async () => {
    if (!file || !preview) return;
    previewSeq.current += 1;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importJudgesRegistry(file, { replace, apply: true });
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(formatApiError(e, "Error al importar"));
    } finally {
      setLoading(false);
    }
  };

  const canApply = !!preview && canApplyPreview(preview) && !result;

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        {result ? "Cerrar" : "Cancelar"}
      </Button>
      {!result && (
        <Button type="button" disabled={!canApply || loading} onClick={() => void apply()}>
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
      titleId="judges-import-title"
      footer={footer}
      maxWidthClass="max-w-3xl"
    >
      <TransferStepper step={step} />

      <FileDropZone
        kind="judges"
        file={file}
        onFile={handleFile}
        disabled={loading || !!result}
        hint={copy.acceptedHint}
      />

      <label className="flex items-start gap-2 text-sm text-foreground-secondary">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => handleReplaceChange(e.target.checked)}
          disabled={loading || !!result}
          className="mt-1 h-4 w-4 rounded border-border-strong accent-primary"
        />
        <span>
          Reemplazar el censo: elimina los jueces que ya no estén en este Excel y
          reimporta el resto. <strong>No borra campeonatos ni cuadrantes</strong>, y
          conserva a los jueces ya asignados en alguna tarima.
        </span>
      </label>

      {loading && !preview && !result ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando Excel…
        </div>
      ) : null}

      {error ? (
        <TransferResultBanner variant="error" title="No se pudo importar">
          {error}
        </TransferResultBanner>
      ) : null}

      {preview && !result ? (
        <div className="space-y-3 transfer-enter">
          <TransferPreviewStats
            items={[
              { label: "Jueces", value: preview.refereeCount, tone: "success" },
              { label: "Campeonatos", value: preview.competitionCount },
              { label: "Archivo", value: preview.filename },
            ]}
          />
          <TransferWarnings warnings={preview.warnings} />
          {preview.sampleReferees.length > 0 ? (
            <div className="transfer-preview-scroll rounded-md border border-border">
              <table className="transfer-preview-table w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Nombre</th>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Nivel</th>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Zona</th>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Localidad</th>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Género</th>
                    <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Tel.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleReferees.map((r, i) => (
                    <tr
                      key={`${r.nombre}-${i}`}
                      className="transfer-row-stagger border-t border-border"
                      style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}
                    >
                      <td className="px-2 py-1.5 text-foreground">{r.nombre}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.nivel}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.zona}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.localidad ?? "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.genero ?? "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.telefono ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {preview.replaceRequested ? (
            <p className="rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning">
              Al confirmar se eliminarán los jueces que no estén en este Excel (salvo
              los ya asignados en tarima). Los campeonatos y cuadrantes no se tocan.
            </p>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <TransferResultBanner variant="success" title="Importación completada">
          <p>
            Jueces: {result.refereesCreated ?? 0} nuevos, {result.refereesUpdated ?? 0} actualizados
            {(result.refereesSkipped ?? 0) > 0 ? `, ${result.refereesSkipped} omitidos` : ""}.
          </p>
          <p className="mt-1">
            Campeonatos: {result.competitionsCreated ?? 0} nuevos
            {(result.competitionsSkipped ?? 0) > 0
              ? `, ${result.competitionsSkipped} duplicados omitidos`
              : ""}
            .
          </p>
          {(result.warnings?.length ?? 0) > 0 ? (
            <p className="mt-2 text-xs opacity-90">{result.warnings!.length} avisos de parseo.</p>
          ) : null}
        </TransferResultBanner>
      ) : null}
    </TransferDialogShell>
  );
}
