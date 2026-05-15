import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "./types";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  const body: ApiSuccess<T> = { data };
  return NextResponse.json(body, init);
}

export function jsonError(error: string, status = 400, details?: unknown) {
  const body: ApiError = { error, details };
  return NextResponse.json(body, { status });
}
