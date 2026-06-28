"use client";

import { useState, useTransition } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TARIMA_GUIDE_META } from "@/lib/guides/tarima-user-guide-content";
import { tarimaUserGuideFilename } from "@/lib/guides/tarima-user-guide-filename";
import { cn } from "@/lib/utils";

interface TarimaManualDownloadButtonProps {
  className?: string;
}

const MANUAL_API_PATH = "/api/v1/guides/tarima-manual";

export function TarimaManualDownloadButton({ className }: TarimaManualDownloadButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onDownload = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${MANUAL_API_PATH}?v=${encodeURIComponent(Date.now().toString())}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Inicia sesión para descargar el manual.");
          }
          const body = await res.text().catch(() => "");
          let message = "No se pudo generar el PDF.";
          try {
            const json = JSON.parse(body) as { error?: string };
            if (json.error) message = json.error;
          } catch {
            if (body.trim()) message = body.trim();
          }
          throw new Error(message);
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("pdf")) {
          throw new Error("La respuesta del servidor no es un PDF válido.");
        }

        const blob = await res.blob();
        if (blob.size < 1000) {
          throw new Error("El PDF generado está vacío o es demasiado pequeño.");
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = tarimaUserGuideFilename();
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al descargar el manual");
      }
    });
  };

  return (
    <div className={cn("mx-auto w-full max-w-md", className)}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm">
        <div className="h-1 bg-primary" aria-hidden="true" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle-muted">
                Manual PDF
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground">
                Gestión de jueces AEP Tarima
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Guía paso a paso con capturas de pantalla. Versión {TARIMA_GUIDE_META.guideVersion} ·{" "}
                {TARIMA_GUIDE_META.updatedAt}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={onDownload}
            disabled={pending}
            size="lg"
            className="mt-4 w-full gap-2 rounded-xl"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? "Generando PDF…" : "Descargar manual PDF"}
          </Button>

          <p className="mt-2 text-center text-[11px] text-subtle-muted">
            {tarimaUserGuideFilename()}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
