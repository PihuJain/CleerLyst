import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/database";
import {
  withApiHandler,
  type HandlerSession,
  type RouteContext,
} from "@/lib/api-handler";
import { unauthorized, rateLimited } from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// PATCH /api/me/notifications/{id}/read
// ---------------------------------------------------------------------------
//
// Marks a single notification as read for the authenticated user.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • User_id is enforced in the WHERE clause — no cross-user mutation.
//   • Only sets read_at — no other columns are modified.
//   • No payload content in request or response.
//   • Rate-limited per userId.
//
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
  context: RouteContext,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;

  const { id: notificationId } = await context.params;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `notification-read:${userId}:${ip}`,
    120,
    60_000,
  );
  if (!allowed) throw rateLimited();

  const updated = await markNotificationRead(notificationId, userId);

  if (!updated) {
    return NextResponse.json(
      { success: false, message: "No change" },
      { status: 200 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export const PATCH = withApiHandler(handler);
