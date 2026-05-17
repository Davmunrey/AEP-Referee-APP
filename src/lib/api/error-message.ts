/** Mensaje legible para errores de `fetch` / API client. */
export function formatApiError(err: unknown, fallback = "Error inesperado"): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}
