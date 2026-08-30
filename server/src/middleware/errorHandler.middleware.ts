import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.ts";
import env from "../utils/envHelper.ts";
import { ZodError } from "zod";

// `pg` errors are usually plain Error objects with an extra `code` field.
// We model only the small piece we care about for response translation.
type ErrorWithCode = Error & {
  code?: string;
};

const hasErrorCode = (error: unknown): error is ErrorWithCode => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
};

const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Start from the safest default:
  // unexpected errors should look like generic 500 responses.
  let statusCode: number = 500;
  let status: "fail" | "error" = "error";
  let message = `Something went wrong!`;
  let details:
    | Array<{ code: string; path: string[]; message: string }>
    | undefined;

  // Only real Error instances have a stack trace we can expose in development.
  const trace = err instanceof Error ? err.stack : undefined;

  if (err instanceof ZodError) {
    // Request validation failed before business logic or DB work succeeded.
    // This is a client error, so return 400 and surface the validation messages.
    statusCode = 400;
    status = "fail";
    message = err.issues.map((issue) => issue.message).join(", ");
    details = err.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(String),
      message: issue.message,
    }));
  } else if (err instanceof AppError) {
    // `AppError` is our intentional application-level error type.
    // For operational errors like 400/401/403/404 we keep the message.
    // For non-operational/internal errors we avoid leaking internals.
    statusCode = err.statusCode || 500;
    status = err.status || "error";
    message = err.isOperational ? err.message : "Something went wrong!";
  } else if (hasErrorCode(err)) {
    // Database errors arrive here without each controller needing a local try/catch.
    // This keeps controllers focused on happy-path logic and lets the middleware
    // convert common PostgreSQL constraint failures into HTTP-friendly responses.
    switch (err.code) {
      case "22001":
        // String value too long for the target column, e.g. VARCHAR(255).
        statusCode = 400;
        status = "fail";
        message = "One of the fields is longer than the database allows.";
        break;
      case "22P02":
        // Invalid text representation, often bad type input.
        statusCode = 400;
        status = "fail";
        message = "Invalid input format.";
        break;
      case "23503":
        // Foreign key violation.
        statusCode = 409;
        status = "fail";
        message = "Referenced record does not exist.";
        break;
      case "23505":
        // Unique constraint violation.
        statusCode = 409;
        status = "fail";
        message = "Record already exists.";
        break;
      case "23514":
        // Check constraint violation.
        statusCode = 400;
        status = "fail";
        message = "Input violates a database rule.";
        break;
    }
  }

  return res.status(statusCode).json({
    success: false,
    status,
    message,
    ...(details && { details }),
    // Stack traces are useful while developing, but they should stay out of
    // production responses because they leak implementation details.
    ...(env.NODE_ENV === "development" && trace && { trace }),
  });
};

export { errorHandler };
