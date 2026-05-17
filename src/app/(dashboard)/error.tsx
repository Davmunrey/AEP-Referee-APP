"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive-muted">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Algo ha fallado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ha ocurrido un error al cargar el panel. Por favor, inténtalo de nuevo.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-muted-foreground/40">
            ref: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Reintentar
      </button>
    </div>
  );
}
