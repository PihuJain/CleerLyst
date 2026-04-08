#!/usr/bin/env npx tsx
// ============================================================================
// CLEERLYST BOOTSTRAP SCRIPT
// ============================================================================
//
// Usage:
//   npx tsx scripts/bootstrap.ts
//
// What it does:
//   1. Creates an institute (if not exists) with the given name and domain.
//   2. Promotes a user to 'admin' by email (hashed — never stored in plain).
//
// Environment:
//   DATABASE_URL — required, Postgres connection string.
//
// This script is idempotent — safe to run multiple times.
// ============================================================================

import { Pool } from "pg";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Configuration — edit these values before running
// ---------------------------------------------------------------------------

const INSTITUTE_NAME = "My Institute";
const INSTITUTE_PRIMARY_DOMAIN = "example.edu";
const INSTITUTE_ALLOWED_DOMAINS = ["example.edu"]; // add more as needed

// The email of the user to promote to admin.
// The user must have logged in at least once (so a row exists in `users`).
const ADMIN_EMAIL = "admin@example.edu";

// ---------------------------------------------------------------------------
// Parse CLI overrides (optional)
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const instituteName = getArg("--name") ?? INSTITUTE_NAME;
const primaryDomain = getArg("--domain") ?? INSTITUTE_PRIMARY_DOMAIN;
const allowedDomainsRaw = getArg("--allowed-domains");
const allowedDomains = allowedDomainsRaw
  ? allowedDomainsRaw.split(",").map((d) => d.trim())
  : INSTITUTE_ALLOWED_DOMAINS;
const adminEmail = getArg("--admin-email") ?? ADMIN_EMAIL;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashIdentifier(value: string, salt: string): string {
  return createHash("sha256")
    .update(value.toLowerCase() + salt)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  console.log("=== Cleerlyst Bootstrap ===\n");
  console.log(`Institute:       ${instituteName}`);
  console.log(`Primary domain:  ${primaryDomain}`);
  console.log(`Allowed domains: ${allowedDomains.join(", ")}`);
  console.log(`Admin email:     ${adminEmail}`);
  console.log("");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ----- 1. Create or find institute -----

    const existingInstitute = await client.query<{
      id: string;
      name: string;
    }>(
      `SELECT id, name FROM institutes WHERE primary_domain = $1 LIMIT 1`,
      [primaryDomain],
    );

    let instituteId: string;

    if (existingInstitute.rows.length > 0) {
      instituteId = existingInstitute.rows[0].id;
      console.log(
        `[OK] Institute already exists: "${existingInstitute.rows[0].name}" (${instituteId})`,
      );

      // Update allowed_domains in case they changed
      await client.query(
        `UPDATE institutes SET allowed_domains = $1 WHERE id = $2`,
        [allowedDomains, instituteId],
      );
      console.log(`[OK] Updated allowed_domains: ${allowedDomains.join(", ")}`);
    } else {
      const insertResult = await client.query<{ id: string }>(
        `INSERT INTO institutes (name, primary_domain, allowed_domains)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [instituteName, primaryDomain, allowedDomains],
      );
      instituteId = insertResult.rows[0].id;
      console.log(
        `[OK] Created institute: "${instituteName}" (${instituteId})`,
      );
    }

    // ----- 2. Find user by email hash and promote to admin -----

    const emailHash = hashIdentifier(adminEmail, instituteId);

    const existingUser = await client.query<{
      id: string;
      role: string;
    }>(
      `SELECT id, role FROM users WHERE email_hash = $1 AND institute_id = $2`,
      [emailHash, instituteId],
    );

    if (existingUser.rows.length === 0) {
      console.log(
        `\n[WARN] No user found with email "${adminEmail}" at institute "${instituteName}".`,
      );
      console.log(
        `       The user must log in at least once with Google OAuth first.`,
      );
      console.log(
        `       After their first login, re-run this script to promote them.`,
      );
    } else {
      const user = existingUser.rows[0];

      if (user.role === "admin") {
        console.log(`[OK] User is already an admin (${user.id}).`);
      } else {
        await client.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [
          user.id,
        ]);
        console.log(`[OK] Promoted user ${user.id} to admin.`);
      }

      // ----- 3. Audit log -----

      await client.query(
        `INSERT INTO audit_logs (actor_user_id, action, metadata)
         VALUES ($1, 'bootstrap.admin_promote', $2)`,
        [
          user.id,
          JSON.stringify({
            institute_id: instituteId,
            promoted_by: "bootstrap_script",
          }),
        ],
      );
      console.log(`[OK] Audit log written.`);
    }

    await client.query("COMMIT");

    console.log("\n=== Bootstrap complete ===");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n[ERROR] Bootstrap failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
