import type { ApiError, ApiResult, ApiSuccess } from "./types";

export async function parseApiResponse<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await res.json()) as ApiSuccess<T> | ApiError;
  if (!res.ok) {
    return "error" in body ? body : { error: res.statusText };
  }
  return body as ApiSuccess<T>;
}
