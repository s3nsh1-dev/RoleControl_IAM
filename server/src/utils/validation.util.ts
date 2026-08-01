import { z } from "zod";
import { AppError } from "./AppError.ts";

const parsePositiveInt = (value: unknown, fieldName = "id") => {
  const parsed = z.coerce.number().int().positive().safeParse(value);

  if (!parsed.success) {
    throw AppError.badRequest(`${fieldName} must be a positive integer.`);
  }

  return parsed.data;
};

const parseEmail = (value: unknown, fieldName = "email") => {
  const parsed = z.string().trim().email().safeParse(value);

  if (!parsed.success) {
    throw AppError.badRequest(`${fieldName} must be a valid email.`);
  }

  return parsed.data.toLowerCase();
};

const parsePaginationQuery = (query: Record<string, unknown>) => {
  const parsed = z
    .object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
    })
    .safeParse(query);

  if (!parsed.success) {
    throw AppError.badRequest("Pagination query must use positive page and pageSize values.");
  }

  const { page, pageSize } = parsed.data;
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
};

const makePaginationMeta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

export { parseEmail, parsePositiveInt, parsePaginationQuery, makePaginationMeta };
