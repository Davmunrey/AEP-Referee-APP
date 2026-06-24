// Hook de instrumentación de Next.js. Carga la config de Sentry según el
// runtime y expone `onRequestError` para capturar errores de servidor (App
// Router). No-op si Sentry no tiene DSN configurado.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
