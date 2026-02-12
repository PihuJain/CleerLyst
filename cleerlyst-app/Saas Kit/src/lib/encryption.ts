import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { config } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Wire format returned by encrypt / consumed by decrypt. */
export interface EncryptedPayload {
  /** Base64-encoded 12-byte initialisation vector */
  iv: string;
  /** Base64-encoded 16-byte GCM authentication tag */
  authTag: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
}

// ---------------------------------------------------------------------------
// Key — validated once at boot by config.ts, never re-read
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12; // NIST-recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * 256-bit key derived from the hex string validated by config.ts.
 * Lazy — only resolved on first encrypt/decrypt call, not at import time.
 * This prevents build failures when env vars aren't available (Vercel build step).
 */
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (!_key) {
    _key = Buffer.from(config.encryptionKey, "hex");
  }
  return _key;
}

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts an arbitrary JSON-serialisable payload using AES-256-GCM.
 *
 * @param payload  - Any value that can be passed to JSON.stringify
 * @returns        - { iv, authTag, ciphertext } — all base64-encoded strings
 */
export function encryptPayload(payload: unknown): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: TAG_LENGTH,
  });

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypts a payload previously encrypted by {@link encryptPayload}.
 *
 * Returns the parsed JSON object. The decrypted plaintext is NEVER logged.
 *
 * @param encrypted - The { iv, authTag, ciphertext } object (base64 strings)
 * @returns         - The original JSON payload
 * @throws          - If the auth tag verification fails (tampered data)
 */
export function decryptPayload<T = unknown>(encrypted: EncryptedPayload): T {
  const iv = Buffer.from(encrypted.iv, "base64");
  const authTag = Buffer.from(encrypted.authTag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

// ---------------------------------------------------------------------------
// Helpers for DB storage
// ---------------------------------------------------------------------------

/**
 * Serialises an {@link EncryptedPayload} into a single Buffer suitable for
 * storage in a `bytea` column.
 *
 * Layout: [12 iv][16 authTag][…ciphertext]
 */
export function toBuffer(encrypted: EncryptedPayload): Buffer {
  return Buffer.concat([
    Buffer.from(encrypted.iv, "base64"),
    Buffer.from(encrypted.authTag, "base64"),
    Buffer.from(encrypted.ciphertext, "base64"),
  ]);
}

/**
 * Deserialises a `bytea` Buffer back into an {@link EncryptedPayload}.
 */
export function fromBuffer(buf: Buffer): EncryptedPayload {
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_BYTES + TAG_LENGTH);

  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}
