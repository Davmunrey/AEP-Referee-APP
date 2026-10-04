"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en la consola del navegador; los del servidor, en los registros
    // de Vercel con la referencia (digest) que se muestra abajo.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
      {/* No el texto crudo del error: en producción Next lo sustituye por un
          aviso genérico en inglés, y en el navegador puede ser un mensaje
          técnico. El mismo texto que `global-error.tsx`, y la referencia para
          poder buscarlo en los registros. */}
      <p className="max-w-sm text-sm text-muted-foreground">
        Se ha producido un error inesperado. Prueba de nuevo; si se repite, avisa al Comité de Jueces con la referencia.
      </p>
      {error.digest && (
        <p className="text-xs text-subtle-muted">Referencia: {error.digest}</p>
      )}
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
