import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteUserIdentifier } from "@/lib/database";
import { logInfo, logWarn } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/identifiers/[type]" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        logWarn("identifier.delete.unauthorized");
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;
      const { type } = await params;

      // ----- 2. Validate type parameter -----

      if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
        return NextResponse.json(
          { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      // ----- 3. Delete identifier -----

      await deleteUserIdentifier(userId, type);

      // ----- 4. Audit log -----

      logInfo("identifier_removed", { userId, type });

      return NextResponse.json({ success: true }, { status: 200 });
    },
  );
}
