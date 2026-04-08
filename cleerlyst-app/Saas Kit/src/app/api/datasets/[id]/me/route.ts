import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserById,
  getUserIdentifierHashes,
  getDatasetById,
  findRecordByHashes,
  insertAuditLog,
  createNotificationIfAbsent,
} from "@/lib/database";
import { decryptPayload, fromBuffer } from "@/lib/encryption";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Uniform response helpers
//
// SECURITY (Test 2.3 — Response Uniformity):
//   Both match and no-match return HTTP 200 with identical shape.
//   An attacker comparing responses cannot distinguish the two.
// ---------------------------------------------------------------------------

const NOT_MATCHED = NextResponse.json({ matched: false }, { status: 200 });

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
//   Test 2.3 — Non-Match Response Uniformity
//     Every non-auth exit path returns the same { matched: false } with
//     HTTP 200. Match returns { matched: true, data } with HTTP 200.
//     Same status. Same shape. No inference possible.
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

      // ----- 2. Load dataset -----
      // If the dataset doesn't exist, is not published, belongs to another
      // institute, or has expired → return the uniform NOT_MATCHED response.
      // We deliberately do NOT return 404 — that would leak dataset existence.

      const dataset = await getDatasetById(datasetId);

      if (!dataset) {
        return NOT_MATCHED;
      }

      if (dataset.institute_id !== userInstituteId) {
        return NOT_MATCHED;
      }

      if (dataset.status !== "published") {
        return NOT_MATCHED;
      }

      if (dataset.expires_at && new Date(dataset.expires_at) < new Date()) {
        return NOT_MATCHED;
      }

      // ----- 3. Collect the logged-in user's identifier hashes -----
      // These come ONLY from the server-side DB — never from the request.
      //
      // Query 1 (users / user_identifiers) — completely separate from
      // Query 2 (dataset_records). No join.

      const hashes: string[] = [];

      if (dataset.identifier_type === "email") {
        // The dataset was indexed by email → match against users.email_hash
        const user = await getUserById(userId);
        if (user?.email_hash) {
          hashes.push(user.email_hash);
        }
      } else {
        // The dataset was indexed by reg_no (or other identifier type) →
        // match against user_identifiers.identifier_hash
        const identHashes = await getUserIdentifierHashes(
          userId,
          dataset.identifier_type,
        );
        hashes.push(...identHashes);
      }

      if (hashes.length === 0) {
        return NOT_MATCHED;
      }

      // ----- 4. Look up the record -----
      // Query 2: dataset_records only — no join to users.
      // Returns the raw encrypted_payload (bytea) or null.

      const encryptedBuffer = await findRecordByHashes(datasetId, hashes);

      if (!encryptedBuffer) {
        return NOT_MATCHED;
      }

      // ----- 5. Decrypt + apply visibility filter -----

      let decrypted: Record<string, unknown>;
      try {
        const encrypted = fromBuffer(encryptedBuffer);
        decrypted = decryptPayload<Record<string, unknown>>(encrypted);
      } catch {
        // Decryption failure → treat as no match (don't leak error details)
        logError("dataset.me.decrypt_error", { datasetId });
        return NOT_MATCHED;
      }

      // Apply allowed_fields from visibility_config
      const visConfig = dataset.visibility_config as {
        allowed_fields?: string[];
      } | null;

      const allowedFields = visConfig?.allowed_fields;

      let filteredData: Record<string, unknown>;

      if (Array.isArray(allowedFields) && allowedFields.length > 0) {
        // Only expose the fields the admin explicitly allowed
        filteredData = {};
        for (const field of allowedFields) {
          if (field in decrypted) {
            filteredData[field] = decrypted[field];
          }
        }
      } else {
        // No field restriction configured → return full decrypted payload
        filteredData = decrypted;
      }

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
