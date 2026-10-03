"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold text-foreground">Algo salió mal</h2>
      {/* No el texto crudo del error: en producción Next lo sustituye por un
          aviso genérico en inglés, y en el navegador puede ser un mensaje
          técnico. El mismo texto que `global-error.tsx`, y la referencia para
          poder buscarlo en los registros. */}
      <p className="max-w-sm text-sm text-muted-foreground">
        Se ha producido un error inesperado. Hemos registrado el incidente para revisarlo.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-subtle-muted">Referencia: {error.digest}</p>
      )}
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
