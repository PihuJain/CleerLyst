import { createHash } from "crypto";

/**
 * Produces a SHA-256 hex digest from a value and an institute-specific salt.
 *
 * Steps:
 *   1. Normalise the value to lowercase.
 *   2. Concatenate: lowercase(value) + salt.
 *   3. Return the SHA-256 hash as a hex string.
 *
 * Used for hashing emails, registration numbers, and any other
 * identity-bound identifier before storage or lookup.
 *
 * @param value          - The plaintext identifier (email, reg_no, etc.)
 * @param instituteSalt  - Per-institute salt to prevent cross-institute rainbow tables
 * @returns              - Lowercase hex-encoded SHA-256 digest
 */
export function hashIdentifier(
  value: string,
  instituteSalt: string,
): string {
  const normalised = value.toLowerCase();
  return createHash("sha256")
    .update(normalised + instituteSalt)
    .digest("hex");
}
