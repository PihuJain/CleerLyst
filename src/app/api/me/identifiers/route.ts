import { NextRequest, NextResponse } from "next/server";
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
import { logInfo, logError } from "@/lib/logger";
import { withApiHandler, type HandlerSession } from "@/lib/api-handler";
import {
  unauthorized,
  badRequest,
  rateLimited,
  internalError,
} from "@/lib/errors";
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
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ["reg_no", "roll_no"] as const;

async function postHandler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;
  const { instituteId } = session.user;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `identifier-add:${userId}:${ip}`,
    5,
    60_000,
  );
  if (!allowed) throw rateLimited();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Invalid JSON body", "INVALID_JSON");
  }

  const { type, value } = body;

  if (typeof type !== "string") {
    throw badRequest("type must be a string", "INVALID_TYPE");
  }

  if (typeof value !== "string") {
    throw badRequest("value must be a string", "INVALID_VALUE");
  }

  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    throw badRequest(
      `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      "INVALID_IDENTIFIER_TYPE",
    );
  }

  let normalized: string;
  try {
    normalized = normalizeIdentifier(value);
  } catch (err) {
    throw badRequest(
      (err as Error).message,
      "INVALID_IDENTIFIER_VALUE",
    );
  }

  const institute = await getInstituteById(instituteId);
  if (!institute) {
    throw badRequest("Institute not found", "INSTITUTE_NOT_FOUND");
  }

  const existingHashes = await getUserIdentifierHashes(userId, type);
  if (existingHashes.length > 0) {
    throw badRequest("identifier_already_exists", "IDENTIFIER_ALREADY_EXISTS");
  }

  const identifierHash = hashIdentifier(normalized, institute.id);
  const encrypted = encryptPayload(normalized);
  const identifierEncrypted = toBuffer(encrypted);

  try {
    await insertUserIdentifier(userId, type, identifierHash, identifierEncrypted);
  } catch (err) {
    const pgError = err as { code?: string; constraint?: string };
    if (pgError.code === "23505") {
      if (pgError.constraint === "uq_user_identifiers_user_type") {
        throw badRequest("identifier_already_exists", "IDENTIFIER_ALREADY_EXISTS");
      }
      throw badRequest("identifier_already_registered", "IDENTIFIER_ALREADY_REGISTERED");
    }
    logError("identifier.add.insert_failed", { userId, type, pgCode: pgError.code });
    throw internalError("Failed to add identifier");
  }

  logInfo("identifier_added", { userId, type });

  return NextResponse.json({ success: true }, { status: 201 });
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
// ---------------------------------------------------------------------------

async function getHandler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  if (!session) throw unauthorized();

  const userId = session.user.id;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `identifier-list:${userId}:${ip}`,
    30,
    60_000,
  );
  if (!allowed) throw rateLimited();

  let rows: Array<{ type: string; identifier_encrypted: Buffer }>;
  try {
    rows = await getUserEncryptedIdentifiers(userId);
  } catch (err) {
    logError("identifier.list.fetch_failed", { userId }, err);
    throw internalError("Failed to fetch identifiers");
  }

  const identifiers: Array<{ type: string; value: string }> = [];

  for (const row of rows) {
    try {
      const enc = fromBuffer(row.identifier_encrypted);
      const decrypted = decryptPayload<string>(enc);
      identifiers.push({ type: row.type, value: decrypted });
    } catch {
      logError("identifier.list.decrypt_failed", { userId, type: row.type });
      throw internalError("Decryption failed");
    }
  }

  logInfo("identifier_listed", { userId, count: identifiers.length });

  return NextResponse.json(identifiers, { status: 200 });
}

export const POST = withApiHandler(postHandler);
export const GET = withApiHandler(getHandler);
