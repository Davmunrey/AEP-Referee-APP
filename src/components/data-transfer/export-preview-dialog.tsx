"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/api/error-message";
import {
  TRANSFER_KIND_COPY,
  downloadBlob,
  truncateTextPreview,
  type TransferKind,
} from "@/lib/import-export-ui";
import { Copy, Download, Loader2 } from "lucide-react";
import { TransferDialogShell } from "./transfer-dialog-shell";
import { TransferPreviewStats, type TransferStatItem } from "./transfer-preview-stats";
import { TransferResultBanner } from "./transfer-result-banner";

export interface ExportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  kind: Extract<TransferKind, "roster_export" | "analytics_export">;
  fetchText: () => Promise<string>;
  filename: string;
  mime: string;
  summaryStats?: TransferStatItem[];
}

export function ExportPreviewDialog({
  open,
  onClose,
  kind,
  fetchText,
  filename,
  mime,
  summaryStats,
}: ExportPreviewDialogProps) {
  const copy = TRANSFER_KIND_COPY[kind];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setText(null);
      setError(null);
      setCopied(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const body = await fetchText();
        if (!cancelled) setText(body);
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, "No se pudo generar la exportación"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchText]);

  const truncatedPreview = text ? truncateTextPreview(text) : null;

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
      {kind === "roster_export" && text ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {copied ? "Copiado" : "Copiar"}
        </Button>
      ) : null}
      <Button
        type="button"
        disabled={!text || loading}
        onClick={() => {
          if (!text) return;
          downloadBlob(text, filename, mime);
        }}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {copy.applyCta}
      </Button>
    </div>
  );

  return (
    <TransferDialogShell
      open={open}
      onClose={onClose}
      title={copy.title}
      subtitle={copy.subtitle}
      titleId={`${kind}-export-title`}
      footer={footer}
      maxWidthClass="max-w-2xl"
    >
      {summaryStats && summaryStats.length > 0 ? (
        <TransferPreviewStats items={summaryStats} />
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Generando vista previa…
        </div>
      ) : null}

      {error ? (
        <TransferResultBanner variant="error" title="Error al exportar">
          {error}
        </TransferResultBanner>
      ) : null}

      {truncatedPreview && !loading ? (
        <div className="space-y-2">
          <pre className="max-h-72 overflow-auto rounded-lg border border-border-muted bg-surface/80 p-3 font-mono text-[11px] leading-relaxed text-foreground-secondary whitespace-pre-wrap">
            {truncatedPreview.preview}
          </pre>
          {truncatedPreview.truncated ? (
            <p className="text-xs text-subtle-muted">
              Vista previa: primeras {40} de {truncatedPreview.totalLines} líneas. La descarga
              incluye el archivo completo.
            </p>
          ) : null}
        </div>
      ) : null}
    </TransferDialogShell>
  );
}
