#!/usr/bin/env npx tsx
// ============================================================================
// CLEERLYST MIGRATION RUNNER
// ============================================================================
//
// Usage:
//   DATABASE_URL="your_direct_connection_string" npx tsx scripts/migrate.ts
//
// Or via npm:
//   DATABASE_URL="your_direct_connection_string" npm run migrate
//
// Runs all migration files in order (001 through 015).
// Each migration is wrapped in its own transaction (BEGIN/COMMIT inside file).
// Safe to re-run — uses IF NOT EXISTS / IF NOT EXISTS throughout.
// ============================================================================

import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_FILES = [
  "001_extensions_and_enums.sql",
  "002_create_institutes.sql",
  "003_create_users.sql",
  "004_create_user_identifiers.sql",
  "005_create_datasets.sql",
  "006_create_dataset_records.sql",
  "007_create_notifications.sql",
  "008_create_audit_logs.sql",
  "009_add_user_identifiers_constraints.sql",
  "010_add_identifier_encrypted.sql",
  "011_add_dataset_headers.sql",
  "012_unique_dataset_identifier.sql",
  "013_add_dataset_audience_type.sql",
  "014_public_dataset_constraints.sql",
  "015_constraint_tightening.sql",
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    console.error("Usage: DATABASE_URL=\"your_connection_string\" npx tsx scripts/migrate.ts");
    process.exit(1);
  }

  console.log("=== Cleerlyst Migration Runner ===\n");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const migrationsDir = join(__dirname, "..", "migrations");

    for (const file of MIGRATION_FILES) {
      const filePath = join(migrationsDir, file);
      console.log(`Running: ${file} ...`);

      let sql: string;
      try {
        sql = readFileSync(filePath, "utf-8");
      } catch (err) {
        console.error(`  ERROR: Could not read ${filePath}`);
        throw err;
      }

      try {
        await client.query(sql);
        console.log(`  OK`);
      } catch (err) {
        console.error(`  FAILED: ${file}`);
        throw err;
      }
    }

    // Verify tables exist
    console.log("\n--- Verification ---");
    const tables = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    console.log("Tables:", tables.rows.map((r) => r.tablename).join(", "));

    const enums = await client.query<{ typname: string }>(
      `SELECT typname FROM pg_type WHERE typname IN (
        'user_role', 'identifier_type', 'dataset_type',
        'dataset_identifier_type', 'dataset_status', 'notification_type',
        'dataset_audience_type'
      ) ORDER BY typname`,
    );
    console.log("Enums:", enums.rows.map((r) => r.typname).join(", "));

    const extensions = await client.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`,
    );
    console.log(
      "pgcrypto:",
      extensions.rows.length > 0 ? "enabled" : "MISSING!",
    );

    console.log("\n=== All migrations complete ===");
  } catch (err) {
    console.error("\n[FATAL] Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
