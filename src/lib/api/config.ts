import { getLocalApiBaseUrl, isLocalOnly } from "@/lib/runtime";

/**
 * Ruta relativa de la API, para lo que acaba dentro de un atributo del HTML
 * (`href`, `src`, `action`).
 *
 * `getApiBaseUrl()` da una URL absoluta distinta en el servidor y en el
 * navegador (allí `window.location.origin`; aquí la variable de entorno).
 * React no repara los atributos que no cuadran al hidratar, así que el enlace
 * se quedaba con el valor del servidor: en local, el puerto equivocado; en un
 * despliegue sin `NEXT_PUBLIC_API_URL`, un `http://localhost:3000` servido a
 * todo el mundo. Relativa vale para las dos partes y siempre apunta al origen
 * desde el que se abrió la página.
 */
export const API_BASE_PATH = "/api/v1";

/** Base URL de la API (sin barra final). En local usa siempre localhost. */
export function getApiBaseUrl(): string {
  if (isLocalOnly()) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/v1`;
    }
    return getLocalApiBaseUrl();
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }

  return getLocalApiBaseUrl();
}
