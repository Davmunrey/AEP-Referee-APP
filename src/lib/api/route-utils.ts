import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "./types";

export const API_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const;

function withNoStore(init?: ResponseInit): ResponseInit {
  return {
    ...init,
    headers: {
      ...API_NO_STORE_HEADERS,
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  const body: ApiSuccess<T> = { data };
  return NextResponse.json(body, withNoStore(init));
}

export function jsonError(error: string, status = 400, details?: unknown) {
  const body: ApiError = { error, details };
  return NextResponse.json(body, withNoStore({ status }));
}
