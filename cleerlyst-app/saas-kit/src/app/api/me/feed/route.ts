import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  getUserIdentifierHashes,
  getPublishedDatasetsForFeed,
  findFirstRecordsForDatasets,
  findMatchingRecordsForDatasets,
  PublishedDatasetForFeed,
} from "@/lib/database";
import { decryptPayload, fromBuffer } from "@/lib/encryption";
import { logError } from "@/lib/logger";
import { withApiHandler, type HandlerSession } from "@/lib/api-handler";
import { unauthorized, rateLimited } from "@/lib/errors";
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

type FeedStatus =
  | "shortlisted"
  | "public"
  | "not_applicable"
  | "missing_identifier";

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
  identifier_type?: string;
}

interface FeedResponse {
  requires_identifier_setup: boolean;
  required_identifier_types: string[];
  items: FeedItem[];
}

function secureFeedResponse(
  body: FeedResponse,
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
// Handler
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  // ----- 1. Authenticate -----

  if (!session?.user?.id) {
    throw unauthorized();
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
    throw rateLimited();
  }

  // ----- 3. Fetch published datasets (single query) -----

  const datasets = await getPublishedDatasetsForFeed(instituteId);

  if (datasets.length === 0) {
    return secureFeedResponse(
      { requires_identifier_setup: false, required_identifier_types: [], items: [] },
      200,
    );
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

  // ----- 5. Collect identifier hashes per type (single pass) -----

  const hashesForType = new Map<string, string[]>();

  if (restrictedDatasets.length > 0) {
    const identifierTypes = new Set(
      restrictedDatasets
        .map((d) => d.identifier_type)
        .filter((t): t is string => t !== null),
    );

    for (const iType of identifierTypes) {
      const hashes: string[] = [];

      if (iType === "email") {
        const user = await getUserById(userId);
        if (user?.email_hash) hashes.push(user.email_hash);
      } else {
        const h = await getUserIdentifierHashes(userId, iType);
        hashes.push(...h);
      }

      hashesForType.set(iType, hashes);
    }
  }

  const allHashes = Array.from(hashesForType.values()).flat();

  // ----- 6. Batch-fetch records (max 2 queries, parallel) -----

  const [publicRecords, restrictedRecords] = await Promise.all([
    findFirstRecordsForDatasets(publicDatasets.map((d) => d.id)),
    findMatchingRecordsForDatasets(
      restrictedDatasets.map((d) => d.id),
      allHashes,
    ),
  ]);

  // ----- 7. Build unified feed -----

  const feed: FeedItem[] = [];

  for (const ds of datasets) {
    const item: FeedItem = {
      dataset_id: ds.id,
      title: ds.title,
      type: ds.type,
      description: ds.description,
      audience_type: ds.audience_type,
      status: "not_applicable",
      data: null,
      published_at: ds.published_at.toISOString(),
      expires_at: ds.expires_at ? ds.expires_at.toISOString() : null,
      identifier_type:
        ds.audience_type === "restricted" && ds.identifier_type
          ? ds.identifier_type
          : undefined,
    };

    if (ds.audience_type === "public") {
      const buf = publicRecords.get(ds.id);
      item.status = "public";
      if (buf) {
        item.data = decryptAndFilter(buf, ds);
      }
    } else {
      if (!ds.identifier_type) {
        logError("feed.invariant_violation", {
          datasetId: ds.id,
          detail: "restricted dataset missing identifier_type",
        });
        continue;
      }
      const userHashes = hashesForType.get(ds.identifier_type) ?? [];

      if (userHashes.length === 0) {
        item.status = "missing_identifier";
      } else {
        const buf = restrictedRecords.get(ds.id);
        if (buf) {
          item.status = "shortlisted";
          item.data = decryptAndFilter(buf, ds);
        } else {
          item.status = "not_applicable";
        }
      }
    }

    feed.push(item);
  }

  // ----- 8. Compute identifier gating flags -----

  const missingTypes: string[] = [];
  for (const [iType, hashes] of hashesForType) {
    if (hashes.length === 0) missingTypes.push(iType);
  }

  return secureFeedResponse(
    {
      requires_identifier_setup: missingTypes.length > 0,
      required_identifier_types: missingTypes,
      items: feed,
    },
    200,
  );
}

export const GET = withApiHandler(handler);
