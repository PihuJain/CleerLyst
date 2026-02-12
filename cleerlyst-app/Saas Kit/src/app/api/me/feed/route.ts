import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublishedDatasetsForInstitute } from "@/lib/database";
import { logWarn } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/me/feed
// ---------------------------------------------------------------------------
//
// Returns published, non-expired dataset metadata for the authenticated
// user's institute.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • institute_id is NEVER included in the response.
//   • No record counts, view counts, or user counts.
//   • Metadata only — no row-level or record-level data.
//   • Empty array for zero results (still HTTP 200).
//   • Rate-limited per userId (sliding window).
//   • Cached per instituteId for 30 seconds to reduce DB load.
//   • Response headers stripped of any internal identifiers.
//
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Response cache — per instituteId, 30-second TTL
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  data: FeedItem[];
  expiresAt: number;
}

interface FeedItem {
  dataset_id: string;
  title: string;
  type: string;
  description: string | null;
  created_at: string;
  published_at: string;
  expires_at: string | null;
}

/** Map<instituteId, CacheEntry> */
const feedCache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Secure response helper — strips headers that could leak internals
// ---------------------------------------------------------------------------

function secureFeedResponse(body: FeedItem[], status: number): NextResponse {
  const response = NextResponse.json(body, { status });

  // Cache-control: private — never cache in shared proxies
  response.headers.set("Cache-Control", "private, no-store");

  // Remove headers that could leak server internals
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
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
      const allowed = await rateLimiter.check(`feed:${userId}:${ip}`, 60, 60_000);

      if (!allowed) {
        logWarn("feed.rate_limited");
        return NextResponse.json([], { status: 429 });
      }

      // ----- 3. Check cache -----

      const now = Date.now();
      const cached = feedCache.get(instituteId);

      if (cached && cached.expiresAt > now) {
        return secureFeedResponse(cached.data, 200);
      }

      // ----- 4. Fetch published dataset metadata -----

      const datasets = await getPublishedDatasetsForInstitute(instituteId);

      // ----- 5. Map to response shape -----
      // Rename `id` → `dataset_id`. Serialise dates as ISO strings.
      // No extra fields. No institute_id. No internal status.

      const feed: FeedItem[] = datasets.map((d) => ({
        dataset_id: d.id,
        title: d.title,
        type: d.type,
        description: d.description,
        created_at: d.created_at.toISOString(),
        published_at: d.published_at.toISOString(),
        expires_at: d.expires_at ? d.expires_at.toISOString() : null,
      }));

      // ----- 6. Populate cache -----

      feedCache.set(instituteId, { data: feed, expiresAt: now + CACHE_TTL_MS });

      return secureFeedResponse(feed, 200);
    },
  );
}
