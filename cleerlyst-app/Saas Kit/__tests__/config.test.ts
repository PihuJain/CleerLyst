import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid 64-char hex key for tests that need encryption to pass. */
const VALID_KEY = "a".repeat(64);

/** Snapshot + restore process.env around each test. */
let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  // Reset module registry so config.ts re-evaluates on every import
  vi.resetModules();
});

afterEach(() => {
  process.env = envBackup;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("config.ts — fail-fast environment validation", () => {
  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.DATASET_ENCRYPTION_KEY = VALID_KEY;

    await expect(() => import("@/lib/config")).rejects.toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("throws when DATASET_ENCRYPTION_KEY is missing", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    delete process.env.DATASET_ENCRYPTION_KEY;

    await expect(() => import("@/lib/config")).rejects.toThrow(
      "Missing required environment variable: DATASET_ENCRYPTION_KEY",
    );
  });

  it("throws when DATASET_ENCRYPTION_KEY is not 64 hex chars (too short)", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = "abcdef";

    await expect(() => import("@/lib/config")).rejects.toThrow(
      "Invalid DATASET_ENCRYPTION_KEY: must be exactly 64 hexadecimal characters",
    );
  });

  it("throws when DATASET_ENCRYPTION_KEY contains non-hex characters", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = "g".repeat(64);

    await expect(() => import("@/lib/config")).rejects.toThrow(
      "Invalid DATASET_ENCRYPTION_KEY: must be exactly 64 hexadecimal characters",
    );
  });

  it("throws when NODE_ENV is 'production' and NEXT_PUBLIC_BASE_URL is missing", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = VALID_KEY;
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_BASE_URL;

    await expect(() => import("@/lib/config")).rejects.toThrow(
      "Missing required environment variable in production: NEXT_PUBLIC_BASE_URL",
    );
  });

  it("does NOT throw when NODE_ENV is 'development' and NEXT_PUBLIC_BASE_URL is missing", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = VALID_KEY;
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const mod = await import("@/lib/config");
    expect(mod.config.databaseUrl).toBe("postgres://localhost/test");
    expect(mod.config.encryptionKey).toBe(VALID_KEY);
    expect(mod.config.baseUrl).toBeUndefined();
    expect(mod.config.isProduction).toBe(false);
  });

  it("exports a frozen config object when all vars are valid", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = VALID_KEY;
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";

    const mod = await import("@/lib/config");
    expect(mod.config).toEqual({
      databaseUrl: "postgres://localhost/test",
      encryptionKey: VALID_KEY,
      baseUrl: "https://example.com",
      nodeEnv: "production",
      isProduction: true,
    });
    expect(Object.isFrozen(mod.config)).toBe(true);
  });

  it("rejects mutation of the config object", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.DATASET_ENCRYPTION_KEY = VALID_KEY;
    process.env.NODE_ENV = "development";

    const mod = await import("@/lib/config");
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod.config as any).databaseUrl = "postgres://hacked";
    }).toThrow();
  });
});
