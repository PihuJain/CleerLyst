import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getInstituteById,
  getUserIdentifierHashes,
  getUserEncryptedIdentifiers,
  insertUserIdentifier,
} from "@/lib/database";
import { normalizeIdentifier, hashIdentifier } from "@/lib/identifier";
import {
  encryptPayload,
  decryptPayload,
  toBuffer,
  fromBuffer,
} from "@/lib/encryption";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/me/identifiers
// ---------------------------------------------------------------------------
//
// Allows an authenticated user to register a hashed identifier (reg_no or
// roll_no) against their account.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • Rate-limited: 5 requests per minute per user (anti brute-force).
//   • Identifier plaintext is NEVER logged, stored in cleartext, or returned.
//   • identifier_hash   — SHA-256 for matching (non-reversible).
//   • identifier_encrypted — AES-256-GCM ciphertext (recoverable with key).
//   • Identifier hash is NEVER logged or returned.
//   • Only allowed types: "reg_no", "roll_no".
//   • Institute salt (institute.id) is fetched per-request — never cached.
//   • Explicit column selection in all queries — no SELECT *.
//   • Unique constraint violations are surfaced as typed 400 errors.
//
// Request body:
//   { type: "reg_no" | "roll_no", value: string }
//
// Success response:
//   { success: true }
//
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ["reg_no", "roll_no"] as const;

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/identifiers" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        logWarn("identifier.add.unauthorized");
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;
      const { instituteId } = session.user;

      // ----- 1b. Rate limit (5 req/min per user) -----

      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const allowed = await rateLimiter.check(
        `identifier-add:${userId}:${ip}`,
        5,
        60_000,
      );

      if (!allowed) {
        logWarn("identifier.add.rate_limited");
        return NextResponse.json(
          { error: "rate_limited" },
          { status: 429 },
        );
      }

      // ----- 2. Parse and validate request body -----

      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      const { type, value } = body;

      if (typeof type !== "string") {
        return NextResponse.json(
          { error: "type must be a string" },
          { status: 400 },
        );
      }

      if (typeof value !== "string") {
        return NextResponse.json(
          { error: "value must be a string" },
          { status: 400 },
        );
      }

      if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
        return NextResponse.json(
          { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      // ----- 3. Normalize identifier (throws on invalid input) -----

      let normalized: string;
      try {
        normalized = normalizeIdentifier(value);
      } catch (err) {
        return NextResponse.json(
          { error: (err as Error).message },
          { status: 400 },
        );
      }

      // ----- 4. Fetch institute salt (institute.id) -----

      const institute = await getInstituteById(instituteId);
      if (!institute) {
        logWarn("identifier.add.institute_not_found", { instituteId });
        return NextResponse.json(
          { error: "Institute not found" },
          { status: 400 },
        );
      }

      // ----- 5. Check if user already has this identifier type -----

      const existingHashes = await getUserIdentifierHashes(userId, type);
      if (existingHashes.length > 0) {
        logWarn("identifier.add.already_exists", { userId, type });
        return NextResponse.json(
          { error: "identifier_already_exists" },
          { status: 400 },
        );
      }

      // ----- 6. Hash the identifier -----

      const identifierHash = hashIdentifier(normalized, institute.id);

      // ----- 6b. Encrypt the identifier (AES-256-GCM → BYTEA) -----

      const encryptedPayload = encryptPayload(normalized);
      const identifierEncrypted = toBuffer(encryptedPayload);

      // ----- 7. Insert into user_identifiers -----

      try {
        await insertUserIdentifier(userId, type, identifierHash, identifierEncrypted);
      } catch (err) {
        // Unique constraint violations (Postgres code 23505).
        // Two constraints can fire:
        //   uq_user_identifiers_user_type  → (user_id, type) duplicate
        //   uq_user_identifiers_type_hash  → (type, identifier_hash) duplicate
        const pgError = err as { code?: string; constraint?: string };
        if (pgError.code === "23505") {
          if (pgError.constraint === "uq_user_identifiers_user_type") {
            logWarn("identifier.add.already_exists", { userId, type });
            return NextResponse.json(
              { error: "identifier_already_exists" },
              { status: 400 },
            );
          }

          logWarn("identifier.add.already_registered", { userId, type });
          return NextResponse.json(
            { error: "identifier_already_registered" },
            { status: 400 },
          );
        }

        logError("identifier.add.insert_failed", {
          userId,
          type,
          pgCode: pgError.code,
        });
        return NextResponse.json(
          { error: "Failed to add identifier" },
          { status: 500 },
        );
      }

      // ----- 8. Audit log -----

      logInfo("identifier_added", { userId, type });

      return NextResponse.json({ success: true }, { status: 201 });
    },
  );
}

// ---------------------------------------------------------------------------
// GET /api/me/identifiers
// ---------------------------------------------------------------------------
//
// Returns the authenticated user's decrypted identifiers.
//
// SECURITY INVARIANTS:
//   • Auth required — 401 for unauthenticated callers.
//   • identifier_hash is NEVER returned.
//   • Decryption happens server-side only — plaintext never stored.
//   • Decrypted values are NEVER logged.
//   • Explicit column selection in all queries — no SELECT *.
//   • Fail loudly if decryption fails.
//
// Response:
//   [ { type: "reg_no", value: "23BAI10812" } ]
//
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/me/identifiers" },
    async () => {
      // ----- 1. Authenticate -----

      if (!session?.user?.id) {
        logWarn("identifier.list.unauthorized");
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const userId = session.user.id;

      // ----- 2. Fetch encrypted identifiers -----

      let rows: Array<{ type: string; identifier_encrypted: Buffer }>;
      try {
        rows = await getUserEncryptedIdentifiers(userId);
      } catch (err) {
        logError("identifier.list.fetch_failed", {
          userId,
          error: (err as Error).message,
        });
        return NextResponse.json(
          { error: "Failed to fetch identifiers" },
          { status: 500 },
        );
      }

      // ----- 3. Decrypt each identifier -----

      const identifiers: Array<{ type: string; value: string }> = [];

      for (const row of rows) {
        try {
          const encrypted = fromBuffer(row.identifier_encrypted);
          const decrypted = decryptPayload<string>(encrypted);
          identifiers.push({ type: row.type, value: decrypted });
        } catch (err) {
          // Decryption failure is critical — fail loudly
          logError("identifier.list.decrypt_failed", {
            userId,
            type: row.type,
          });
          return NextResponse.json(
            { error: "Decryption failed" },
            { status: 500 },
          );
        }
      }

      // ----- 4. Audit log -----

      logInfo("identifier_listed", { userId, count: identifiers.length });

      return NextResponse.json(identifiers, { status: 200 });
    },
  );
}
