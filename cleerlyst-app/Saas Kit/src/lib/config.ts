const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const encryptionKey = process.env.DATASET_ENCRYPTION_KEY;
if (!encryptionKey) {
  throw new Error(
    "Missing required environment variable: DATASET_ENCRYPTION_KEY"
  );
}
if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) {
  throw new Error(
    "Invalid DATASET_ENCRYPTION_KEY: must be exactly 64 hexadecimal characters"
  );
}

const nodeEnv = process.env.NODE_ENV;
const isProduction = nodeEnv === "production";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
if (isProduction && !baseUrl) {
  throw new Error(
    "Missing required environment variable in production: NEXT_PUBLIC_BASE_URL"
  );
}

export const config = Object.freeze({
  databaseUrl,
  encryptionKey,
  baseUrl,
  nodeEnv,
  isProduction,
});
