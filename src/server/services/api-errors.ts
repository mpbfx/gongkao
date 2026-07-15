import { ZodError } from "zod";

import { apiError } from "@/lib/api/response";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guards";
import {
  BadRequestError,
  BusinessError,
  ConflictError,
  MembershipRequiredError,
  NotFoundError,
  ServiceUnavailableError,
} from "@/server/services/errors";

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function apiErrorFromUnknown(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "参数校验失败", 400, formatZodError(error));
  }

  if (error instanceof BadRequestError) {
    return apiError("BAD_REQUEST", error.message, 400, error.details);
  }

  if (error instanceof UnauthorizedError) {
    return apiError("UNAUTHORIZED", error.message, 401);
  }

  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", error.message, 403);
  }

  if (error instanceof MembershipRequiredError) {
    return apiError("MEMBERSHIP_REQUIRED", error.message, 403);
  }

  if (error instanceof NotFoundError) {
    return apiError("NOT_FOUND", error.message, 404);
  }

  if (error instanceof ConflictError) {
    return apiError("CONFLICT", error.message, 409);
  }

  if (error instanceof BusinessError) {
    return apiError("BUSINESS_ERROR", error.message, 422, error.details);
  }

  if (error instanceof ServiceUnavailableError) {
    return apiError("SERVICE_UNAVAILABLE", error.message, 503, error.details);
  }

  console.error(error);
  return apiError("INTERNAL_ERROR", "服务暂时不可用", 500);
}
