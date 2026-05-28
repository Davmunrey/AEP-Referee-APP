import type { ApiError, ApiResult, ApiSuccess } from "./types";

export async function parseApiResponse<T>(res: Response): Promise<ApiResult<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: res.ok ? "Unexpected response format" : `Server error (${res.status})` };
  }
  let body: ApiSuccess<T> | ApiError;
  try {
    body = (await res.json()) as ApiSuccess<T> | ApiError;
  } catch {
    return { error: `Parse error (${res.status})` };
  }
  if (!res.ok) {
    return "error" in body ? body : { error: res.statusText };
  }
  return body as ApiSuccess<T>;
}
