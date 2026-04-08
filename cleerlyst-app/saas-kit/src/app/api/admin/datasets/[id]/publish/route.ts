import { NextRequest, NextResponse } from "next/server";
import { getDatasetById, publishDataset } from "@/lib/database";
import { config } from "@/lib/config";
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
// POST /api/admin/datasets/{id}/publish
// ---------------------------------------------------------------------------
//
// Transitions a dataset from draft → published.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • institute_id is NEVER included in the response.
//   • No counts, no user lists, no notifications.
//   • No row-level or record-level data.
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
    `admin-publish:${adminUserId}:${ip}`,
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

  if (dataset.status !== "draft") {
    throw badRequest(
      "Only draft datasets can be published",
      "DATASET_NOT_DRAFT",
    );
  }

  const headers = Array.isArray(dataset.headers)
    ? (dataset.headers as string[])
    : [];

  if (headers.length === 0) {
    throw badRequest("no_records_uploaded", "NO_RECORDS_UPLOADED");
  }

  const visConfig = dataset.visibility_config as {
    allowed_fields?: string[];
  } | null;

  const allowedFields = visConfig?.allowed_fields;

  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw badRequest(
      "no_visible_fields_selected",
      "NO_VISIBLE_FIELDS_SELECTED",
    );
  }

  let result: { id: string; title: string; published_at: Date };
  try {
    result = await publishDataset(datasetId, adminUserId, dataset.institute_id);
  } catch (err) {
    logError("dataset.publish.error", { datasetId }, err);
    throw badRequest(
      err instanceof Error ? err.message : "Publish failed",
      "PUBLISH_FAILED",
    );
  }

  logInfo("dataset.publish.success", {
    datasetId,
    allowedFieldsCount: allowedFields.length,
  });

  return NextResponse.json({
    success: true,
    dataset_id: result.id,
    title: result.title,
    published_at: result.published_at.toISOString(),
    universal_link: `${config.baseUrl}/datasets/${result.id}`,
  });
}

export const POST = withApiHandler(handler);
