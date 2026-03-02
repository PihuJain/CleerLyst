import { NextRequest, NextResponse } from "next/server";
import { getDatasetById, revokeDataset } from "@/lib/database";
import { logInfo, logError } from "@/lib/logger";
import {
  withApiHandler,
  type HandlerSession,
  type RouteContext,
} from "@/lib/api-handler";
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  rateLimited,
  internalError,
} from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/{id}/revoke
// ---------------------------------------------------------------------------
//
// Transitions a dataset to 'revoked' status.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • institute_id is NEVER included in the response.
//   • title is NEVER included in the response.
//   • published_at is NEVER mutated or returned.
//   • No record counts, no user lists, no notifications.
//   • No record deletion — dataset_records are untouched.
//
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
  context: RouteContext,
) {
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Admin access required");

  const adminUserId = session.user.id;
  const adminInstituteId = session.user.instituteId;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rlAllowed = await rateLimiter.check(
    `admin-revoke:${adminUserId}:${ip}`,
    20,
    60_000,
  );
  if (!rlAllowed) throw rateLimited();

  const { id: datasetId } = await context.params;

  const dataset = await getDatasetById(datasetId);
  if (!dataset) throw notFound("Dataset not found");

  if (dataset.institute_id !== adminInstituteId) {
    throw forbidden("Dataset does not belong to your institute");
  }

  if (dataset.status !== "published") {
    throw badRequest(
      "cannot_revoke_non_published_dataset",
      "CANNOT_REVOKE_NON_PUBLISHED",
    );
  }

  let result: { id: string; status: string };
  try {
    result = await revokeDataset(datasetId, adminUserId);
  } catch (err) {
    logError("dataset.revoke.error", { datasetId }, err);
    throw badRequest(
      err instanceof Error ? err.message : "Revoke failed",
      "REVOKE_FAILED",
    );
  }

  logInfo("dataset.revoke.success", { datasetId });

  return NextResponse.json({
    success: true,
    dataset_id: result.id,
    status: result.status,
  });
}

export const POST = withApiHandler(handler);
