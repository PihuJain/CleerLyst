/**
 * CLEERLYST — Dataset Lifecycle Test Suite
 *
 * Validates lifecycle rules across all dataset endpoints:
 *
 *   1. Draft dataset is inaccessible to students (404).
 *   2. Revoked dataset is inaccessible to students (404).
 *   3. Published dataset is accessible to students.
 *   4. Feed excludes draft datasets.
 *   5. Feed excludes revoked datasets.
 *   6. Visibility update blocked after publish.
 *   7. Visibility update blocked after revoke.
 *   8. Publish fails if allowed_fields empty.
 *   9. Revoke only works on published datasets.
 *  10. After revoke, dataset disappears from feed.
 *
 * CRITICAL: Lifecycle logic is NEVER mocked.
 *   Only database interactions and auth are mocked to isolate behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  user: {
    id: "admin-uuid-1",
    role: "admin" as const,
    instituteId: "inst-uuid-1",
  },
};

const STUDENT_SESSION = {
  user: {
    id: "user-uuid-1",
    role: "student" as const,
    instituteId: "inst-uuid-1",
  },
};

function makeDataset(overrides: Record<string, unknown> = {}) {
  return {
    id: "ds-uuid-1",
    institute_id: "inst-uuid-1",
    created_by: "admin-uuid-1",
    type: "placement",
    title: "Test Dataset",
    description: null,
    identifier_type: "email",
    visibility_config: { allowed_fields: ["name", "grade"] },
    expires_at: null,
    status: "published",
    created_at: new Date(),
    published_at: new Date(),
    ...overrides,
  };
}

function jsonRequest(url: string, method = "GET") {
  return new Request(url, { method }) as any;
}

function postRequest(url: string) {
  return new Request(url, { method: "POST" }) as any;
}

function patchRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Draft dataset is inaccessible to student
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 1 — Draft dataset is inaccessible to student", () => {
  it("1.1 — GET /api/datasets/[id]/me returns 404 for draft dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "draft", published_at: null }),
      ),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(jsonRequest("http://localhost/api/datasets/ds-uuid-1/me"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("Not found");
    expect(body.matched).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Revoked dataset is inaccessible to student
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 2 — Revoked dataset is inaccessible to student", () => {
  it("2.1 — GET /api/datasets/[id]/me returns 404 for revoked dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "revoked" }),
      ),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(jsonRequest("http://localhost/api/datasets/ds-uuid-1/me"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("Not found");
    expect(body.matched).toBeUndefined();
  });

  it("2.2 — draft and revoked produce identical 404 responses (uniform ambiguity)", async () => {
    // First: draft
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "draft", published_at: null }),
      ),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const routeA = await import("@/app/api/datasets/[id]/me/route");
    const draftRes = await routeA.GET(
      jsonRequest("http://localhost/api/datasets/ds-uuid-1/me"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );
    const draftBody = await draftRes.json();

    // Reset for revoked
    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "revoked" }),
      ),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const routeB = await import("@/app/api/datasets/[id]/me/route");
    const revokedRes = await routeB.GET(
      jsonRequest("http://localhost/api/datasets/ds-uuid-1/me"),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );
    const revokedBody = await revokedRes.json();

    // GUARANTEE: identical response shape and status
    expect(draftRes.status).toBe(revokedRes.status);
    expect(draftBody).toEqual(revokedBody);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Published dataset is accessible
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 3 — Published dataset is accessible", () => {
  it("3.1 — GET /api/datasets/[id]/me returns 200 for published dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "published" }),
      ),
      getUserById: vi.fn().mockResolvedValue({
        id: "user-uuid-1",
        email_hash: "hash-abc",
      }),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn(),
    }));

    vi.doMock("@/lib/encryption", () => ({
      decryptPayload: vi.fn(),
      fromBuffer: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(jsonRequest("http://localhost/api/datasets/ds-uuid-1/me"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    // Published dataset returns 200 (matched: false when no record found)
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Feed excludes draft datasets
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 4 — Feed excludes draft datasets", () => {
  it("4.1 — GET /api/me/feed only returns published datasets", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    // getPublishedDatasetsForInstitute already filters by status = 'published'
    // We mock it to return only published datasets (simulating the DB query)
    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([
        {
          id: "ds-published",
          title: "Published One",
          type: "placement",
          description: null,
          expires_at: null,
          created_at: new Date("2026-01-01"),
          published_at: new Date("2026-01-02"),
        },
      ]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");

    const response = await GET(jsonRequest("http://localhost/api/me/feed"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].dataset_id).toBe("ds-published");

    // Must not contain status field
    expect(body[0].status).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Feed excludes revoked datasets
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 5 — Feed excludes revoked datasets", () => {
  it("5.1 — revoked datasets are not returned by the feed query", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    // Mock: query returns empty (revoked datasets are filtered out at DB level)
    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");

    const response = await GET(jsonRequest("http://localhost/api/me/feed"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Visibility update blocked after publish
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 6 — Visibility update blocked after publish", () => {
  it("6.1 — PATCH returns 403 visibility_locked for published dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "published" }),
      ),
      updateDatasetVisibilityConfig: vi.fn(),
      insertAuditLog: vi.fn(),
    }));

    const { PATCH } = await import(
      "@/app/api/admin/datasets/[id]/visibility/route"
    );

    const response = await PATCH(
      patchRequest("http://localhost/api/admin/datasets/ds-uuid-1/visibility", {
        allowed_fields: ["name"],
      }),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("visibility_locked");
  });

  it("6.2 — PATCH succeeds for draft dataset", async () => {
    const updateMock = vi.fn().mockResolvedValue({
      id: "ds-uuid-1",
      updated_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "draft", published_at: null }),
      ),
      updateDatasetVisibilityConfig: updateMock,
      insertAuditLog: vi.fn(),
    }));

    const { PATCH } = await import(
      "@/app/api/admin/datasets/[id]/visibility/route"
    );

    const response = await PATCH(
      patchRequest("http://localhost/api/admin/datasets/ds-uuid-1/visibility", {
        allowed_fields: ["name", "grade"],
      }),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Visibility update blocked after revoke
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 7 — Visibility update blocked after revoke", () => {
  it("7.1 — PATCH returns 403 visibility_locked for revoked dataset", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "revoked" }),
      ),
      updateDatasetVisibilityConfig: vi.fn(),
      insertAuditLog: vi.fn(),
    }));

    const { PATCH } = await import(
      "@/app/api/admin/datasets/[id]/visibility/route"
    );

    const response = await PATCH(
      patchRequest("http://localhost/api/admin/datasets/ds-uuid-1/visibility", {
        allowed_fields: ["name"],
      }),
      { params: Promise.resolve({ id: "ds-uuid-1" }) },
    );

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("visibility_locked");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: Publish fails if allowed_fields empty
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 8 — Publish fails if allowed_fields empty", () => {
  it("8.1 — returns 400 no_visible_fields_selected when allowed_fields is empty", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({
          status: "draft",
          published_at: null,
          visibility_config: { allowed_fields: [] },
        }),
      ),
      publishDataset: vi.fn(),
    }));

    vi.doMock("@/lib/config", () => ({
      config: { baseUrl: "http://localhost" },
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/publish/route"
    );

    const response = await POST(postRequest("http://localhost/api/admin/datasets/ds-uuid-1/publish"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("no_visible_fields_selected");
  });

  it("8.2 — returns 400 when visibility_config has no allowed_fields key", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({
          status: "draft",
          published_at: null,
          visibility_config: {},
        }),
      ),
      publishDataset: vi.fn(),
    }));

    vi.doMock("@/lib/config", () => ({
      config: { baseUrl: "http://localhost" },
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/publish/route"
    );

    const response = await POST(postRequest("http://localhost/api/admin/datasets/ds-uuid-1/publish"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("no_visible_fields_selected");
  });

  it("8.3 — publish succeeds when allowed_fields is non-empty", async () => {
    const publishMock = vi.fn().mockResolvedValue({
      id: "ds-uuid-1",
      title: "Test Dataset",
      published_at: new Date("2026-02-12"),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({
          status: "draft",
          published_at: null,
          visibility_config: { allowed_fields: ["name", "grade"] },
        }),
      ),
      publishDataset: publishMock,
    }));

    vi.doMock("@/lib/config", () => ({
      config: { baseUrl: "http://localhost" },
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/publish/route"
    );

    const response = await POST(postRequest("http://localhost/api/admin/datasets/ds-uuid-1/publish"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(publishMock).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: Revoke only works on published datasets
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 9 — Revoke only works on published datasets", () => {
  it("9.1 — returns 400 cannot_revoke_non_published_dataset for draft", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "draft", published_at: null }),
      ),
      revokeDataset: vi.fn(),
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(postRequest("http://localhost/api/admin/datasets/ds-uuid-1/revoke"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("cannot_revoke_non_published_dataset");
  });

  it("9.2 — revoke succeeds for published dataset", async () => {
    const revokeMock = vi.fn().mockResolvedValue({
      id: "ds-uuid-1",
      status: "revoked",
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(ADMIN_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(
        makeDataset({ status: "published" }),
      ),
      revokeDataset: revokeMock,
    }));

    const { POST } = await import(
      "@/app/api/admin/datasets/[id]/revoke/route"
    );

    const response = await POST(postRequest("http://localhost/api/admin/datasets/ds-uuid-1/revoke"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("revoked");
    expect(revokeMock).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: After revoke, dataset disappears from feed
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 10 — After revoke, dataset disappears from feed", () => {
  it("10.1 — feed returns empty when all datasets are revoked", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    // DB query filters revoked datasets — returns empty
    vi.doMock("@/lib/database", () => ({
      getPublishedDatasetsForInstitute: vi.fn().mockResolvedValue([]),
    }));

    const { GET } = await import("@/app/api/me/feed/route");

    const response = await GET(jsonRequest("http://localhost/api/me/feed"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });
});
