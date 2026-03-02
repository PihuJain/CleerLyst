import { NextRequest, NextResponse } from "next/server";
import { createDataset } from "@/lib/database";
import { logInfo, logError } from "@/lib/logger";
import { withApiHandler, type HandlerSession } from "@/lib/api-handler";
import {
  unauthorized,
  forbidden,
  badRequest,
  rateLimited,
  internalError,
} from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/create
// ---------------------------------------------------------------------------
//
// Creates a new dataset in 'draft' status.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Dataset is always created in 'draft' status — caller cannot override.
//   • institute_id is derived from session — caller cannot spoof.
//   • Audit log written — action only, never payload.
//   • Returns only { datasetId, title, status } — no internal fields.
//
// ---------------------------------------------------------------------------

const VALID_TYPES = ["placement", "academic", "fest", "finance", "other"];
const VALID_IDENTIFIER_TYPES = ["email", "reg_no"];
const VALID_AUDIENCE_TYPES = ["restricted", "public"] as const;

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Admin access required");

  const adminUserId = session.user.id;
  const adminInstituteId = session.user.instituteId;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `admin-create:${adminUserId}:${ip}`,
    30,
    60_000,
  );
  if (!allowed) throw rateLimited();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Invalid JSON body", "INVALID_JSON");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const audienceType =
    typeof body.audience_type === "string"
      ? body.audience_type.trim()
      : "restricted";
  const identifierType =
    body.identifier_type === null
      ? null
      : typeof body.identifier_type === "string"
        ? body.identifier_type.trim()
        : "";
  const expiresAtRaw =
    typeof body.expires_at === "string" ? body.expires_at.trim() : null;

  if (!title) {
    throw badRequest("title is required", "MISSING_TITLE");
  }

  if (!VALID_TYPES.includes(type)) {
    throw badRequest(
      `type must be one of: ${VALID_TYPES.join(", ")}`,
      "INVALID_DATASET_TYPE",
    );
  }

  if (!(VALID_AUDIENCE_TYPES as readonly string[]).includes(audienceType)) {
    throw badRequest(
      `audience_type must be one of: ${VALID_AUDIENCE_TYPES.join(", ")}`,
      "INVALID_AUDIENCE_TYPE",
    );
  }

  if (audienceType === "public" && identifierType !== null) {
    throw badRequest(
      "public_dataset_cannot_require_identifier",
      "PUBLIC_DATASET_CANNOT_REQUIRE_IDENTIFIER",
    );
  }

  if (
    audienceType === "restricted" &&
    (identifierType === null ||
      !VALID_IDENTIFIER_TYPES.includes(identifierType))
  ) {
    throw badRequest(
      `identifier_type must be one of: ${VALID_IDENTIFIER_TYPES.join(", ")}`,
      "INVALID_IDENTIFIER_TYPE",
    );
  }

  let expiresAt: Date | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (isNaN(parsed.getTime())) {
      throw badRequest(
        "expires_at must be a valid ISO 8601 date",
        "INVALID_EXPIRES_AT",
      );
    }
    expiresAt = parsed;
  }

  let result: { id: string; title: string; status: string; created_at: Date };
  try {
    result = await createDataset(
      {
        instituteId: adminInstituteId,
        createdBy: adminUserId,
        title,
        type,
        description,
        identifierType,
        audienceType: audienceType as "restricted" | "public",
        expiresAt,
      },
      adminUserId,
    );
  } catch (err) {
    logError("dataset.create.error", {}, err);
    throw internalError("Dataset creation failed");
  }

  logInfo("dataset.create.success", {
    datasetId: result.id,
    title: result.title,
  });

  return NextResponse.json({
    success: true,
    datasetId: result.id,
    title: result.title,
    status: result.status,
  });
}

export const POST = withApiHandler(handler);
