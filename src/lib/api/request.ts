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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const parsed = await parseApiResponse<T>(res);
  if (isApiError(parsed)) {
    throw new ApiRequestError(parsed.error, res.status);
  }
  return parsed.data;
}
