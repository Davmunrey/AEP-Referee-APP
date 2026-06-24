"use client";

// Captura de errores a nivel del layout raíz (los que `error.tsx` de segmento no
// puede atrapar). Reemplaza al layout, así que renderiza su propio html/body e
// importa los estilos globales. Reporta a Sentry (no-op sin DSN).
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Algo salió mal</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Se ha producido un error inesperado. Hemos registrado el incidente para revisarlo.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
