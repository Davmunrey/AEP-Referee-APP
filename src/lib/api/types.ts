export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(res: ApiResult<T>): res is ApiError {
  return "error" in res;
}
