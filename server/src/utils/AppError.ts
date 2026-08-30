class AppError extends Error {
  public override readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly status: "fail" | "error";

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? "error" : "fail";
    this.isOperational = isOperational;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad Request") {
    return new AppError(400, message);
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(403, message);
  }

  static notFound(message = "Not Found") {
    return new AppError(404, message);
  }

  static internal(message = "Internal Server Error") {
    return new AppError(500, message, false);
  }
  static tooManyRequests(message = "Too many requests") {
    return new AppError(429, message);
  }
}

export { AppError };

export type AppErrorType = {
  statusCode: number;
  message: string;
  status: "fail" | "error";
  isOperational: boolean;
};
