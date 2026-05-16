import { z } from "zod";

export function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim().length === 0 ? undefined : value;
}

export const paginationQuerySchema = z.object({
  page: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).max(100).default(20)),
});

export function getPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
