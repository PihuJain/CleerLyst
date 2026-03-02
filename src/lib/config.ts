// ---------------------------------------------------------------------------
// Runtime configuration — validated lazily for Vercel compatibility
// ---------------------------------------------------------------------------
//
// On Vercel, env vars may not be available during the build step
// (page data collection). We use getters so validation only runs
// when a value is actually accessed at runtime, not at import time.
// ---------------------------------------------------------------------------

const nodeEnv = process.env.NODE_ENV;
const isProduction = nodeEnv === "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = Object.freeze({
  get databaseUrl(): string {
    return requireEnv("DATABASE_URL");
  },

  get encryptionKey(): string {
    const key = requireEnv("DATASET_ENCRYPTION_KEY");
    if (!/^[a-f0-9]{64}$/i.test(key)) {
      throw new Error(
        "Invalid DATASET_ENCRYPTION_KEY: must be exactly 64 hexadecimal characters",
      );
    }
    return key;
  },

  get baseUrl(): string | undefined {
    const url = process.env.NEXT_PUBLIC_BASE_URL;
    if (isProduction && !url) {
      throw new Error(
        "Missing required environment variable in production: NEXT_PUBLIC_BASE_URL",
      );
    }
    return url;
  },

  nodeEnv,
  isProduction,
});
