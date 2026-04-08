/**
 * CLEERLYST — Revoke Dataset Test Suite
 *
 * Validates the POST /api/admin/datasets/{id}/revoke endpoint and its
 * downstream effects on the feed and /datasets/{id}/me routes.
 *
 * Tests are split into:
 *   - Static analysis: scan source files for forbidden patterns
 *   - Runtime behaviour: call route handler with mocked deps
 *   - Behavioural consistency: verify feed exclusion + /me returns matched:false
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

/** Build a minimal NextRequest for POST */
function makePostRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method: "POST" });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: Cannot Revoke Twice
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 1 — Cannot Revoke Twice", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("1.1 — returns 400 when dataset is already revoked", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "revoked",
      }),
      revokeDataset: vi.fn().mockRejectedValue(
        new Error("Dataset is already revoked"),
      ),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toMatch(/already revoked/i);
    expect(body.success).toBeUndefined();
  });

  it("1.2 — revokeDataset in database.ts throws when status is already revoked", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).toMatch(/already revoked/i);
    expect(fn).toMatch(/throw/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: Cannot Revoke Non-Existent Dataset
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 2 — Cannot Revoke Non-Existent Dataset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("2.1 — returns 404 when dataset does not exist", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(null),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/nonexistent-uuid/revoke"),
      { params: Promise.resolve({ id: "nonexistent-uuid" }) },
    );

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toMatch(/not found/i);
    expect(body.success).toBeUndefined();
  });

  it("2.2 — revokeDataset is NOT called when dataset is not found", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    const mockRevoke = vi.fn();
    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(null),
      revokeDataset: mockRevoke,
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    await POST(
      makePostRequest("/api/admin/datasets/nonexistent-uuid/revoke"),
      { params: Promise.resolve({ id: "nonexistent-uuid" }) },
    );

    expect(mockRevoke).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: Cannot Revoke If Wrong Institute
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 3 — Cannot Revoke If Wrong Institute", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("3.1 — returns 403 when dataset belongs to a different institute", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-OTHER",
        status: "published",
      }),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toMatch(/does not belong/i);
    expect(body.success).toBeUndefined();
  });

  it("3.2 — revokeDataset is NOT called when institute mismatch", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    const mockRevoke = vi.fn();
    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-OTHER",
        status: "published",
      }),
      revokeDataset: mockRevoke,
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("3.3 — 403 response does NOT expose institute_id", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-OTHER",
        status: "published",
      }),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    const body = await response.json();
    expect(body.institute_id).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("inst-uuid-OTHER");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: Revoke Does Not Delete Records
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 4 — No Record Deletion", () => {
  it("4.1 — revokeDataset function does NOT contain DELETE SQL", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/\bDELETE\b/i);
    expect(fn).not.toMatch(/\bDROP\b/i);
    expect(fn).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("4.2 — revokeDataset does NOT reference dataset_records table", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/dataset_records/);
  });

  it("4.3 — revokeDataset does NOT reference notifications table", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/notifications/);
  });

  it("4.4 — revoke route does NOT import insertRecordsBatch or findRecordByHashes", () => {
    const route = readSource(
      "src/app/api/admin/datasets/[id]/revoke/route.ts",
    );
    const importLines = route
      .split("\n")
      .filter((l) => l.startsWith("import "));
    const imports = importLines.join("\n");
    expect(imports).not.toMatch(/insertRecordsBatch/);
    expect(imports).not.toMatch(/findRecordByHashes/);
    expect(imports).not.toMatch(/dataset_records/);
  });

  it("4.5 — revoke route does NOT contain DELETE SQL", () => {
    const route = readSource(
      "src/app/api/admin/datasets/[id]/revoke/route.ts",
    );
    expect(route).not.toMatch(/\bDELETE\b/i);
    expect(route).not.toMatch(/\bDROP\b/i);
    expect(route).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("4.6 — revokeDataset does NOT use SELECT *", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/SELECT\s+\*/i);
  });

  it("4.7 — revokeDataset does NOT use JOIN", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/\bJOIN\b/i);
  });

  it("4.8 — revokeDataset does NOT clear published_at", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Extract only SQL strings (backtick-delimited) from the function
    const sqlStrings = fn.match(/`[^`]*`/g) || [];
    const allSql = sqlStrings.join("\n");

    // SQL must NOT set published_at to NULL or overwrite it
    expect(allSql).not.toMatch(/published_at\s*=\s*NULL/i);
    expect(allSql).not.toMatch(/published_at\s*=\s*NOW/i);
    // SQL must NOT reference published_at at all (no SELECT, no SET)
    expect(allSql).not.toMatch(/published_at/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: Feed Excludes Revoked Datasets
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 5 — Feed Excludes Revoked Datasets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("5.1 — getPublishedDatasetsForInstitute SQL filters by status = 'published'", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /getPublishedDatasetsForInstitute[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Must filter on status = 'published' — this inherently excludes 'revoked'
    expect(fn).toMatch(/status\s*=\s*'published'/);
  });

  it("5.2 — feed returns empty array when only revoked datasets exist", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    // getPublishedDatasetsForInstitute filters at the SQL level, so it
    // returns [] when all datasets are revoked
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

  it("5.3 — feed does NOT include revoked datasets even if they were once published", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    // Simulates DB returning only the one published dataset — the revoked
    // one is excluded at query level
    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([
        {
          id: "ds-published",
          title: "Still Published",
          type: "results",
          description: null,
          expires_at: null,
          created_at: new Date("2025-01-01T00:00:00Z"),
          published_at: new Date("2025-01-02T00:00:00Z"),
        },
      ]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");
    const mockRequest = new Request("http://localhost/api/me/feed") as any;
    const response = await GET(mockRequest);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].dataset_id).toBe("ds-published");

    // No revoked dataset in the feed
    const ids = body.map((d: { dataset_id: string }) => d.dataset_id);
    expect(ids).not.toContain("ds-revoked");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 6: /datasets/{id}/me Returns matched:false After Revoke
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 6 — /datasets/{id}/me Returns matched:false After Revoke", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("6.1 — /me route returns { matched: false } when dataset status is 'revoked'", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "revoked",
        identifier_type: "email",
        visibility_config: {},
        expires_at: null,
      }),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const request = new NextRequest(
      new URL("http://localhost/api/datasets/ds-uuid-1/me"),
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matched).toBe(false);
    expect(body.data).toBeUndefined();
  });

  it("6.2 — /me route does NOT call findRecordByHashes for revoked dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    const mockFindRecord = vi.fn();
    const mockGetUserById = vi.fn();
    const mockGetUserIdentifierHashes = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "revoked",
        identifier_type: "email",
        visibility_config: {},
        expires_at: null,
      }),
      getUserById: mockGetUserById,
      getUserIdentifierHashes: mockGetUserIdentifierHashes,
      findRecordByHashes: mockFindRecord,
      insertAuditLog: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const request = new NextRequest(
      new URL("http://localhost/api/datasets/ds-uuid-1/me"),
    );

    await GET(request, {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    // When the dataset is revoked, the /me route should short-circuit
    // before looking up any records.
    expect(mockFindRecord).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockGetUserIdentifierHashes).not.toHaveBeenCalled();
  });

  it("6.3 — /me route source code checks status !== 'published' before record lookup", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");

    const getFnBody = meRoute.slice(
      meRoute.indexOf("export async function GET"),
    );

    // The status check must occur BEFORE any record lookup
    // Match both quote styles: single or double quotes around "published"
    const statusCheckIdx = getFnBody.search(/status\s*!==\s*["']published["']/);
    const findRecordIdx = getFnBody.indexOf("findRecordByHashes");

    expect(statusCheckIdx).toBeGreaterThan(-1);
    expect(findRecordIdx).toBeGreaterThan(-1);
    // Status check must come before record lookup
    expect(statusCheckIdx).toBeLessThan(findRecordIdx);
  });

  it("6.4 — /me route returns NOT_MATCHED (not 404/403) for revoked dataset", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // Find the status check block
    const statusBlock = meRoute.match(
      /if\s*\(\s*dataset\.status\s*!==\s*["']published["']\s*\)\s*\{[\s\S]*?\}/,
    );
    expect(statusBlock).not.toBeNull();

    // Must return NOT_MATCHED, not a distinct error code
    expect(statusBlock![0]).toContain("NOT_MATCHED");
    expect(statusBlock![0]).not.toContain("404");
    expect(statusBlock![0]).not.toContain("403");
    expect(statusBlock![0]).not.toContain("revoked");
  });

  it("6.5 — /me response for revoked dataset is identical shape to never-existed dataset", async () => {
    // ----- Test revoked dataset response -----
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "revoked",
        identifier_type: "email",
        visibility_config: {},
        expires_at: null,
      }),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const revokedResponse = await GET(
      new NextRequest(new URL("http://localhost/api/datasets/ds-uuid-1/me")),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    const revokedBody = await revokedResponse.json();

    // ----- Now test non-existent dataset -----
    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "user-uuid-1",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(null),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const meModule = await import("@/app/api/datasets/[id]/me/route");

    const notFoundResponse = await meModule.GET(
      new NextRequest(
        new URL("http://localhost/api/datasets/nonexistent-uuid/me"),
      ),
      { params: Promise.resolve({ id: "nonexistent-uuid" }) },
    );

    const notFoundBody = await notFoundResponse.json();

    // Both must be HTTP 200
    expect(revokedResponse.status).toBe(200);
    expect(notFoundResponse.status).toBe(200);

    // Both must have identical shape: { matched: false }
    expect(revokedBody).toEqual({ matched: false });
    expect(notFoundBody).toEqual({ matched: false });

    // Shapes must be identical — an attacker cannot distinguish
    expect(Object.keys(revokedBody).sort()).toEqual(
      Object.keys(notFoundBody).sort(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 7: Revoke Response Shape Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 7 — Response Shape Validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("7.1 — successful revoke returns exactly { success, dataset_id, status }", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "published",
      }),
      revokeDataset: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        status: "revoked",
      }),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    // Exact keys: success, dataset_id, status
    expect(Object.keys(body).sort()).toEqual(
      ["dataset_id", "status", "success"].sort(),
    );

    expect(body.success).toBe(true);
    expect(body.dataset_id).toBe("ds-uuid-1");
    expect(body.status).toBe("revoked");
  });

  it("7.2 — successful revoke does NOT expose institute_id", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "admin-uuid-1",
          role: "admin",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        institute_id: "inst-uuid-1",
        status: "published",
      }),
      revokeDataset: vi.fn().mockResolvedValue({
        id: "ds-uuid-1",
        status: "revoked",
      }),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    const body = await response.json();
    expect(body.institute_id).toBeUndefined();
    expect(body.title).toBeUndefined();
    expect(body.published_at).toBeUndefined();
    expect(body.record_count).toBeUndefined();
  });

  it("7.3 — revoke route source code never includes institute_id in JSON response", () => {
    const route = readSource(
      "src/app/api/admin/datasets/[id]/revoke/route.ts",
    );
    // Find all NextResponse.json() calls
    const jsonCalls = route.match(/NextResponse\.json\(\{[\s\S]*?\}\)/g) || [];
    for (const call of jsonCalls) {
      expect(call).not.toMatch(/\binstitute_id\b/);
      expect(call).not.toMatch(/\btitle\b/);
      expect(call).not.toMatch(/\bpublished_at\b/);
      expect(call).not.toMatch(/\brecord_count\b/);
    }
  });

  it("7.4 — non-admin user receives 403", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "student-uuid",
          role: "student",
          instituteId: "inst-uuid-1",
        },
      }),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn(),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toMatch(/admin/i);
    expect(body.success).toBeUndefined();
  });

  it("7.5 — unauthenticated user receives 403", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn(),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(
      makePostRequest("/api/admin/datasets/ds-uuid-1/revoke"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 8: Audit Log Verification
// ═══════════════════════════════════════════════════════════════════════════

describe("Revoke Category 8 — Audit Log", () => {
  it("8.1 — revokeDataset inserts audit log with action 'dataset.revoke'", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).toMatch(/INSERT INTO audit_logs/);
    expect(fn).toMatch(/dataset\.revoke/);
  });

  it("8.2 — audit log metadata is empty jsonb, not payload data", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Metadata should be empty JSONB
    expect(fn).toMatch(/'\{\}'::jsonb/);
    // Must NOT log any payload or record data
    expect(fn).not.toMatch(/encrypted_payload/);
    expect(fn).not.toMatch(/identifier_hash/);
  });

  it("8.3 — revokeDataset uses BEGIN/COMMIT/ROLLBACK transaction", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).toMatch(/BEGIN/);
    expect(fn).toMatch(/COMMIT/);
    expect(fn).toMatch(/ROLLBACK/);
  });

  it("8.4 — revokeDataset uses FOR UPDATE row-level lock", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function revokeDataset[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).toMatch(/FOR UPDATE/);
  });
});
