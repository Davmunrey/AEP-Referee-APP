// Inicialización de Sentry en el navegador. El DSN debe ser público
// (NEXT_PUBLIC_) para inlinearse en el bundle. No-op si no está configurado.
// Sin Session Replay a propósito: evitamos capturar pantallas con datos
// personales de jueces.
//
// El SDK se carga DIFERIDO y solo si hay DSN. Importado de forma estática iba
// en la primera carga de todas las páginas (127 kB comprimidos, el mayor trozo
// compartido del build) incluso sin DSN, es decir, sin hacer nada. Lo que se
// pierde es solo lo que pase en los milisegundos antes de que termine de
// cargar, y la página ya no espera por él para ser interactiva.
type SentryModule = typeof import("@sentry/nextjs");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentry: SentryModule | null = null;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      sendDefaultPii: false,
    });
    sentry = Sentry;
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
): void {
  sentry?.captureRouterTransitionStart(...args);
}
