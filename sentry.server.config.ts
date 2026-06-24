// Inicialización de Sentry en el runtime de servidor (Node.js).
// Se importa desde `src/instrumentation.ts`. Es un no-op completo si no hay DSN,
// así que en local/CI sin configurar Sentry no envía nada ni afecta al build.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  // No enviar datos personales por defecto: tratamos PII de jueces.
  sendDefaultPii: false,
});
