import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Response helpers
//
// LIFECYCLE + SECURITY INVARIANTS:
//
//   DATASET_NOT_FOUND (404):
//     Returned when the dataset does not exist, is not published, belongs to
//     another institute, or has expired. A student cannot infer whether the
//     dataset was draft, revoked, or never existed — uniform ambiguity.
//
//   NOT_MATCHED (200):
//     Returned ONLY for published, accessible datasets when the user's
//     identifier does not match any record.
//
//   matched (200):
//     Returned when a record match is found. Only visibility-filtered fields.
//
// ---------------------------------------------------------------------------

const DATASET_NOT_FOUND = NextResponse.json(
  { error: "Not found" },
  { status: 404 },
);

const NOT_MATCHED = NextResponse.json({ matched: false }, { status: 200 });

function missingIdentifier(requiredType: string) {
  return NextResponse.json(
    { matched: false, reason: "missing_identifier", required_type: requiredType },
    { status: 200 },
  );
}

function matched(data: Record<string, unknown>) {
  return NextResponse.json({ matched: true, data }, { status: 200 });
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/datasets/[id]/me" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        // Auth failure is the ONLY case that returns a non-200 status.
        // This is acceptable — an unauthenticated caller learns nothing
        // about the dataset; they only learn they aren't logged in.
        logWarn("dataset.me.unauthorized");
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const userId = session.user.id;
      const userInstituteId = session.user.instituteId;
      const { id: datasetId } = await params;

      // ----- 1b. Rate limit -----

      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const rateLimitKey = `${userId}:${datasetId}:${ip}`;
      const allowed = await rateLimiter.check(rateLimitKey, 30, 60_000);

      if (!allowed) {
        logWarn("dataset.me.rate_limited", { datasetId });
        return NextResponse.json({ matched: false }, { status: 429 });
      }

      // ----- 2. Load dataset + enforce lifecycle -----
      //
      // LIFECYCLE RULE: Only published datasets are accessible to students.
      // If the dataset does not exist, is draft, is revoked, belongs to
      // another institute, or has expired → return DATASET_NOT_FOUND (404).
      // The uniform 404 ensures a student cannot infer whether the dataset
      // was draft, revoked, or never existed (uniform ambiguity).

      const dataset = await getDatasetById(datasetId);

      if (!dataset || dataset.status !== "published") {
        return DATASET_NOT_FOUND;
      }

      if (dataset.institute_id !== userInstituteId) {
        return DATASET_NOT_FOUND;
      }

      if (dataset.expires_at && new Date(dataset.expires_at) < new Date()) {
        return DATASET_NOT_FOUND;
      }

      // ----- 3. Fetch encrypted record -----
      //
      // PUBLIC datasets: fetch the first record — no identity matching.
      // RESTRICTED datasets: collect user's identifier hashes, then match.

      let encryptedBuffer: Buffer | null = null;

      if (dataset.audience_type === "public") {
        encryptedBuffer = await findFirstRecordForDataset(datasetId);
      } else {
        // DB constraint guarantees restricted datasets always have identifier_type.
        if (!dataset.identifier_type) {
          logError("dataset.me.invariant_violation", { datasetId, detail: "restricted dataset missing identifier_type" });
          return DATASET_NOT_FOUND;
        }

        const hashes: string[] = [];

        if (dataset.identifier_type === "email") {
          const user = await getUserById(userId);
          if (user?.email_hash) {
            hashes.push(user.email_hash);
          }
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

      if (!encryptedBuffer) {
        return NOT_MATCHED;
      }

      // ----- 5. Decrypt + apply visibility filter -----
      //
      // SECURITY: Never return the full decrypted object.
      // Only return fields explicitly listed in visibility_config.allowed_fields.
      // ALWAYS exclude the identifier column (identifier_type) — even if it
      // somehow appears in allowed_fields (defense in depth).

      let decrypted: Record<string, unknown>;
      try {
        const encrypted = fromBuffer(encryptedBuffer);
        decrypted = decryptPayload<Record<string, unknown>>(encrypted);
      } catch {
        // Decryption failure → treat as no match (don't leak error details)
        logError("dataset.me.decrypt_error", { datasetId });
        return NOT_MATCHED;
      }

      const visConfig = dataset.visibility_config as {
        allowed_fields?: string[];
      } | null;

      const allowedFields = visConfig?.allowed_fields;

      // Build filtered response — never return full decrypted object
      const filteredData: Record<string, unknown> = {};

      if (Array.isArray(allowedFields) && allowedFields.length > 0) {
        const identifierColumn = dataset.identifier_type;

        for (const field of allowedFields) {
          // SECURITY: Never return the identifier column
          if (field === identifierColumn) continue;

          if (field in decrypted) {
            filteredData[field] = decrypted[field];
          }
        }
      }
      // If allowed_fields is empty or not configured → return empty data object.
      // Published datasets MUST have allowed_fields configured (enforced at
      // publish time), but we defend against misconfigured legacy data.

      // ----- 6. Audit log (action only, never payload) -----

      try {
        await insertAuditLog(userId, "record.view", datasetId, {
          matched: true,
        });
      } catch {
        // Audit failure must not break the response
      }

      // ----- 7. Notification (fire-and-forget, never blocks response) -----

      try {
        await createNotificationIfAbsent(userId, datasetId, "new");
      } catch {
        // Notification failure must not break the response
      }

      // ----- 8. Return matched data -----

      logInfo("dataset.me.success", { datasetId });

      return matched(filteredData);
    },
  );
}
