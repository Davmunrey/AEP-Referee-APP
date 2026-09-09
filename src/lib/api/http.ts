import type { ApiError, ApiResult, ApiSuccess } from "./types";

/**
 * Lo que ve el usuario cuando la respuesta no trae el sobre `{ data }` /
 * `{ error }`: un 500 de Next sin cuerpo, un HTML de error de la plataforma,
 * una desconexión a medio JSON.
 *
 * Estos textos eran «Server error (500)», «Parse error (500)» y el
 * `statusText` de HTTP —«Internal Server Error»—: en inglés, en una aplicación
 * que está entera en castellano, y sin decir qué hacer a continuación. Es el
 * embudo por el que pasa cada pantalla, así que aparecían en cualquiera.
 */
function mensajeDeEstado(status: number): string {
  if (status === 401) return "Tu sesión ha caducado. Vuelve a entrar.";
  if (status === 403) return "No tienes permiso para esta acción.";
  if (status === 404) return "No se ha encontrado lo que pedías.";
  if (status === 413) return "El archivo es demasiado grande.";
  if (status === 429) return "Demasiadas peticiones. Espera unos segundos y reinténtalo.";
  if (status === 502 || status === 503 || status === 504) {
    return "El servidor no está disponible ahora mismo. Inténtalo de nuevo en un momento.";
  }
  if (status >= 500) return `El servidor no pudo completar la operación (${status}).`;
  return `La petición no se pudo completar (${status}).`;
}

export async function parseApiResponse<T>(res: Response): Promise<ApiResult<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      error: res.ok
        ? "El servidor respondió en un formato inesperado. Recarga la página."
        : mensajeDeEstado(res.status),
    };
  }
  let body: ApiSuccess<T> | ApiError;
  try {
    body = (await res.json()) as ApiSuccess<T> | ApiError;
  } catch {
    return { error: "No se pudo leer la respuesta del servidor. Inténtalo de nuevo." };
  }
  if (!res.ok) {
    // El sobre de error de la aplicación manda: lleva el motivo escrito para
    // esta situación concreta. Solo si no viene se cae en el genérico.
    if ("error" in body && typeof body.error === "string" && body.error.trim()) return body;
    return { error: mensajeDeEstado(res.status) };
  }
  return body as ApiSuccess<T>;
}
