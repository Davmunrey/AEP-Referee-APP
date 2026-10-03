// Reporta un error del navegador a Sentry sin cargar el SDK por adelantado.
//
// `error.tsx` y `global-error.tsx` importaban `@sentry/nextjs` de forma
// estática, y eso metía el SDK entero —416 kB sin comprimir, 127 kB
// comprimidos, el mayor trozo compartido del build— en la primera carga de
// TODAS las páginas, haya o no DSN configurado. Así solo se descarga cuando
// hay un error que contar y un DSN al que contárselo.
export function reportClientError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      /* sin red o sin SDK: el error ya se ha mostrado; no hay más que hacer */
    });
}
