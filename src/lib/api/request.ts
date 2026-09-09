import { getApiBaseUrl } from "./config";
import { parseApiResponse } from "./http";
import { isApiError } from "./types";

/**
 * Error de la API que conserva el código HTTP.
 *
 * Sigue siendo un `Error` con el mensaje del servidor, así que `formatApiError`
 * y todos los `catch` existentes funcionan igual; quien necesite distinguir un
 * conflicto (409) de un dato mal enviado (400) puede mirar `status`.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/**
 * Cuando `fetch` no llega a hablar con el servidor —wifi caída, el móvil en el
 * ascensor, la pestaña que se despierta— rechaza con un `TypeError` cuyo texto
 * lo escribe el navegador: «Failed to fetch» en Chrome, «NetworkError when
 * attempting to fetch resource» en Firefox, «Load failed» en Safari.
 *
 * `formatApiError` devuelve ese mensaje tal cual, así que era lo que veía el
 * usuario: tres frases distintas, en inglés, en una aplicación que está entera
 * en castellano, y ninguna dice lo único que importa —que no ha llegado a
 * salir, y que puede volver a intentarlo—. La pantalla de acceso ya lo
 * traducía por su cuenta; era la única.
 *
 * Status 0: no hubo respuesta, así que no hay código HTTP que dar.
 */
const SIN_CONEXION = "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (err) {
    // Una petición cancelada a propósito no es un fallo que contarle a nadie:
    // se deja pasar tal cual para que quien la cancela pueda reconocerla.
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) throw err;
    throw new ApiRequestError(SIN_CONEXION, 0);
  }
  const parsed = await parseApiResponse<T>(res);
  if (isApiError(parsed)) {
    throw new ApiRequestError(parsed.error, res.status);
  }
  return parsed.data;
}
