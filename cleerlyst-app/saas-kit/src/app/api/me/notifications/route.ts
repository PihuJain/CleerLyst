import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotificationsForUser } from "@/lib/database";
import { logWarn } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/me/notifications
// ---------------------------------------------------------------------------
//
// Returns the authenticated user's notifications — most recent first.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • Scoped to user_id from session — no cross-user access.
//   • No payload content. No student data. No record references.
//   • Only safe fields: id, dataset_id, dataset_title, type, read_at, created_at.
//   • Rate-limited per userId (sliding window).
//
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/notifications" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;

      // ----- 2. Rate limit -----

      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const allowed = await rateLimiter.check(
        `notifications:${userId}:${ip}`,
        60,
        60_000,
      );

      if (!allowed) {
        logWarn("notifications.rate_limited");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
      }

      // ----- 3. Fetch notifications -----

      const notifications = await getNotificationsForUser(userId);

      // ----- 4. Serialize dates and return -----

      const result = notifications.map((n) => ({
        id: n.id,
        dataset_id: n.dataset_id,
        dataset_title: n.dataset_title,
        type: n.type,
        read_at: n.read_at ? n.read_at.toISOString() : null,
        created_at: n.created_at.toISOString(),
      }));

      const response = NextResponse.json(result, { status: 200 });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    },
  );
}
