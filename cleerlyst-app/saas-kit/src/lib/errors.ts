// ---------------------------------------------------------------------------
// Centralized error taxonomy — Cleerlyst
// ---------------------------------------------------------------------------
//
// AppError distinguishes operational errors (bad input, auth failure, rate
// limit) from programming errors (null access, missing import). Only
// operational errors produce typed client-facing JSON; programming errors
// are logged with full stack and the client receives a generic 500.
//
// SECURITY INVARIANTS:
//   • Client NEVER sees raw stack traces, SQL errors, or internal details.
//   • Error codes are uppercase constants — safe for client display logic.
//   • isOperational = false triggers alerting-grade logging.
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Factory helpers — one per HTTP status family
// ---------------------------------------------------------------------------

export function badRequest(
  message = "Bad request",
  code = "BAD_REQUEST",
): AppError {
  return new AppError(message, 400, code);
}

export function unauthorized(
  message = "Authentication required",
  code = "UNAUTHORIZED",
): AppError {
  return new AppError(message, 401, code);
}

export function forbidden(
  message = "Access denied",
  code = "FORBIDDEN",
): AppError {
  return new AppError(message, 403, code);
}

export function notFound(
  message = "Not found",
  code = "NOT_FOUND",
): AppError {
  return new AppError(message, 404, code);
}

export function rateLimited(
  message = "Too many requests",
  code = "RATE_LIMITED",
): AppError {
  return new AppError(message, 429, code);
}

export function internalError(
  message = "Something went wrong",
  code = "INTERNAL_ERROR",
): AppError {
  return new AppError(message, 500, code, false);
}
