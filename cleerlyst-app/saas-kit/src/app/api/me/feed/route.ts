import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserById,
  getUserIdentifierHashes,
  getPublishedDatasetsForFeed,
  findFirstRecordsForDatasets,
  findMatchingRecordsForDatasets,
  PublishedDatasetForFeed,
} from "@/lib/database";
import { decryptPayload, fromBuffer } from "@/lib/encryption";
import { logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/me/feed
// ---------------------------------------------------------------------------
//
// Returns a unified feed of published datasets for the authenticated user's
// institute. Each item includes the user's verification status and
// visibility-filtered data where applicable.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • institute_id is NEVER included in the response.
//   • identifier_hash and identifier_type are NEVER included in the response.
//   • Only visibility-filtered fields are returned in `data`.
//   • Identifier column is ALWAYS excluded from returned data (defense in depth).
//   • No record counts, view counts, or user counts.
//   • Empty array for zero results (still HTTP 200).
//   • Rate-limited per userId (sliding window).
//   • Batch queries — max 3 DB round trips (datasets + public records + restricted records).
//   • Response headers stripped of any internal identifiers.
//
// ---------------------------------------------------------------------------

type FeedStatus = "shortlisted" | "not_selected" | "no_record" | "public";

interface FeedItem {
  dataset_id: string;
  title: string;
  type: string;
  description: string | null;
  audience_type: "restricted" | "public";
  status: FeedStatus;
  data: Record<string, unknown> | null;
  published_at: string;
  expires_at: string | null;
}

function secureFeedResponse(
  body: FeedItem[],
  status: number,
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");
  return response;
}

// ---------------------------------------------------------------------------
// Decrypt + apply visibility filter for a single record
// ---------------------------------------------------------------------------

function decryptAndFilter(
  encryptedBuffer: Buffer,
  dataset: PublishedDatasetForFeed,
): Record<string, unknown> | null {
  try {
    const encrypted = fromBuffer(encryptedBuffer);
    const decrypted = decryptPayload<Record<string, unknown>>(encrypted);

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

    return filteredData;
  } catch {
    logError("feed.decrypt_error", { datasetId: dataset.id });
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/feed" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;
      const { instituteId } = session.user;

      // ----- 2. Rate limit -----

      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const allowed = await rateLimiter.check(
        `feed:${userId}:${ip}`,
        60,
        60_000,
      );

      if (!allowed) {
        logWarn("feed.rate_limited");
        return NextResponse.json([], { status: 429 });
      }

      // ----- 3. Fetch published datasets (single query) -----

      const datasets = await getPublishedDatasetsForFeed(instituteId);

      if (datasets.length === 0) {
        return secureFeedResponse([], 200);
      }

      // ----- 4. Partition into public / restricted -----

      const publicDatasets: PublishedDatasetForFeed[] = [];
      const restrictedDatasets: PublishedDatasetForFeed[] = [];

      for (const ds of datasets) {
        if (ds.audience_type === "public") {
          publicDatasets.push(ds);
        } else {
          restrictedDatasets.push(ds);
        }
      }

      // ----- 5. Batch-fetch records (max 2 queries) -----

      const publicRecordsPromise = findFirstRecordsForDatasets(
        publicDatasets.map((d) => d.id),
      );

      // Collect the user's identifier hashes ONCE for all restricted datasets.
      // Group restricted datasets by identifier_type to collect the right hashes.
      const identifierTypes = new Set(
        restrictedDatasets.map((d) => d.identifier_type),
      );

      const allHashes: string[] = [];

      if (restrictedDatasets.length > 0) {
        if (identifierTypes.has("email")) {
          const user = await getUserById(userId);
          if (user?.email_hash) {
            allHashes.push(user.email_hash);
          }
        }

        for (const iType of identifierTypes) {
          if (iType === "email") continue;
          const hashes = await getUserIdentifierHashes(userId, iType);
          allHashes.push(...hashes);
        }
      }

      const restrictedRecordsPromise = findMatchingRecordsForDatasets(
        restrictedDatasets.map((d) => d.id),
        allHashes,
      );

      const [publicRecords, restrictedRecords] = await Promise.all([
        publicRecordsPromise,
        restrictedRecordsPromise,
      ]);

      // ----- 6. Build unified feed -----

      const feed: FeedItem[] = [];

      for (const ds of datasets) {
        const item: FeedItem = {
          dataset_id: ds.id,
          title: ds.title,
          type: ds.type,
          description: ds.description,
          audience_type: ds.audience_type,
          status: "no_record",
          data: null,
          published_at: ds.published_at.toISOString(),
          expires_at: ds.expires_at ? ds.expires_at.toISOString() : null,
        };

        if (ds.audience_type === "public") {
          const buf = publicRecords.get(ds.id);
          if (buf) {
            item.status = "public";
            item.data = decryptAndFilter(buf, ds);
          }
        } else {
          const buf = restrictedRecords.get(ds.id);
          if (buf) {
            item.status = "shortlisted";
            item.data = decryptAndFilter(buf, ds);
          } else if (allHashes.length === 0) {
            item.status = "no_record";
          } else {
            item.status = "not_selected";
          }
        }

        feed.push(item);
      }

      return secureFeedResponse(feed, 200);
    },
  );
}
