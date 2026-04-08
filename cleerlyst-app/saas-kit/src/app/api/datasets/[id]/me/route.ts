import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  getUserIdentifierHashes,
  getDatasetById,
  findRecordByHashes,
  findFirstRecordForDataset,
  insertAuditLog,
  createNotificationIfAbsent,
} from "@/lib/database";
import { decryptPayload, fromBuffer } from "@/lib/encryption";
import { logInfo, logError } from "@/lib/logger";
import {
  withApiHandler,
  type HandlerSession,
  type RouteContext,
} from "@/lib/api-handler";
import { unauthorized, notFound, rateLimited, internalError } from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/datasets/{id}/me
// ---------------------------------------------------------------------------
//
// SECURITY MODEL:
//
//   Test 2.1 — No Dataset Listing
//     This is the ONLY read endpoint for dataset records.
//     No /records, /search, /export, /download endpoint exists.
//
//   Test 2.2 — Identity-Bound Access
//     The identifier hashes come EXCLUSIVELY from the logged-in user's
//     DB records (users.email_hash + user_identifiers). The request body
//     and query params are NEVER used to supply an identifier.
//     A student cannot query as another student.
//
//   Test 2.3 — Response Uniformity & Lifecycle Enforcement
//     Non-existent / draft / revoked / wrong-institute / expired datasets
//     all return 404 { error: "Not found" } — uniform ambiguity.
//     Published-but-no-match returns 200 { matched: false }.
//     When a non-email identifier is required but the user has not yet
//     registered it, the response includes reason: "missing_identifier"
//     and required_type — this reveals only the dataset's identifier_type
//     (already visible as published metadata), NOT record existence.
//     Match returns { matched: true, data } with HTTP 200.
//
//   Test 2.4 — No Join Path
//     The code performs two SEPARATE queries:
//       Query 1: users / user_identifiers → collects identifier_hashes
//       Query 2: dataset_records WHERE identifier_hash = ANY(hashes)
//     There is NO SQL join between users and dataset_records.
//     The schema enforces this: dataset_records has no FK to users.
//
// ---------------------------------------------------------------------------

function missingIdentifier(requiredType: string) {
  return NextResponse.json(
    { matched: false, reason: "missing_identifier", required_type: requiredType },
    { status: 200 },
  );
}

function matched(data: Record<string, unknown>) {
  return NextResponse.json({ matched: true, data }, { status: 200 });
}

const NOT_MATCHED = NextResponse.json({ matched: false }, { status: 200 });

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
  context: RouteContext,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;
  const userInstituteId = session.user.instituteId;

  const { id: datasetId } = await context.params;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `${userId}:${datasetId}:${ip}`,
    30,
    60_000,
  );
  if (!allowed) throw rateLimited();

  // ----- Load dataset + enforce lifecycle -----
  //
  // LIFECYCLE RULE: Only published datasets are accessible to students.
  // Non-existent / draft / revoked / wrong-institute / expired → 404.
  // Uniform ambiguity — student cannot infer dataset state.

  const dataset = await getDatasetById(datasetId);

  if (!dataset || dataset.status !== "published") throw notFound();
  if (dataset.institute_id !== userInstituteId) throw notFound();
  if (dataset.expires_at && new Date(dataset.expires_at) < new Date()) throw notFound();

  // ----- Fetch encrypted record -----
  //
  // PUBLIC: fetch first record — no identity matching.
  // RESTRICTED: collect user's identifier hashes, then match.

  let encryptedBuffer: Buffer | null = null;

  if (dataset.audience_type === "public") {
    encryptedBuffer = await findFirstRecordForDataset(datasetId);
  } else {
    if (!dataset.identifier_type) {
      logError("dataset.me.invariant_violation", {
        datasetId,
        detail: "restricted dataset missing identifier_type",
      });
      throw notFound();
    }

    const hashes: string[] = [];

    if (dataset.identifier_type === "email") {
      const user = await getUserById(userId);
      if (user?.email_hash) hashes.push(user.email_hash);
    } else {
      const identHashes = await getUserIdentifierHashes(
        userId,
        dataset.identifier_type,
      );
      hashes.push(...identHashes);
    }

    if (hashes.length === 0) {
      if (dataset.identifier_type !== "email") {
        return missingIdentifier(dataset.identifier_type);
      }
      return NOT_MATCHED;
    }

    encryptedBuffer = await findRecordByHashes(datasetId, hashes);
  }

  if (!encryptedBuffer) return NOT_MATCHED;

  // ----- Decrypt + apply visibility filter -----
  //
  // SECURITY: Never return the full decrypted object.
  // Only return fields explicitly listed in visibility_config.allowed_fields.
  // ALWAYS exclude the identifier column — even if it appears in allowed_fields.

  let decrypted: Record<string, unknown>;
  try {
    const encrypted = fromBuffer(encryptedBuffer);
    decrypted = decryptPayload<Record<string, unknown>>(encrypted);
  } catch {
    logError("dataset.me.decrypt_error", { datasetId });
    return NOT_MATCHED;
  }

  const visConfig = dataset.visibility_config as {
    allowed_fields?: string[];
  } | null;

  const allowedFields = visConfig?.allowed_fields;
  const filteredData: Record<string, unknown> = {};

  if (Array.isArray(allowedFields) && allowedFields.length > 0) {
    const identifierColumn = dataset.identifier_type;

    for (const field of allowedFields) {
      if (field === identifierColumn) continue;
      if (field in decrypted) {
        filteredData[field] = decrypted[field];
      }
    }
  }

  // ----- Audit log (fire-and-forget) -----

  try {
    await insertAuditLog(userId, "record.view", datasetId, {
      matched: true,
    });
  } catch {
    // Audit failure must not break the response
  }

  // ----- Notification (fire-and-forget) -----

  try {
    await createNotificationIfAbsent(userId, datasetId, "new");
  } catch {
    // Notification failure must not break the response
  }

  logInfo("dataset.me.success", { datasetId });

  return matched(filteredData);
}

export const GET = withApiHandler(handler);
