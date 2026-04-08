import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/database";
import { logWarn } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/notifications/[id]/read" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;
      const { id: notificationId } = await params;

      // ----- 2. Rate limit -----

      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const allowed = await rateLimiter.check(
        `notification-read:${userId}:${ip}`,
        120,
        60_000,
      );

      if (!allowed) {
        logWarn("notification.read.rate_limited");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
      }

      // ----- 3. Mark as read -----

      const updated = await markNotificationRead(notificationId, userId);

      if (!updated) {
        // Could be: already read, wrong user, or doesn't exist.
        // Uniform response — no information leakage.
        return NextResponse.json(
          { success: false, message: "No change" },
          { status: 200 },
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    },
  );
}
