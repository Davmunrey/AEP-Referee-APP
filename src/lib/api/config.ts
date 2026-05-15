import { getLocalApiBaseUrl, isLocalOnly } from "@/lib/runtime";

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
