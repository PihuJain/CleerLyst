import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
} from "@/lib/database";
import { withApiHandler, type HandlerSession } from "@/lib/api-handler";
import { unauthorized, rateLimited } from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/me/notifications
// ---------------------------------------------------------------------------
//
// Returns the authenticated user's notifications — most recent first.
//
// Query params:
//   ?unread=true → returns { count: number } instead of full list.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • Scoped to user_id from session — no cross-user access.
//   • No payload content. No student data. No record references.
//   • Only safe fields: id, dataset_id, dataset_title, type, is_read, created_at.
//   • user_id is NEVER returned.
//   • Rate-limited per userId (sliding window).
//
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `notifications:${userId}:${ip}`,
    60,
    60_000,
  );
  if (!allowed) throw rateLimited();

  const unreadOnly =
    request.nextUrl.searchParams.get("unread") === "true";

  if (unreadOnly) {
    const count = await getUnreadNotificationCount(userId);
    const response = NextResponse.json({ count }, { status: 200 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const notifications = await getNotificationsForUser(userId);

  const result = notifications.map((n) => ({
    id: n.id,
    dataset_id: n.dataset_id,
    dataset_title: n.dataset_title,
    type: n.type,
    is_read: n.read_at !== null,
    created_at: n.created_at.toISOString(),
  }));

  const response = NextResponse.json(result, { status: 200 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const GET = withApiHandler(handler);
