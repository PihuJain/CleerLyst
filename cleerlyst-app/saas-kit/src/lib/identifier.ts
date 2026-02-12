import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IDENTIFIER_LENGTH = 128;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalises a raw identifier value into a canonical, case-insensitive form.
 *
 * Rules:
 *   - Trims leading and trailing whitespace.
 *   - Converts to **UPPERCASE** — identifiers are case-insensitive.
 *   - Does **not** cast to number — preserves leading zeros (e.g. "007").
 *   - Throws on empty-after-trim or exceeding {@link MAX_IDENTIFIER_LENGTH}.
 *
 * Why uppercase:
 *   Institutional identifiers (reg_no, roll_no) are case-insensitive.
 *   Without canonicalization, "23BAI10812" and "23bai10812" produce
 *   different hashes — causing silent match failures. Uppercasing once
 *   at the normalization layer eliminates this entire class of bugs.
 *
 * @param value - The raw identifier string (reg_no, roll_no, etc.)
 * @returns     - The trimmed, uppercased canonical identifier.
 * @throws      - If the value is empty after trimming.
 * @throws      - If the trimmed value exceeds 128 characters.
 */
export function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error("Identifier must not be empty after trimming.");
  }

  if (trimmed.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `Identifier exceeds maximum length of ${MAX_IDENTIFIER_LENGTH} characters.`,
    );
  }

  return trimmed.toUpperCase();
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Produces a SHA-256 hex digest from a normalised identifier and an
 * institute-specific salt.
 *
 * Steps:
 *   1. Normalise the value via {@link normalizeIdentifier}.
 *   2. Concatenate: normalised value + instituteSalt.
 *   3. Return the SHA-256 hash as a lowercase hex string.
 *
 * Security:
 *   - The plaintext value is **never** logged.
 *   - The resulting hash is **never** logged.
 *   - Per-institute salt prevents cross-institute rainbow-table attacks.
 *
 * @param value          - The plaintext identifier (email, reg_no, etc.)
 * @param instituteSalt  - Per-institute salt sourced from the database.
 * @returns              - Lowercase hex-encoded SHA-256 digest.
 */
export function hashIdentifier(
  value: string,
  instituteSalt: string,
): string {
  const normalised = normalizeIdentifier(value);

  return createHash("sha256")
    .update(normalised + instituteSalt)
    .digest("hex");
}
