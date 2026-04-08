/**
 * CLEERLYST — Notification Test Suite
 *
 * Validates that createNotificationIfAbsent is called correctly by the
 * GET /api/datasets/{id}/me route and that no security invariants are
 * violated by the notification system.
 *
 * Categories:
 *   1. Notification inserted only on matched access
 *   2. No notification created for unmatched
 *   3. No bulk notification creation anywhere in codebase
 *   4. No dataset_records join added
 *   5. No additional SELECT * introduced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

/** Recursively collect all .ts/.tsx files under a directory. */
function collectFiles(dir: string, ext: string[] = [".ts", ".tsx"]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      files.push(...collectFiles(full, ext));
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

// Shared mock factories ─────────────────────────────────────────────────────

/** Standard authenticated student session. */
function mockAuth() {
  vi.doMock("@/lib/auth", () => ({
    auth: vi.fn().mockResolvedValue({
      user: {
        id: "user-uuid-1",
        role: "student",
        instituteId: "inst-uuid-1",
      },
    }),
  }));
}

/** Published, non-expired, email-based dataset in the user's institute. */
const PUBLISHED_DATASET = {
  id: "ds-uuid-1",
  institute_id: "inst-uuid-1",
  status: "published",
  identifier_type: "email",
  visibility_config: {},
  expires_at: null,
};

/** User row with an email_hash for matching. */
const MATCHED_USER = {
  id: "user-uuid-1",
  institute_id: "inst-uuid-1",
  role: "student",
  email_hash: "hash-abc",
  email_verified: true,
  created_at: new Date(),
  last_login_at: null,
};

/** A fake encrypted payload buffer. */
const FAKE_ENCRYPTED = Buffer.from("encrypted");

/** Build a GET request for /api/datasets/{id}/me */
function makeGetRequest(datasetId: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/datasets/${datasetId}/me`),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: Notification Inserted Only on First Matched Access
// ═══════════════════════════════════════════════════════════════════════════

describe("Notification Category 1 — Inserted only on matched access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("1.1 — createNotificationIfAbsent is called with (userId, datasetId, 'new') on match", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn().mockResolvedValue(true);

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(FAKE_ENCRYPTED),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn().mockReturnValue({ iv: "", data: "" }),
      decryptPayload: vi.fn().mockReturnValue({ grade: "A" }),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matched).toBe(true);

    // Notification must have been called exactly once with correct args
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      "user-uuid-1",
      "ds-uuid-1",
      "new",
    );
  });

  it("1.2 — notification failure does NOT break the matched response", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn().mockRejectedValue(
      new Error("DB connection lost"),
    );

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(FAKE_ENCRYPTED),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn().mockReturnValue({ iv: "", data: "" }),
      decryptPayload: vi.fn().mockReturnValue({ grade: "A" }),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    // Even though notification threw, response must be matched
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matched).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("1.3 — notification status is NOT leaked in the response body", async () => {
    mockAuth();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(FAKE_ENCRYPTED),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(true),
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn().mockReturnValue({ iv: "", data: "" }),
      decryptPayload: vi.fn().mockReturnValue({ grade: "A" }),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    // Response must NOT contain notification-related keys
    expect(body.notification).toBeUndefined();
    expect(body.notified).toBeUndefined();
    expect(body.notification_created).toBeUndefined();
    expect(bodyStr).not.toMatch(/notification/i);
  });

  it("1.4 — response shape is unchanged: exactly { matched, data }", async () => {
    mockAuth();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(FAKE_ENCRYPTED),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(true),
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn().mockReturnValue({ iv: "", data: "" }),
      decryptPayload: vi.fn().mockReturnValue({ grade: "A" }),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    const body = await response.json();

    // Exact keys: matched + data — nothing else
    expect(Object.keys(body).sort()).toEqual(["data", "matched"]);
  });

  it("1.5 — createNotificationIfAbsent is called AFTER successful match (source order)", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    const getFnBody = meRoute.slice(
      meRoute.indexOf("export async function GET"),
    );

    const matchIdx = getFnBody.indexOf("findRecordByHashes");
    const decryptIdx = getFnBody.indexOf("decryptPayload");
    const notifIdx = getFnBody.indexOf("createNotificationIfAbsent");
    const returnIdx = getFnBody.lastIndexOf("return matched(");

    // All must exist
    expect(matchIdx).toBeGreaterThan(-1);
    expect(decryptIdx).toBeGreaterThan(-1);
    expect(notifIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(-1);

    // Order: findRecord → decrypt → notification → return
    expect(decryptIdx).toBeGreaterThan(matchIdx);
    expect(notifIdx).toBeGreaterThan(decryptIdx);
    expect(returnIdx).toBeGreaterThan(notifIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: No Notification Created for Unmatched
// ═══════════════════════════════════════════════════════════════════════════

describe("Notification Category 2 — No notification for unmatched", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("2.1 — no notification when dataset does not exist", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(null),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.2 — no notification when dataset belongs to a different institute", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        ...PUBLISHED_DATASET,
        institute_id: "inst-uuid-OTHER",
      }),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.3 — no notification when dataset is revoked", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue({
        ...PUBLISHED_DATASET,
        status: "revoked",
      }),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.4 — no notification when no identifier hashes found for user", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue({
        ...MATCHED_USER,
        email_hash: null,
      }),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.5 — no notification when record not found (no encrypted payload)", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.6 — no notification when decryption fails", async () => {
    mockAuth();

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(PUBLISHED_DATASET),
      getUserById: vi.fn().mockResolvedValue(MATCHED_USER),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn().mockResolvedValue(FAKE_ENCRYPTED),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn().mockImplementation(() => {
        throw new Error("corrupt data");
      }),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    const body = await response.json();
    expect(body.matched).toBe(false);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("2.7 — no notification when user is unauthenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    const mockCreateNotification = vi.fn();

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn(),
      getUserById: vi.fn(),
      getUserIdentifierHashes: vi.fn(),
      findRecordByHashes: vi.fn(),
      insertAuditLog: vi.fn(),
      createNotificationIfAbsent: mockCreateNotification,
    }));

    vi.doMock("@/lib/encryption", () => ({
      fromBuffer: vi.fn(),
      decryptPayload: vi.fn(),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    await GET(makeGetRequest("ds-uuid-1"), {
      params: Promise.resolve({ id: "ds-uuid-1" }),
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: No Bulk Notification Creation Anywhere in Codebase
// ═══════════════════════════════════════════════════════════════════════════

describe("Notification Category 3 — No bulk notification creation", () => {
  it("3.1 — no function in database.ts inserts multiple notifications in a loop", () => {
    const db = readSource("src/lib/database.ts");
    // Should not have any bulk/batch notification function
    expect(db).not.toMatch(/createNotifications\b/);
    expect(db).not.toMatch(/insertNotificationsBatch\b/);
    expect(db).not.toMatch(/bulkNotif/i);
    expect(db).not.toMatch(/notifyAll/i);
  });

  it("3.2 — createNotificationIfAbsent inserts exactly ONE row (no loop, no multi-row INSERT)", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Only one INSERT statement
    const insertCount = (fn.match(/INSERT INTO/gi) || []).length;
    expect(insertCount).toBe(1);
    // No for/while loop
    expect(fn).not.toMatch(/\bfor\s*\(/);
    expect(fn).not.toMatch(/\bwhile\s*\(/);
    // No .map() or .forEach()
    expect(fn).not.toMatch(/\.map\s*\(/);
    expect(fn).not.toMatch(/\.forEach\s*\(/);
  });

  it("3.3 — no codebase file calls createNotificationIfAbsent inside a loop", () => {
    const allFiles = collectFiles(SRC);
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (!content.includes("createNotificationIfAbsent")) continue;

      // Check that the call is NOT inside a for/while/map/forEach
      // by scanning a window of 300 chars before each call site
      const callIndices: number[] = [];
      let searchFrom = 0;
      while (true) {
        const idx = content.indexOf("createNotificationIfAbsent", searchFrom);
        if (idx === -1) break;
        callIndices.push(idx);
        searchFrom = idx + 1;
      }

      for (const idx of callIndices) {
        const windowStart = Math.max(0, idx - 300);
        const window = content.slice(windowStart, idx);
        // No loop constructs in the 300-char window before the call
        expect(window).not.toMatch(/\bfor\s*\([^)]*\)\s*\{[^}]*$/);
        expect(window).not.toMatch(/\.forEach\s*\(\s*(?:async\s*)?\(/);
        expect(window).not.toMatch(/\.map\s*\(\s*(?:async\s*)?\(/);
      }
    }
  });

  it("3.4 — no endpoint sends notifications to multiple users at once", () => {
    const allFiles = collectFiles(path.join(SRC, "app", "api"));
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // No file should iterate over users to send notifications
      expect(content).not.toMatch(/users\.map\([\s\S]*?notification/i);
      expect(content).not.toMatch(/users\.forEach\([\s\S]*?notification/i);
    }
  });

  it("3.5 — createNotificationIfAbsent uses ON CONFLICT DO NOTHING (idempotent)", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).toMatch(/ON CONFLICT.*DO NOTHING/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: No dataset_records Join Added
// ═══════════════════════════════════════════════════════════════════════════

describe("Notification Category 4 — No dataset_records join added", () => {
  it("4.1 — createNotificationIfAbsent does NOT reference dataset_records", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/dataset_records/);
  });

  it("4.2 — createNotificationIfAbsent does NOT use any JOIN", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/\bJOIN\b/i);
  });

  it("4.3 — createNotificationIfAbsent targets only the notifications table", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Must INSERT INTO notifications
    expect(fn).toMatch(/INSERT INTO notifications/);
    // Must not INSERT INTO any other table
    const insertTargets = fn.match(/INSERT INTO\s+(\w+)/gi) || [];
    for (const target of insertTargets) {
      const tableName = target.replace(/INSERT INTO\s+/i, "").trim();
      expect(tableName).toBe("notifications");
    }
  });

  it("4.4 — /me route source still has NO SQL join between users and dataset_records", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // Extract only backtick-delimited SQL template literals (actual queries)
    const sqlStrings = meRoute.match(/`[^`]*`/g) || [];
    for (const sql of sqlStrings) {
      expect(sql).not.toMatch(/\bJOIN\b/i);
    }
  });

  it("4.5 — no SQL join between notifications and dataset_records anywhere in database.ts", () => {
    const db = readSource("src/lib/database.ts");
    const joinPattern =
      /JOIN\s+(?:notifications|dataset_records)\b[\s\S]{0,200}(?:notifications|dataset_records)/gi;
    const matches = db.match(joinPattern);
    if (matches) {
      for (const m of matches) {
        const hasNotifications = /notifications/i.test(m);
        const hasRecords = /dataset_records/i.test(m);
        expect(hasNotifications && hasRecords).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: No Additional SELECT * Introduced
// ═══════════════════════════════════════════════════════════════════════════

describe("Notification Category 5 — No additional SELECT * introduced", () => {
  it("5.1 — createNotificationIfAbsent does NOT use SELECT *", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    expect(fn).not.toMatch(/SELECT\s+\*/i);
  });

  it("5.2 — createNotificationIfAbsent does NOT use RETURNING", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Must not return payload data via RETURNING
    expect(fn).not.toMatch(/RETURNING/i);
  });

  it("5.3 — createNotificationIfAbsent returns boolean only (no payload)", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Function signature must return Promise<boolean>
    expect(fn).toMatch(/\):\s*Promise<boolean>/);
    // Uses rowCount to determine the result
    expect(fn).toMatch(/rowCount/);
  });

  it("5.4 — database.ts still contains zero SELECT * in any SQL query", () => {
    const db = readSource("src/lib/database.ts");
    const sqlStrings = db.match(/`[^`]*`/g) || [];
    for (const sql of sqlStrings) {
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    }
  });

  it("5.5 — /me route still contains no SELECT * anywhere", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    expect(meRoute).not.toMatch(/SELECT\s+\*/i);
  });

  it("5.6 — createNotificationIfAbsent does NOT read from any table (no SELECT)", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /export async function createNotificationIfAbsent[\s\S]*?finally\s*\{[\s\S]*?\}/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Pure INSERT — no SELECT at all
    expect(fn).not.toMatch(/\bSELECT\b/i);
  });
});
