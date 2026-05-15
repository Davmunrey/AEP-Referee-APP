/** True cuando la app debe usar solo stack local (sin Vercel ni API externa). */
export function isLocalOnly(): boolean {
  return (
    process.env.NEXT_PUBLIC_RUN_LOCAL === "true" ||
    process.env.NODE_ENV === "development"
  );
}

export function getLocalApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LOCAL_API_URL?.replace(/\/$/, "") ??
    "http://localhost:3000/api/v1"
  );
}
