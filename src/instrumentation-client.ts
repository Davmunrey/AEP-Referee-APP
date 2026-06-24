// Inicialización de Sentry en el navegador. El DSN debe ser público
// (NEXT_PUBLIC_) para inlinearse en el bundle. No-op si no está configurado.
// Sin Session Replay a propósito: evitamos capturar pantallas con datos
// personales de jueces.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
