import { NextRequest, NextResponse } from "next/server";
import { deleteUserIdentifier } from "@/lib/database";
import { logInfo } from "@/lib/logger";
import {
  withApiHandler,
  type HandlerSession,
  type RouteContext,
} from "@/lib/api-handler";
import { unauthorized, badRequest, rateLimited } from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// DELETE /api/me/identifiers/{type}
// ---------------------------------------------------------------------------
//
// Removes the authenticated user's identifier of the given type.
//
// Idempotent — returns { success: true } even if no row existed.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • Only allowed types: "reg_no", "roll_no".
//   • DELETE scoped to (user_id, type) — no wildcard deletes.
//   • Identifier value is NEVER logged or returned.
//   • Identifier hash is NEVER logged or returned.
//   • No plaintext exposure in any code path.
//
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ["reg_no", "roll_no"] as const;

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
  context: RouteContext,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `identifier-delete:${userId}:${ip}`,
    10,
    60_000,
  );
  if (!allowed) throw rateLimited();

  const { type } = await context.params;

  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    throw badRequest(
      `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      "INVALID_IDENTIFIER_TYPE",
    );
  }

  await deleteUserIdentifier(userId, type);

  logInfo("identifier_removed", { userId, type });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withApiHandler(handler);
