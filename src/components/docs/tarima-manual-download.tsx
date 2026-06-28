"use client";

import { useState, useTransition } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { tarimaUserGuideFilename } from "@/lib/guides/tarima-user-guide-filename";

interface TarimaManualDownloadButtonProps {
  className?: string;
  label?: string;
}

const MANUAL_API_PATH = "/api/v1/guides/tarima-manual";

export function TarimaManualDownloadButton({
  className,
  label = "Descargar manual PDF (gestión de jueces)",
}: TarimaManualDownloadButtonProps) {
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
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onDownload}
        disabled={pending}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
        {pending ? "Generando PDF…" : label}
      </button>
      {error ? (
        <p role="alert" className="max-w-md text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
