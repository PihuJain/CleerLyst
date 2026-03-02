/**
 * CLEERLYST — Identifier Security Test Suite
 *
 * Covers the identifier system's security guarantees:
 *
 *   1. Adding an identifier stores only a hash — never plaintext
 *   2. Same user cannot add the same identifier type twice
 *   3. Two users cannot share the same identifier (within a type)
 *   4. Deleting an identifier removes the row
 *   5. Missing identifier surfaces reason: "missing_identifier"
 *   6. Edge case input normalization (whitespace, zeros, length, injection)
 *
 * CRITICAL: Hashing logic is NEVER mocked.
 *   Real normalizeIdentifier + hashIdentifier run in every test.
 *   Only database interactions are mocked to isolate behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Helpers — test fixtures and utilities
// ---------------------------------------------------------------------------

/**
 * Compute the expected SHA-256 hash the same way the real code does:
 *   SHA-256( UPPERCASE(trimmed_value) + instituteSalt )
 * This is NOT mocking — it's an independent reference implementation
 * to verify the production code produces the correct hash.
 */
function expectedHash(value: string, salt: string): string {
  return createHash("sha256")
    .update(value.trim().toUpperCase() + salt)
    .digest("hex");
}

const INSTITUTE = {
  id: "inst-uuid-1",
  name: "Test Institute",
  primary_domain: "test.edu",
  allowed_domains: ["test.edu"],
  created_at: new Date(),
};

const STUDENT_SESSION = {
  user: {
    id: "user-uuid-1",
    role: "student" as const,
    instituteId: INSTITUTE.id,
  },
};

/** Build a JSON POST request. */
function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

/** Build a DELETE request. */
function deleteRequest(url: string) {
  return new Request(url, { method: "DELETE" }) as any;
}

/** Build a GET request. */
function getRequest(url: string) {
  return new Request(url, { method: "GET" }) as any;
}

// ---------------------------------------------------------------------------
// Encryption mock — POST route now stores AES-256-GCM ciphertext alongside
// the hash. We mock the encryption module so tests don't need the real key.
// Hashing is NEVER mocked — encryption is a separate concern.
// ---------------------------------------------------------------------------

const FAKE_ENCRYPTED_PAYLOAD = {
  iv: Buffer.from("fake-iv-12by").toString("base64"),
  authTag: Buffer.from("fake-authtag1234").toString("base64"),
  ciphertext: Buffer.from("fake-ciphertext").toString("base64"),
};

const FAKE_ENCRYPTED_BUFFER = Buffer.concat([
  Buffer.from(FAKE_ENCRYPTED_PAYLOAD.iv, "base64"),
  Buffer.from(FAKE_ENCRYPTED_PAYLOAD.authTag, "base64"),
  Buffer.from(FAKE_ENCRYPTED_PAYLOAD.ciphertext, "base64"),
]);

/**
 * Mock encryption module with fake implementations.
 * Used by POST-route tests where we only need the encrypt path.
 * Includes all 4 exports to prevent "missing export" errors.
 */
function mockEncryption() {
  vi.doMock("@/lib/encryption", () => ({
    encryptPayload: vi.fn().mockReturnValue(FAKE_ENCRYPTED_PAYLOAD),
    toBuffer: vi.fn().mockReturnValue(FAKE_ENCRYPTED_BUFFER),
    fromBuffer: vi.fn().mockReturnValue(FAKE_ENCRYPTED_PAYLOAD),
    decryptPayload: vi.fn().mockReturnValue("FAKE_DECRYPTED"),
  }));
}

/**
 * Replace the fake encryption mock with the REAL module.
 * Used by tests that need actual AES-256-GCM encrypt/decrypt.
 * Must be called AFTER vi.resetModules().
 */
function useRealEncryption(testKey: string) {
  process.env.DATASET_ENCRYPTION_KEY = testKey;
  vi.doMock("@/lib/encryption", async () => {
    return await vi.importActual("@/lib/encryption");
  });
}

// ---------------------------------------------------------------------------
// Setup — reset module registry between tests so vi.doMock takes effect
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  // POST route imports @/lib/encryption — register mock for every test.
  // No-op for tests that don't import the POST route.
  mockEncryption();
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Adding identifier stores only hash (no plaintext)
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 1 — Adding identifier stores only hash", () => {
  it("1.1 — insertUserIdentifier receives a SHA-256 hash, not the plaintext value", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "REG001",
      }),
    );

    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalledOnce();

    const [userId, type, hash, encryptedBuf] = insertMock.mock.calls[0];

    // The stored value must NOT be the plaintext identifier
    expect(hash).not.toBe("REG001");

    // It must be a 64-character hex string (SHA-256 output)
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    // It must match the independently computed expected hash
    expect(hash).toBe(expectedHash("REG001", INSTITUTE.id));

    // userId and type must be passed through correctly
    expect(userId).toBe("user-uuid-1");
    expect(type).toBe("reg_no");

    // 4th argument: encrypted buffer (AES-256-GCM ciphertext, not plaintext)
    expect(Buffer.isBuffer(encryptedBuf)).toBe(true);
    expect(encryptedBuf).toBe(FAKE_ENCRYPTED_BUFFER);
  });

  it("1.2 — response body never contains the identifier value or hash", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: vi
        .fn()
        .mockResolvedValue({ id: "new-id", created_at: new Date() }),
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "REG001",
      }),
    );

    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    // Must not contain plaintext
    expect(bodyStr).not.toContain("REG001");

    // Must not contain the hash
    expect(bodyStr).not.toContain(expectedHash("REG001", INSTITUTE.id));

    // Must be exactly { success: true }
    expect(body).toEqual({ success: true });
  });

  it("1.3 — whitespace is trimmed before hashing", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "  REG001  ",
      }),
    );

    const [, , hash] = insertMock.mock.calls[0];

    // Padded value must hash identically to the trimmed value
    expect(hash).toBe(expectedHash("REG001", INSTITUTE.id));
  });

  it("1.4 — leading zeros are preserved, not cast to number", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "007",
      }),
    );

    const [, , hash] = insertMock.mock.calls[0];

    // "007" must NOT hash the same as "7"
    expect(hash).toBe(expectedHash("007", INSTITUTE.id));
    expect(hash).not.toBe(expectedHash("7", INSTITUTE.id));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Same user cannot add same type twice
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 2 — Same user cannot add same type twice", () => {
  it("2.1 — returns identifier_already_exists via pre-check query", async () => {
    const insertMock = vi.fn();

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      // Simulate: user already has a reg_no identifier
      getUserIdentifierHashes: vi
        .fn()
        .mockResolvedValue(["existing-hash-abc"]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "REG999",
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("identifier_already_exists");

    // INSERT must never have been attempted
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("2.2 — returns identifier_already_exists via DB constraint violation (safety net)", async () => {
    const pgError = Object.assign(new Error("unique_violation"), {
      code: "23505",
      constraint: "uq_user_identifiers_user_type",
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: vi.fn().mockRejectedValue(pgError),
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "REG001",
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("identifier_already_exists");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Two users cannot share same identifier
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 3 — Two users cannot share same identifier", () => {
  it("3.1 — returns identifier_already_registered on hash uniqueness violation", async () => {
    const pgError = Object.assign(new Error("unique_violation"), {
      code: "23505",
      constraint: "uq_user_identifiers_type_hash",
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: vi.fn().mockRejectedValue(pgError),
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "REG001",
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("identifier_already_registered");
  });

  it("3.2 — conflict response never leaks the identifier value or hash", async () => {
    const pgError = Object.assign(new Error("unique_violation"), {
      code: "23505",
      constraint: "uq_user_identifiers_type_hash",
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: vi.fn().mockRejectedValue(pgError),
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "SHARED-REG-001",
      }),
    );

    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    // Must not leak the plaintext value
    expect(bodyStr).not.toContain("SHARED-REG-001");

    // Must not leak the hash
    expect(bodyStr).not.toContain(
      expectedHash("SHARED-REG-001", INSTITUTE.id),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Deleting identifier removes row
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 4 — Deleting identifier removes row", () => {
  it("4.1 — DELETE calls deleteUserIdentifier with correct user_id and type", async () => {
    const deleteMock = vi.fn().mockResolvedValue(true);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      deleteUserIdentifier: deleteMock,
    }));

    const { DELETE } = await import(
      "@/app/api/me/identifiers/[type]/route"
    );

    const response = await DELETE(
      deleteRequest("http://localhost/api/me/identifiers/reg_no"),
      { params: Promise.resolve({ type: "reg_no" }) },
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ success: true });

    // Verify the correct arguments were passed
    expect(deleteMock).toHaveBeenCalledOnce();
    expect(deleteMock).toHaveBeenCalledWith("user-uuid-1", "reg_no");
  });

  it("4.2 — returns success even when no row existed (idempotent)", async () => {
    // deleteUserIdentifier returns false — no row was deleted
    const deleteMock = vi.fn().mockResolvedValue(false);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      deleteUserIdentifier: deleteMock,
    }));

    const { DELETE } = await import(
      "@/app/api/me/identifiers/[type]/route"
    );

    const response = await DELETE(
      deleteRequest("http://localhost/api/me/identifiers/roll_no"),
      { params: Promise.resolve({ type: "roll_no" }) },
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it("4.3 — response never contains identifier value or hash", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      deleteUserIdentifier: vi.fn().mockResolvedValue(true),
    }));

    const { DELETE } = await import(
      "@/app/api/me/identifiers/[type]/route"
    );

    const response = await DELETE(
      deleteRequest("http://localhost/api/me/identifiers/reg_no"),
      { params: Promise.resolve({ type: "reg_no" }) },
    );

    const body = await response.json();

    // Response is exactly { success: true } — nothing else
    expect(Object.keys(body)).toEqual(["success"]);
    expect(body.success).toBe(true);
    expect(body.identifier).toBeUndefined();
    expect(body.hash).toBeUndefined();
    expect(body.value).toBeUndefined();
  });

  it("4.4 — rejects unknown identifier types", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      deleteUserIdentifier: vi.fn(),
    }));

    const { DELETE } = await import(
      "@/app/api/me/identifiers/[type]/route"
    );

    const response = await DELETE(
      deleteRequest("http://localhost/api/me/identifiers/ssn"),
      { params: Promise.resolve({ type: "ssn" }) },
    );

    expect(response.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Missing identifier triggers reason: "missing_identifier"
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 5 — Missing identifier triggers missing_identifier reason", () => {
  const REG_NO_DATASET = {
    id: "dataset-uuid-1",
    institute_id: INSTITUTE.id,
    created_by: "admin-uuid",
    type: "placement",
    title: "Placement Results",
    description: null,
    identifier_type: "reg_no",
    visibility_config: {},
    expires_at: null,
    status: "published",
    created_at: new Date(),
    published_at: new Date(),
  };

  it("5.1 — dataset requiring reg_no returns missing_identifier when user has none", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(REG_NO_DATASET),
      getUserById: vi.fn().mockResolvedValue(null),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn().mockResolvedValue(undefined),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(false),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(
      getRequest("http://localhost/api/datasets/dataset-uuid-1/me"),
      { params: Promise.resolve({ id: "dataset-uuid-1" }) },
    );

    const body = await response.json();

    expect(body.matched).toBe(false);
    expect(body.reason).toBe("missing_identifier");
    expect(body.required_type).toBe("reg_no");
  });

  it("5.2 — required_type matches the dataset's identifier_type", async () => {
    // Use a dataset that requires roll_no
    const rollNoDataset = { ...REG_NO_DATASET, identifier_type: "roll_no" };

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(rollNoDataset),
      getUserById: vi.fn().mockResolvedValue(null),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn().mockResolvedValue(undefined),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(false),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(
      getRequest("http://localhost/api/datasets/dataset-uuid-1/me"),
      { params: Promise.resolve({ id: "dataset-uuid-1" }) },
    );

    const body = await response.json();

    expect(body.matched).toBe(false);
    expect(body.reason).toBe("missing_identifier");
    expect(body.required_type).toBe("roll_no");
  });

  it("5.3 — email-type dataset does NOT return missing_identifier", async () => {
    const emailDataset = { ...REG_NO_DATASET, identifier_type: "email" };

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(emailDataset),
      getUserById: vi.fn().mockResolvedValue(null),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn().mockResolvedValue(undefined),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(false),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(
      getRequest("http://localhost/api/datasets/dataset-uuid-1/me"),
      { params: Promise.resolve({ id: "dataset-uuid-1" }) },
    );

    const body = await response.json();

    // Should be generic no-match, NOT missing_identifier
    expect(body.matched).toBe(false);
    expect(body.reason).toBeUndefined();
    expect(body.required_type).toBeUndefined();
  });

  it("5.4 — missing_identifier response uses HTTP 200 (uniform with all other responses)", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(REG_NO_DATASET),
      getUserById: vi.fn().mockResolvedValue(null),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn().mockResolvedValue(undefined),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(false),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(
      getRequest("http://localhost/api/datasets/dataset-uuid-1/me"),
      { params: Promise.resolve({ id: "dataset-uuid-1" }) },
    );

    // MUST be 200 — same status as match, no-match, and every other path
    expect(response.status).toBe(200);
  });

  it("5.5 — when user HAS the identifier, no missing_identifier is returned", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getDatasetById: vi.fn().mockResolvedValue(REG_NO_DATASET),
      getUserById: vi.fn().mockResolvedValue(null),
      // User HAS a reg_no hash — but no matching record in the dataset
      getUserIdentifierHashes: vi
        .fn()
        .mockResolvedValue(["some-reg-hash"]),
      findRecordByHashes: vi.fn().mockResolvedValue(null),
      insertAuditLog: vi.fn().mockResolvedValue(undefined),
      createNotificationIfAbsent: vi.fn().mockResolvedValue(false),
    }));

    const { GET } = await import("@/app/api/datasets/[id]/me/route");

    const response = await GET(
      getRequest("http://localhost/api/datasets/dataset-uuid-1/me"),
      { params: Promise.resolve({ id: "dataset-uuid-1" }) },
    );

    const body = await response.json();

    // Should be generic no-match — the user has the identifier, just no record
    expect(body.matched).toBe(false);
    expect(body.reason).toBeUndefined();
    expect(body.required_type).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Edge case input normalization
// ═══════════════════════════════════════════════════════════════════════════
//
// Tests normalizeIdentifier + hashIdentifier directly (NEVER mocked)
// AND through the route handler to verify the full pipeline.
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 6 — Edge case input normalization", () => {
  // -----------------------------------------------------------------------
  // 6.1–6.4: Direct normalizeIdentifier unit tests
  // -----------------------------------------------------------------------

  it("6.1 — trims leading and trailing whitespace and uppercases", async () => {
    const { normalizeIdentifier } = await import("@/lib/identifier");

    expect(normalizeIdentifier("  ABC123  ")).toBe("ABC123");
    expect(normalizeIdentifier("\treg001\n")).toBe("REG001");
    expect(normalizeIdentifier("   007   ")).toBe("007");
    expect(normalizeIdentifier("  mixed Case  ")).toBe("MIXED CASE");
  });

  it("6.2 — preserves leading zeros (no number casting)", async () => {
    const { normalizeIdentifier } = await import("@/lib/identifier");

    expect(normalizeIdentifier("007")).toBe("007");
    expect(normalizeIdentifier("00000")).toBe("00000");
    expect(normalizeIdentifier("0")).toBe("0");

    // Must NOT be treated as the number 0, 7, etc.
    expect(normalizeIdentifier("007")).not.toBe("7");
    expect(normalizeIdentifier("00100")).not.toBe("100");
  });

  it("6.3 — rejects strings exceeding 128 characters", async () => {
    const { normalizeIdentifier } = await import("@/lib/identifier");

    const exactly128 = "A".repeat(128);
    const tooLong = "A".repeat(129);

    // 128 chars → OK
    expect(() => normalizeIdentifier(exactly128)).not.toThrow();
    expect(normalizeIdentifier(exactly128)).toBe(exactly128);

    // 129 chars → rejected
    expect(() => normalizeIdentifier(tooLong)).toThrow(
      /exceeds maximum length/,
    );
  });

  it("6.4 — rejects empty and whitespace-only strings", async () => {
    const { normalizeIdentifier } = await import("@/lib/identifier");

    expect(() => normalizeIdentifier("")).toThrow(/must not be empty/);
    expect(() => normalizeIdentifier("   ")).toThrow(/must not be empty/);
    expect(() => normalizeIdentifier("\t\n")).toThrow(/must not be empty/);
  });

  // -----------------------------------------------------------------------
  // 6.5: >128-char input rejected through the route
  // -----------------------------------------------------------------------

  it("6.5 — POST rejects identifier exceeding 128 characters with 400", async () => {
    const insertMock = vi.fn();

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "X".repeat(129),
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toMatch(/exceeds maximum length/);

    // INSERT must never have been attempted
    expect(insertMock).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6.6–6.8: SQL injection–like input handled safely
  // -----------------------------------------------------------------------

  it("6.6 — SQL injection string is hashed, not executed or stored as plaintext", async () => {
    const sqlInjection = "'; DROP TABLE users; --";
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: sqlInjection,
      }),
    );

    // The request must succeed — the injection string is valid input
    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalledOnce();

    const [, , hash] = insertMock.mock.calls[0];

    // The stored value must be a SHA-256 hash, NOT the raw SQL injection
    expect(hash).not.toBe(sqlInjection);
    expect(hash).not.toContain("DROP");
    expect(hash).not.toContain("TABLE");
    expect(hash).not.toContain("--");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(expectedHash(sqlInjection, INSTITUTE.id));
  });

  it("6.7 — response never echoes back SQL injection input", async () => {
    const sqlInjection = "1 OR 1=1; --";

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: vi
        .fn()
        .mockResolvedValue({ id: "new-id", created_at: new Date() }),
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: sqlInjection,
      }),
    );

    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("OR");
    expect(bodyStr).not.toContain("1=1");
    expect(bodyStr).not.toContain("--");
    expect(body).toEqual({ success: true });
  });

  it("6.8 — script injection / XSS input is hashed safely", async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const response = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: xssPayload,
      }),
    );

    expect(response.status).toBe(201);

    const [, , hash] = insertMock.mock.calls[0];

    // Stored value is a hash — no script tags
    expect(hash).not.toContain("<script>");
    expect(hash).not.toContain("alert");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(expectedHash(xssPayload, INSTITUTE.id));

    // Response body is clean
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("<script>");
  });

  // -----------------------------------------------------------------------
  // 6.9–6.10: Case-insensitive canonicalization (PERMANENT GUARANTEE)
  // -----------------------------------------------------------------------

  it("6.9 — normalizeIdentifier canonicalizes to uppercase", async () => {
    const { normalizeIdentifier } = await import("@/lib/identifier");

    expect(normalizeIdentifier("AbC123")).toBe("ABC123");
    expect(normalizeIdentifier("abc")).toBe("ABC");
    expect(normalizeIdentifier("23bai10812")).toBe("23BAI10812");
  });

  it("6.10 — '23bai10812' and '23BAI10812' produce identical hashes (case-insensitive guarantee)", async () => {
    const { hashIdentifier } = await import("@/lib/identifier");

    const salt = "inst-uuid-1";
    const a = hashIdentifier("23bai10812", salt);
    const b = hashIdentifier("23BAI10812", salt);

    expect(a).toBe(b);
  });

  it("6.11 — mixed-case inputs hash identically through the full route", async () => {
    const insertMockA = vi.fn().mockResolvedValue({
      id: "id-a",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMockA,
    }));

    const routeA = await import("@/app/api/me/identifiers/route");

    await routeA.POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "23bai10812",
      }),
    );

    const [, , hashA] = insertMockA.mock.calls[0];

    // Reset and send the uppercase variant
    vi.resetModules();
    mockEncryption(); // Re-register after resetModules

    const insertMockB = vi.fn().mockResolvedValue({
      id: "id-b",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMockB,
    }));

    const routeB = await import("@/app/api/me/identifiers/route");

    await routeB.POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "23BAI10812",
      }),
    );

    const [, , hashB] = insertMockB.mock.calls[0];

    // PERMANENT GUARANTEE: both produce the exact same hash
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Encryption storage guarantees
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 7 — Encryption storage guarantees", () => {
  // A valid 256-bit (64 hex char) test key for real encryption tests.
  const TEST_ENCRYPTION_KEY =
    "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  afterEach(() => {
    // Clean up test encryption key to avoid polluting other tests
    delete process.env.DATASET_ENCRYPTION_KEY;
  });

  // -----------------------------------------------------------------------
  // 7.1: After POST, DB receives encrypted bytea, not plaintext
  // -----------------------------------------------------------------------

  it("7.1 — insertUserIdentifier receives encrypted Buffer, not plaintext", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "23bai10812",
      }),
    );

    expect(insertMock).toHaveBeenCalledOnce();

    const [, , hash, encryptedBuf] = insertMock.mock.calls[0];

    // Hash is present and valid
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    // 4th argument is a Buffer (encrypted bytea)
    expect(Buffer.isBuffer(encryptedBuf)).toBe(true);

    // Encrypted buffer does NOT contain plaintext identifier
    const bufStr = encryptedBuf.toString("utf8");
    expect(bufStr).not.toContain("23bai10812");
    expect(bufStr).not.toContain("23BAI10812");
  });

  // -----------------------------------------------------------------------
  // 7.2: GET returns decrypted canonical uppercase value
  // -----------------------------------------------------------------------

  it("7.2 — GET /api/me/identifiers returns decrypted canonical uppercase value", async () => {
    // Reset modules + switch to REAL AES-256-GCM encryption.
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    // Encrypt a canonical value using the real module
    const { encryptPayload, toBuffer } = await import("@/lib/encryption");
    const canonicalValue = "23BAI10812";
    const encryptedBuffer = toBuffer(encryptPayload(canonicalValue));

    // Reset modules so the route import gets fresh modules
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getUserEncryptedIdentifiers: vi.fn().mockResolvedValue([
        { type: "reg_no", identifier_encrypted: encryptedBuffer },
      ]),
    }));

    const { GET } = await import("@/app/api/me/identifiers/route");

    const response = await GET(
      new Request("http://localhost/api/me/identifiers", {
        method: "GET",
      }) as any,
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toEqual([{ type: "reg_no", value: "23BAI10812" }]);
  });

  // -----------------------------------------------------------------------
  // 7.3: Decrypted value re-hashed equals stored hash
  // -----------------------------------------------------------------------

  it("7.3 — decrypted identifier re-hashed equals the stored identifier_hash", async () => {
    // Reset + real crypto for full round-trip: encrypt → decrypt → re-hash.
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    const { encryptPayload, toBuffer, fromBuffer, decryptPayload } =
      await import("@/lib/encryption");
    const { hashIdentifier, normalizeIdentifier } = await import(
      "@/lib/identifier"
    );

    const rawInput = "23bai10812";
    const normalized = normalizeIdentifier(rawInput); // "23BAI10812"
    const salt = INSTITUTE.id;

    // Step 1: Hash (same as POST endpoint)
    const hash = hashIdentifier(normalized, salt);

    // Step 2: Encrypt (same as POST endpoint)
    const encrypted = encryptPayload(normalized);
    const encryptedBuffer = toBuffer(encrypted);

    // Step 3: Decrypt (same as GET endpoint)
    const decrypted = decryptPayload<string>(fromBuffer(encryptedBuffer));

    // Step 4: Re-hash the decrypted value
    const reHash = hashIdentifier(decrypted, salt);

    // GUARANTEE: decrypt → re-hash produces the same hash
    expect(decrypted).toBe("23BAI10812");
    expect(reHash).toBe(hash);
    expect(reHash).toBe(expectedHash(rawInput, salt));
  });

  // -----------------------------------------------------------------------
  // 7.4: GET response never contains hash or encrypted value
  // -----------------------------------------------------------------------

  it("7.4 — GET response contains only type + decrypted value, never hash", async () => {
    // Reset + real crypto to verify response shape.
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    const { encryptPayload, toBuffer } = await import("@/lib/encryption");
    const { hashIdentifier } = await import("@/lib/identifier");

    const value = "REG001";
    const hash = hashIdentifier(value, INSTITUTE.id);
    const encryptedBuffer = toBuffer(encryptPayload(value));

    // Reset so route import gets fresh modules with real encryption
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getUserEncryptedIdentifiers: vi.fn().mockResolvedValue([
        { type: "reg_no", identifier_encrypted: encryptedBuffer },
      ]),
    }));

    const { GET } = await import("@/app/api/me/identifiers/route");

    const response = await GET(
      new Request("http://localhost/api/me/identifiers", {
        method: "GET",
      }) as any,
    );

    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    // Must not contain the hash
    expect(bodyStr).not.toContain(hash);

    // Must not contain base64 encrypted data
    expect(body).toEqual([{ type: "reg_no", value: "REG001" }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: Final security guarantees (end-to-end)
// ═══════════════════════════════════════════════════════════════════════════

describe("Test 8 — Final security guarantees", () => {
  const TEST_ENCRYPTION_KEY =
    "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  afterEach(() => {
    delete process.env.DATASET_ENCRYPTION_KEY;
  });

  // -----------------------------------------------------------------------
  // 8.1: Full POST → GET round-trip — no plaintext at any boundary
  // -----------------------------------------------------------------------

  it("8.1 — POST stores encrypted blob; GET decrypts to canonical uppercase; no plaintext leak", async () => {
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    // ---- Phase A: POST — capture what gets "stored" ----
    const insertMock = vi.fn().mockResolvedValue({
      id: "new-id",
      created_at: new Date(),
    });

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getInstituteById: vi.fn().mockResolvedValue(INSTITUTE),
      getUserIdentifierHashes: vi.fn().mockResolvedValue([]),
      insertUserIdentifier: insertMock,
    }));

    const { POST } = await import("@/app/api/me/identifiers/route");

    const postRes = await POST(
      jsonRequest("http://localhost/api/me/identifiers", {
        type: "reg_no",
        value: "23bai10812",
      }),
    );

    expect(postRes.status).toBe(201);
    expect(insertMock).toHaveBeenCalledOnce();

    const [userId, type, storedHash, storedEncryptedBuf] =
      insertMock.mock.calls[0];

    // Stored hash is NOT plaintext
    expect(storedHash).not.toBe("23bai10812");
    expect(storedHash).not.toBe("23BAI10812");
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);

    // Stored encrypted buffer is NOT plaintext
    expect(Buffer.isBuffer(storedEncryptedBuf)).toBe(true);
    const encBufStr = storedEncryptedBuf.toString("utf8");
    expect(encBufStr).not.toContain("23bai10812");
    expect(encBufStr).not.toContain("23BAI10812");

    // ---- Phase B: GET — decrypt what was "stored" ----
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getUserEncryptedIdentifiers: vi.fn().mockResolvedValue([
        { type: "reg_no", identifier_encrypted: storedEncryptedBuf },
      ]),
    }));

    const { GET } = await import("@/app/api/me/identifiers/route");

    const getRes = await GET(
      new Request("http://localhost/api/me/identifiers", {
        method: "GET",
      }) as any,
    );

    expect(getRes.status).toBe(200);
    const body = await getRes.json();

    // Decrypted value is the canonical uppercase form
    expect(body).toEqual([{ type: "reg_no", value: "23BAI10812" }]);
  });

  // -----------------------------------------------------------------------
  // 8.2: Decryption is server-only — no key or plaintext in response
  // -----------------------------------------------------------------------

  it("8.2 — response from GET never contains encryption key, hash, or raw ciphertext", async () => {
    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    const { encryptPayload, toBuffer } = await import("@/lib/encryption");
    const encryptedBuffer = toBuffer(encryptPayload("TESTVALUE"));

    vi.resetModules();
    useRealEncryption(TEST_ENCRYPTION_KEY);

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(STUDENT_SESSION),
    }));

    vi.doMock("@/lib/database", () => ({
      getUserEncryptedIdentifiers: vi.fn().mockResolvedValue([
        { type: "reg_no", identifier_encrypted: encryptedBuffer },
      ]),
    }));

    const { GET } = await import("@/app/api/me/identifiers/route");

    const res = await GET(
      new Request("http://localhost/api/me/identifiers", {
        method: "GET",
      }) as any,
    );

    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    // Must not contain the encryption key
    expect(bodyStr).not.toContain(TEST_ENCRYPTION_KEY);

    // Must not contain base64 ciphertext fragments
    expect(bodyStr).not.toContain("ciphertext");
    expect(bodyStr).not.toContain("authTag");
    expect(bodyStr).not.toContain("iv:");

    // Must only contain the clean decrypted value
    expect(body).toEqual([{ type: "reg_no", value: "TESTVALUE" }]);
  });
});
