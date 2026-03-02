/**
 * CLEERLYST — Feed Security Test Suite
 *
 * Validates that GET /api/me/feed exposes ONLY safe dataset metadata
 * and never leaks record-level data, internal status, or dataset_records.
 *
 * Tests are split into:
 *   - Static analysis: scan source files for forbidden patterns
 *   - Runtime behaviour: call route handler with mocked deps
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: Feed Returns Empty Array for No Datasets
// ═══════════════════════════════════════════════════════════════════════════

describe("Feed Category 1 — Empty Array for No Datasets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("1.1 — feed route returns HTTP 200 with [] when no datasets exist", async () => {
    // Mock auth — authenticated user
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    // Mock database — empty result
    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");
    const mockRequest = new Request("http://localhost/api/me/feed") as any;
    const response = await GET(mockRequest);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("1.2 — feed source code returns an array, never a single object", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // The successful response must serialise an array (feed)
    expect(feedRoute).toMatch(/secureFeedResponse\(\s*feed\b/);
    // The feed variable must be built with .map()
    expect(feedRoute).toMatch(/datasets\.map\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: Feed Never Returns Record-Level Data
// ═══════════════════════════════════════════════════════════════════════════

describe("Feed Category 2 — No Record-Level Data", () => {
  it("2.1 — feed route does NOT import findRecordByHashes or dataset_records helpers", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Check import statements only (no comments)
    const importLines = feedRoute
      .split("\n")
      .filter((l) => l.startsWith("import "));
    const imports = importLines.join("\n");
    expect(imports).not.toMatch(/findRecordByHashes/);
    expect(imports).not.toMatch(/insertRecordsBatch/);
    expect(imports).not.toMatch(/dataset_records/);
  });

  it("2.2 — feed route does NOT reference encrypted_payload", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).not.toMatch(/encrypted_payload/);
    expect(feedRoute).not.toMatch(/decryptPayload/);
    expect(feedRoute).not.toMatch(/encryption/);
  });

  it("2.3 — feed route does NOT return matched status", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Strip comment lines, then check executable code for "matched"
    const codeOnly = feedRoute
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bmatched\b/);
  });

  it("2.4 — feed route does NOT return record counts or view counts", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).not.toMatch(/record_count/);
    expect(feedRoute).not.toMatch(/view_count/);
    expect(feedRoute).not.toMatch(/user_count/);
    expect(feedRoute).not.toMatch(/\bCOUNT\b/);
  });

  it("2.5 — getPublishedDatasetsForInstitute SQL has no JOIN", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /getPublishedDatasetsForInstitute[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();
    expect(fnBlock![0]).not.toMatch(/\bJOIN\b/i);
  });

  it("2.6 — getPublishedDatasetsForInstitute SQL has no COUNT", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /getPublishedDatasetsForInstitute[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();
    expect(fnBlock![0]).not.toMatch(/\bCOUNT\b/i);
  });

  it("2.7 — getPublishedDatasetsForInstitute SQL has no SELECT *", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /getPublishedDatasetsForInstitute[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();
    expect(fnBlock![0]).not.toMatch(/SELECT\s+\*/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: Feed Does Not Include Internal Status Field
// ═══════════════════════════════════════════════════════════════════════════

describe("Feed Category 3 — No Internal Status Field in Response", () => {
  it("3.1 — feed response shape does NOT include 'status' key", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Extract the .map() body that builds the response items
    const mapBlock = feedRoute.match(
      /datasets\.map\(\s*\(d\)\s*=>\s*\(\{[\s\S]*?\}\)\s*\)/,
    );
    expect(mapBlock).not.toBeNull();

    const shape = mapBlock![0];
    // Must NOT expose status
    expect(shape).not.toMatch(/\bstatus\b/);
    // Must NOT expose institute_id
    expect(shape).not.toMatch(/\binstitute_id\b/);
    // Must NOT expose created_by
    expect(shape).not.toMatch(/\bcreated_by\b/);
    // Must NOT expose identifier_type
    expect(shape).not.toMatch(/\bidentifier_type\b/);
    // Must NOT expose visibility_config
    expect(shape).not.toMatch(/\bvisibility_config\b/);
  });

  it("3.2 — feed response has exactly 7 fields per item", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    const mapBlock = feedRoute.match(
      /datasets\.map\(\s*\(d\)\s*=>\s*\(\{[\s\S]*?\}\)\s*\)/,
    );
    expect(mapBlock).not.toBeNull();

    const shape = mapBlock![0];
    // Count the key assignments (word: ) in the object literal
    const keys = shape.match(/\b\w+\s*:/g) || [];
    expect(keys).toHaveLength(7);
  });

  it("3.3 — runtime response items contain only the 7 allowed keys", async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-2",
          role: "student",
          instituteId: "inst-uuid-2",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([
        {
          id: "ds-uuid-1",
          title: "Test Dataset",
          type: "results",
          description: "A test",
          expires_at: null,
          created_at: new Date("2025-01-01T00:00:00Z"),
          published_at: new Date("2025-01-02T00:00:00Z"),
        },
      ]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");
    const mockRequest = new Request("http://localhost/api/me/feed") as any;
    const response = await GET(mockRequest);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);

    const item = body[0];
    const allowedKeys = [
      "dataset_id",
      "title",
      "type",
      "description",
      "created_at",
      "published_at",
      "expires_at",
    ];

    // Only allowed keys exist
    expect(Object.keys(item).sort()).toEqual(allowedKeys.sort());

    // Forbidden keys must NOT exist
    expect(item.status).toBeUndefined();
    expect(item.institute_id).toBeUndefined();
    expect(item.created_by).toBeUndefined();
    expect(item.identifier_type).toBeUndefined();
    expect(item.visibility_config).toBeUndefined();
    expect(item.record_count).toBeUndefined();
    expect(item.view_count).toBeUndefined();
    expect(item.matched).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: Feed Never Touches dataset_records
// ═══════════════════════════════════════════════════════════════════════════

describe("Feed Category 4 — No dataset_records Access", () => {
  it("4.1 — feed route executable code does not contain 'dataset_records'", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Strip comment lines, then check executable code only
    const codeOnly = feedRoute
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/dataset_records/);
  });

  it("4.2 — getPublishedDatasetsForInstitute queries only the datasets table", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /getPublishedDatasetsForInstitute[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Must query FROM datasets
    expect(fn).toMatch(/FROM\s+datasets\b/i);
    // Must NOT reference dataset_records
    expect(fn).not.toMatch(/dataset_records/);
    // Must NOT reference users
    expect(fn).not.toMatch(/FROM\s+users\b/i);
    // Must NOT reference user_identifiers
    expect(fn).not.toMatch(/user_identifiers/);
  });

  it("4.3 — PublishedDatasetMeta type has no record-related fields", () => {
    const db = readSource("src/lib/database.ts");
    const typeBlock = db.match(
      /interface PublishedDatasetMeta\s*\{[\s\S]*?\}/,
    );
    expect(typeBlock).not.toBeNull();

    const iface = typeBlock![0];
    expect(iface).not.toMatch(/record/i);
    expect(iface).not.toMatch(/payload/i);
    expect(iface).not.toMatch(/identifier_hash/i);
    expect(iface).not.toMatch(/encrypted/i);
    expect(iface).not.toMatch(/count/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: Hardening — Rate Limit, Cache, Headers
// ═══════════════════════════════════════════════════════════════════════════

describe("Feed Category 5 — Hardening", () => {
  it("5.1 — feed route implements rate limiting per user", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).toMatch(/rateLimiter\.check/);
    expect(feedRoute).toMatch(/429/);
    expect(feedRoute).toMatch(/feed:/);
  });

  it("5.2 — feed route implements response caching", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).toMatch(/feedCache/);
    expect(feedRoute).toMatch(/CACHE_TTL_MS/);
  });

  it("5.3 — feed response sets Cache-Control: private, no-store", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).toMatch(/Cache-Control.*private.*no-store/);
  });

  it("5.4 — feed response deletes X-Powered-By and Server headers", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    expect(feedRoute).toMatch(/headers\.delete\(["']X-Powered-By["']\)/);
    expect(feedRoute).toMatch(/headers\.delete\(["']Server["']\)/);
  });

  it("5.5 — rate limiter uses sliding window via shared module", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Rate limiting is delegated to the shared rate-limiter module
    expect(feedRoute).toMatch(/rateLimiter/);
    // The shared module implements the sliding window
    const rateLimiterModule = readSource("src/lib/rate-limiter.ts");
    expect(rateLimiterModule).toMatch(/resetAt/);
    expect(rateLimiterModule).toMatch(/count/);
  });

  it("5.6 — unauthenticated requests return 401, not rate-limited", () => {
    const feedRoute = readSource("src/app/api/me/feed/route.ts");
    // Within the GET handler body, auth check must come BEFORE rate limit
    const getBody = feedRoute.slice(
      feedRoute.indexOf("export async function GET"),
    );
    const authIdx = getBody.indexOf("Authentication required");
    const rateIdx = getBody.indexOf("rateLimiter.check");
    expect(authIdx).toBeGreaterThan(-1);
    expect(rateIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(rateIdx);
  });
});
