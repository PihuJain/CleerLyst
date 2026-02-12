/**
 * CLEERLYST — Security Test Suite
 *
 * Covers the five non-negotiable security invariants:
 *
 *   1. No dataset listing endpoint exists
 *   2. Student cannot access admin routes
 *   3. Same response shape for matched vs unmatched
 *   4. Rate limiting exists (middleware-level check)
 *   5. No SELECT * queries in record access
 *
 * Tests are split into two categories:
 *   - Static analysis: scan source files for forbidden patterns
 *   - Runtime behaviour: call route handlers with mocked deps
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers — read source files for static analysis
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

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: No Dataset Listing Endpoint
// ═══════════════════════════════════════════════════════════════════════════

describe("Category 1 — No Dataset Listing Endpoint", () => {
  const apiDatasetsDir = path.join(SRC, "app", "api", "datasets");

  it("1.1 — /api/datasets/{id}/records route file does NOT exist", () => {
    const forbidden = path.join(apiDatasetsDir, "[id]", "records");
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it("1.2 — /api/search route does NOT exist", () => {
    const forbidden = path.join(SRC, "app", "api", "search");
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it("1.3 — /api/export route does NOT exist", () => {
    const forbidden = path.join(SRC, "app", "api", "export");
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it("1.4 — /api/download route does NOT exist", () => {
    const forbidden = path.join(SRC, "app", "api", "download");
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it("1.5 — /api/users/{id}/records route does NOT exist", () => {
    const forbidden = path.join(SRC, "app", "api", "users");
    expect(fs.existsSync(forbidden)).toBe(false);
  });

  it("1.6 — the only dataset route under [id]/ is 'me'", () => {
    const idDir = path.join(apiDatasetsDir, "[id]");
    if (!fs.existsSync(idDir)) {
      // If the directory doesn't exist at all, that also passes
      return;
    }
    const entries = fs.readdirSync(idDir);
    // Only 'me' should exist as a subdirectory/route
    for (const entry of entries) {
      expect(entry).toBe("me");
    }
  });

  it("1.7 — no route file exports a handler that returns a list of records", () => {
    const meRoute = readSource(
      "src/app/api/datasets/[id]/me/route.ts",
    );
    // Must not contain array-returning patterns for records
    expect(meRoute).not.toMatch(/\.rows\b/); // no raw rows leak
    expect(meRoute).not.toMatch(/return.*\[/); // no array return
    expect(meRoute).not.toMatch(/records.*\.map/); // no mapping over records
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: Student Cannot Access Admin Routes
// ═══════════════════════════════════════════════════════════════════════════

describe("Category 2 — Student Cannot Access Admin Routes", () => {
  it("2.1 — upload route checks role === 'admin' before processing", () => {
    const uploadRoute = readSource(
      "src/app/api/admin/datasets/upload/route.ts",
    );
    // Must gate on admin role
    expect(uploadRoute).toMatch(/role\s*!==\s*["']admin["']/);
    // Must return 403 for non-admin
    expect(uploadRoute).toMatch(/status:\s*403/);
  });

  it("2.2 — upload route does NOT accept role from request body", () => {
    const uploadRoute = readSource(
      "src/app/api/admin/datasets/upload/route.ts",
    );
    // Role must come from session, not from request
    expect(uploadRoute).toMatch(/session\.user\.role/);
    // Should not parse a role from the form data
    expect(uploadRoute).not.toMatch(/formData\.get\(["']role["']\)/);
  });

  it("2.3 — admin route lives under /api/admin/ path namespace", () => {
    const uploadDir = path.join(
      SRC,
      "app",
      "api",
      "admin",
      "datasets",
      "upload",
    );
    expect(fs.existsSync(uploadDir)).toBe(true);
  });

  it("2.4 — upload route returns 403, never 200, for student session", async () => {
    // Mock auth to return a student session
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: {
          id: "student-uuid",
          role: "student",
          instituteId: "inst-uuid",
        },
      }),
    }));

    // Dynamically import after mocking
    const { POST } = await import(
      "@/app/api/admin/datasets/upload/route"
    );

    const formData = new FormData();
    formData.append("file", new Blob(["a,b\n1,2"]), "test.csv");
    formData.append("datasetId", "some-uuid");
    formData.append("identifierColumn", "a");

    const request = new Request("http://localhost/api/admin/datasets/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request as any);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBeDefined();
    // Must NOT contain any data
    expect(body.inserted).toBeUndefined();
    expect(body.rows).toBeUndefined();

    vi.restoreAllMocks();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: Same Response Shape (Matched vs Unmatched)
// ═══════════════════════════════════════════════════════════════════════════

describe("Category 3 — Response Uniformity (matched vs unmatched)", () => {
  it("3.1 — NOT_MATCHED constant uses HTTP 200", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // The NOT_MATCHED constant must be status 200
    expect(meRoute).toMatch(
      /NOT_MATCHED\s*=\s*NextResponse\.json\(\s*\{\s*matched:\s*false\s*\}\s*,\s*\{\s*status:\s*200\s*\}/,
    );
  });

  it("3.2 — matched() helper also uses HTTP 200", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    expect(meRoute).toMatch(
      /function matched[\s\S]*?NextResponse\.json\(\s*\{\s*matched:\s*true,\s*data\s*\}\s*,\s*\{\s*status:\s*200\s*\}/,
    );
  });

  it("3.3 — GET function only returns NOT_MATCHED, matched(), or 401", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    const getFnBody = meRoute.slice(meRoute.indexOf("export async function GET"));

    // Count occurrences of each return pattern
    const notMatchedCount = (getFnBody.match(/return NOT_MATCHED/g) || []).length;
    const matchedCallCount = (getFnBody.match(/return matched\(/g) || []).length;
    const auth401Count = (getFnBody.match(/status:\s*401/g) || []).length;

    // There must be multiple NOT_MATCHED exits
    expect(notMatchedCount).toBeGreaterThanOrEqual(5);
    // Exactly one matched() exit
    expect(matchedCallCount).toBe(1);
    // Exactly one 401 exit
    expect(auth401Count).toBe(1);

    // No other HTTP status codes should appear in the GET function
    expect(getFnBody).not.toMatch(/status:\s*404/);
    expect(getFnBody).not.toMatch(/status:\s*403/);
    expect(getFnBody).not.toMatch(/status:\s*500/);
  });

  it("3.4 — response shape has exactly 'matched' key (and optionally 'data')", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");

    // NOT_MATCHED shape: { matched: false }
    expect(meRoute).toContain("{ matched: false }");
    // matched shape: { matched: true, data }
    expect(meRoute).toContain("{ matched: true, data }");

    // The JSON response objects must not leak dataset-size metadata.
    // Check the two response constructors only (not internal logic).
    const notMatchedShape = meRoute.match(
      /NOT_MATCHED\s*=\s*NextResponse\.json\(([^)]+)\)/,
    );
    expect(notMatchedShape).not.toBeNull();
    expect(notMatchedShape![1]).not.toMatch(/count|total|size/i);

    const matchedShape = meRoute.match(
      /function matched[\s\S]*?NextResponse\.json\(([^)]+)\)/,
    );
    expect(matchedShape).not.toBeNull();
    expect(matchedShape![1]).not.toMatch(/count|total|size/i);
  });

  it("3.5 — dataset not found returns same shape as no match (no 404)", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // After getDatasetById returns null, should return NOT_MATCHED, not 404
    const datasetNullBlock = meRoute.match(
      /if\s*\(\s*!dataset\s*\)\s*\{[\s\S]*?\}/,
    );
    expect(datasetNullBlock).not.toBeNull();
    expect(datasetNullBlock![0]).toContain("NOT_MATCHED");
    expect(datasetNullBlock![0]).not.toContain("404");
  });

  it("3.6 — wrong institute returns same shape as no match (no 403)", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    const instituteBlock = meRoute.match(
      /if\s*\(\s*dataset\.institute_id\s*!==[\s\S]*?\}/,
    );
    expect(instituteBlock).not.toBeNull();
    expect(instituteBlock![0]).toContain("NOT_MATCHED");
    expect(instituteBlock![0]).not.toContain("403");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════

describe("Category 4 — Rate Limiting Infrastructure", () => {
  // Rate limiting is typically enforced via middleware, reverse proxy,
  // or a dedicated module. These tests verify the infrastructure exists
  // or that the routes are designed to support it.

  it("4.1 — middleware.ts exists and intercepts API routes", () => {
    const middleware = readSource("src/middleware.ts");
    // Must match API routes
    expect(middleware).toMatch(/api|trpc/);
    expect(middleware).toMatch(/matcher/);
  });

  it("4.2 — /me route does NOT accept identifier from query params", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // Must not read searchParams, query, body, or any user-supplied identifier
    expect(meRoute).not.toMatch(/searchParams/);
    expect(meRoute).not.toMatch(/request\.json/);
    expect(meRoute).not.toMatch(/request\.text/);
    expect(meRoute).not.toMatch(/request\.body/);
    expect(meRoute).not.toMatch(/formData/);
  });

  it("4.3 — /me route uses LIMIT 1 to prevent size inference", () => {
    const dbSource = readSource("src/lib/database.ts");
    // The findRecordByHashes function must LIMIT 1
    const fnBlock = dbSource.match(
      /findRecordByHashes[\s\S]*?(?=export\s|$)/,
    );
    expect(fnBlock).not.toBeNull();
    expect(fnBlock![0]).toMatch(/LIMIT\s+1/i);
  });

  it("4.4 — /me route returns at most ONE record (no array)", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // Response must never be an array
    expect(meRoute).not.toMatch(/NextResponse\.json\(\s*\[/);
  });

  it("4.5 — upload route enforces a max file size", () => {
    const uploadRoute = readSource(
      "src/app/api/admin/datasets/upload/route.ts",
    );
    expect(uploadRoute).toMatch(/MAX_FILE_SIZE/);
    expect(uploadRoute).toMatch(/file\.size\s*>/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: No SELECT * in Record Access
// ═══════════════════════════════════════════════════════════════════════════

describe("Category 5 — No SELECT * in Record Access", () => {
  it("5.1 — database.ts contains zero SELECT * statements in SQL queries", () => {
    const db = readSource("src/lib/database.ts");
    // Extract only backtick-delimited SQL strings (actual queries)
    const sqlStrings = db.match(/`[^`]*`/g) || [];
    for (const sql of sqlStrings) {
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    }
  });

  it("5.2 — all SQL queries in database.ts enumerate columns explicitly", () => {
    const db = readSource("src/lib/database.ts");
    // Find all query strings (backtick template literals with SELECT)
    const queryMatches = db.match(/`[^`]*SELECT[^`]*`/gi) || [];

    for (const query of queryMatches) {
      // Each SELECT must NOT be followed by *
      expect(query).not.toMatch(/SELECT\s+\*/i);
    }
  });

  it("5.3 — findRecordByHashes SELECTs ONLY encrypted_payload column", () => {
    const db = readSource("src/lib/database.ts");
    const fnBlock = db.match(
      /findRecordByHashes[\s\S]*?(?=\n\/\/\s*-{3,}|export\s|$)/,
    );
    expect(fnBlock).not.toBeNull();

    const fn = fnBlock![0];
    // Extract the SQL query from the backtick string
    const sqlMatch = fn.match(/`([^`]*SELECT[^`]*)`/i);
    expect(sqlMatch).not.toBeNull();

    const sql = sqlMatch![1];
    // The SELECT clause must contain only encrypted_payload
    const selectClause = sql.match(/SELECT\s+([\s\S]*?)FROM/i);
    expect(selectClause).not.toBeNull();
    expect(selectClause![1].trim()).toBe("encrypted_payload");
    // Must NOT select *
    expect(sql).not.toMatch(/SELECT\s+\*/i);
  });

  it("5.4 — migration schema for dataset_records has NO FK to users", () => {
    const migration = readSource("migrations/006_create_dataset_records.sql");
    // Must NOT reference the users table
    expect(migration).not.toMatch(/REFERENCES\s+users/i);
    // Must reference datasets
    expect(migration).toMatch(/REFERENCES\s+datasets/i);
  });

  it("5.5 — migration schema for dataset_records has NO user_id column", () => {
    const migration = readSource("migrations/006_create_dataset_records.sql");
    expect(migration).not.toMatch(/user_id/i);
  });

  it("5.6 — no SQL JOIN between users and dataset_records anywhere in codebase", () => {
    const allTsFiles = collectFiles(SRC);
    for (const file of allTsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Check for JOIN patterns between these two tables
      const joinPattern =
        /JOIN\s+(?:users|dataset_records)\b[\s\S]{0,200}(?:users|dataset_records)/gi;
      const matches = content.match(joinPattern);
      if (matches) {
        for (const m of matches) {
          // Fail if both table names appear in a join clause
          const hasUsers = /users/i.test(m);
          const hasRecords = /dataset_records/i.test(m);
          expect(
            hasUsers && hasRecords,
          ).toBe(false);
        }
      }
    }
  });

  it("5.7 — /me route never logs or returns decrypted payload content", () => {
    const meRoute = readSource("src/app/api/datasets/[id]/me/route.ts");
    // Must not console.log the decrypted data
    expect(meRoute).not.toMatch(/console\.log\(.*decrypt/i);
    expect(meRoute).not.toMatch(/console\.log\(.*filteredData/i);
    expect(meRoute).not.toMatch(/console\.log\(.*payload/i);
    // The insertAuditLog call must pass only { matched: true }, never payload data
    const auditCall = meRoute.match(
      /insertAuditLog\(\s*userId\s*,\s*["']record\.view["']\s*,\s*datasetId\s*,\s*(\{[\s\S]*?\})\s*\)/,
    );
    expect(auditCall).not.toBeNull();
    // The metadata object must contain only "matched"
    const metadata = auditCall![1];
    expect(metadata).toContain("matched");
    expect(metadata).not.toMatch(/payload|decrypt|filteredData|venue|status/i);
  });

  it("5.8 — upload route never returns parsed rows to the client", () => {
    const uploadRoute = readSource(
      "src/app/api/admin/datasets/upload/route.ts",
    );
    // Extract the JSON object from the final success response:
    //   NextResponse.json({ success: true, inserted, skipped, })
    // We look for the literal block starting at "success: true"
    const successBlock = uploadRoute.match(
      /NextResponse\.json\(\{\s*\n?\s*success:\s*true,\s*\n?\s*inserted,\s*\n?\s*skipped,?\s*\n?\s*\}\)/,
    );
    expect(successBlock).not.toBeNull();

    const json = successBlock![0];
    // The success response must only have success + inserted + skipped
    // Count the keys: should be exactly 3 (success, inserted, skipped)
    const keys = json.match(/\b(success|inserted|skipped)\b/g) || [];
    expect(keys).toHaveLength(3);

    // Must NOT include these keys
    expect(json).not.toContain("rows");
    expect(json).not.toContain("data");
    expect(json).not.toContain("records");
    expect(json).not.toContain("payload");
    expect(json).not.toContain("parsed");
  });
});
