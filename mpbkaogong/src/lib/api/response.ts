import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MEMBERSHIP_REQUIRED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function apiOk<T>(data: T) {
  return NextResponse.json({
    ok: true,
    data,
    error: null,
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details: unknown = null
) {
  return NextResponse.json(
    {
      ok: false,
      data: null,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}
