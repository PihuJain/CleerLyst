import { NextRequest, NextResponse } from "next/server";
import {
  getDatasetById,
  updateDatasetVisibilityConfig,
  insertAuditLog,
} from "@/lib/database";
import { logInfo } from "@/lib/logger";
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
// PATCH /api/admin/datasets/{id}/visibility
// ---------------------------------------------------------------------------
//
// Updates visibility_config for a DRAFT dataset.
//
// LIFECYCLE RULE: visibility_config is immutable after publish.
//   • Only datasets with status === "draft" can be updated.
//   • Published or revoked datasets return 403 "visibility_locked".
//   • Backend enforces this — never trust frontend state.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • Explicit column selection — no SELECT *.
//   • Does not log field names — only field count.
//   • Does not return visibility_config contents.
//
// ---------------------------------------------------------------------------

const MAX_FIELDS = 50;

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
  context: RouteContext,
) {
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Admin access required");

  const adminInstituteId = session.user.instituteId;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rlAllowed = await rateLimiter.check(
    `admin-visibility:${session.user.id}:${ip}`,
    30,
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
    throw forbidden("visibility_locked");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Invalid JSON body", "INVALID_JSON");
  }

  const bodyKeys = Object.keys(body);
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "allowed_fields") {
    throw badRequest(
      "Body must contain only { allowed_fields: string[] }",
      "INVALID_BODY_SHAPE",
    );
  }

  const { allowed_fields } = body;

  if (!Array.isArray(allowed_fields)) {
    throw badRequest("allowed_fields must be an array", "INVALID_ALLOWED_FIELDS");
  }

  const MAX_FIELD_NAME_LENGTH = 128;
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const field of allowed_fields) {
    if (typeof field !== "string") {
      throw badRequest(
        "Each field in allowed_fields must be a string",
        "INVALID_FIELD_TYPE",
      );
    }

    const trimmed = field.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.length > MAX_FIELD_NAME_LENGTH) {
      throw badRequest(
        `Field name exceeds maximum length of ${MAX_FIELD_NAME_LENGTH} characters`,
        "FIELD_NAME_TOO_LONG",
      );
    }

    if (seen.has(trimmed)) continue;
    seen.add(trimmed);

    if (trimmed === dataset.identifier_type) continue;

    cleaned.push(trimmed);
  }

  if (cleaned.length > MAX_FIELDS) {
    throw badRequest(`Maximum ${MAX_FIELDS} fields allowed`, "TOO_MANY_FIELDS");
  }

  await updateDatasetVisibilityConfig(datasetId, {
    allowed_fields: cleaned,
  });

  try {
    await insertAuditLog(
      session.user.id,
      "dataset.visibility_configured",
      datasetId,
      { allowedFieldsCount: cleaned.length },
    );
  } catch {
    // Audit failure must not break the response
  }

  logInfo("dataset.visibility.configured", {
    datasetId,
    allowedFieldsCount: cleaned.length,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const PATCH = withApiHandler(handler);
