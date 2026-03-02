import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Centralized API route wrapper — Cleerlyst
// ---------------------------------------------------------------------------
//
// Every API route should export through this wrapper instead of raw
// async functions. It guarantees:
//
//   1. Structured request context (requestId, actorUserId, route)
//   2. Uniform JSON error shape for ALL failures
//   3. Operational errors (AppError) logged at warn/error level
//   4. Programming errors logged with full stack, generic 500 to client
//   5. Zero raw stack traces, SQL errors, or internals leaked
//
// SECURITY INVARIANTS:
//   • Client response NEVER contains stack traces or internal details.
//   • Unknown errors always return generic "Something went wrong."
//   • isOperational=false triggers error-level logging (alerting-grade).
//
// Usage:
//   async function handler(req: NextRequest, session, ctx) { ... }
//   export const GET = withApiHandler(handler);
//
// ---------------------------------------------------------------------------

interface HandlerSession {
  user: {
    id: string;
    role: "student" | "admin";
    instituteId: string;
    name?: string | null;
    image?: string | null;
  };
}

type RouteContext = { params: Promise<Record<string, string>> };

type ApiHandler = (
  request: NextRequest,
  session: HandlerSession | null,
  context?: RouteContext,
) => Promise<NextResponse>;

export function withApiHandler(handler: ApiHandler) {
  return async (
    request: NextRequest,
    routeContext?: RouteContext,
  ): Promise<NextResponse> => {
    const requestId =
      request.headers.get("x-request-id") ?? crypto.randomUUID();
    const route = request.nextUrl.pathname;

    const session = await auth();
    const actorUserId = session?.user?.id ?? null;

    return runWithRequestContext(
      { requestId, actorUserId, route },
      async () => {
        try {
          return await handler(
            request,
            session as HandlerSession | null,
            routeContext,
          );
        } catch (err) {
          if (err instanceof AppError) {
            const meta = {
              statusCode: err.statusCode,
              code: err.code,
              method: request.method,
              url: request.nextUrl.pathname,
            };

            if (err.statusCode >= 500 || !err.isOperational) {
              logError("api.error", meta, err);
            } else {
              logWarn("api.client_error", meta);
            }

            return NextResponse.json(
              { error: { message: err.message, code: err.code } },
              { status: err.statusCode },
            );
          }

          logError(
            "api.unhandled_error",
            {
              method: request.method,
              url: request.nextUrl.pathname,
            },
            err,
          );

          return NextResponse.json(
            {
              error: {
                message: "Something went wrong.",
                code: "INTERNAL_ERROR",
              },
            },
            { status: 500 },
          );
        }
      },
    );
  };
}
