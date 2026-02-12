import { Pool } from "pg";
import { config } from "@/lib/config";

// ---------------------------------------------------------------------------
// Connection pool — tuned for Vercel serverless
// ---------------------------------------------------------------------------
//
// On Vercel, each serverless invocation may create its own module scope.
// Without capping pool size, hundreds of concurrent invocations can exhaust
// the database connection limit (typically 20–100 depending on provider).
//
// We use globalThis to reuse the pool across hot-reloads in development
// and across warm invocations in production.
//
// Settings:
//   max: 1            — one connection per serverless instance (safe default)
//   idleTimeoutMillis — close idle connections after 20s (frees DB slots)
//   connectionTimeoutMillis — fail fast if DB is unreachable
// ---------------------------------------------------------------------------

const globalForPg = globalThis as unknown as { _pgPool?: Pool };

const pool =
  globalForPg._pgPool ??
  new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: config.isProduction ? 1 : 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

if (!config.isProduction) {
  // Reuse pool across hot-reloads in dev
  globalForPg._pgPool = pool;
}

export { pool };

// ---------------------------------------------------------------------------
// Types — mirror the Cleerlyst Postgres schema (no plaintext identifiers)
// ---------------------------------------------------------------------------

export interface Institute {
  id: string;
  name: string;
  primary_domain: string;
  allowed_domains: string[];
  created_at: Date;
}

export interface CleerlystUser {
  id: string;
  institute_id: string;
  role: "student" | "admin";
  email_hash: string;
  email_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

// ---------------------------------------------------------------------------
// Institute queries
// ---------------------------------------------------------------------------

/**
 * Find an institute whose allowed_domains includes the given domain.
 * Returns null when the domain is not recognised — login must be rejected.
 */
export async function findInstituteByDomain(
  domain: string,
): Promise<Institute | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<Institute>(
      `SELECT id, name, primary_domain, allowed_domains, created_at
         FROM institutes
        WHERE $1 = ANY(allowed_domains)
        LIMIT 1`,
      [domain.toLowerCase()],
    );
    return (result.rows[0] as Institute) ?? null;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// User queries — NEVER store or return plaintext email
// ---------------------------------------------------------------------------

/**
 * Look up a user by their email_hash.
 * Columns are listed explicitly — no SELECT *.
 */
export async function findUserByEmailHash(
  emailHash: string,
): Promise<CleerlystUser | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<CleerlystUser>(
      `SELECT id, institute_id, role, email_hash, email_verified,
              created_at, last_login_at
         FROM users
        WHERE email_hash = $1`,
      [emailHash],
    );
    return (result.rows[0] as CleerlystUser) ?? null;
  } finally {
    client.release();
  }
}

/**
 * Create a new user with only the hashed email.
 * Default role is 'student'. email_verified is TRUE because Google OAuth
 * guarantees a verified email address.
 */
export async function createUser(
  instituteId: string,
  emailHash: string,
): Promise<CleerlystUser> {
  const client = await pool.connect();
  try {
    const result = await client.query<CleerlystUser>(
      `INSERT INTO users (institute_id, role, email_hash, email_verified)
       VALUES ($1, 'student', $2, TRUE)
       RETURNING id, institute_id, role, email_hash, email_verified,
                 created_at, last_login_at`,
      [instituteId, emailHash],
    );
    return result.rows[0] as CleerlystUser;
  } finally {
    client.release();
  }
}

/**
 * Stamp last_login_at for an existing user.
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users SET last_login_at = now() WHERE id = $1`,
      [userId],
    );
  } finally {
    client.release();
  }
}

/**
 * Fetch a user by their primary key.
 * Used to retrieve the email_hash for identity-bound record lookups.
 */
export async function getUserById(
  userId: string,
): Promise<CleerlystUser | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<CleerlystUser>(
      `SELECT id, institute_id, role, email_hash, email_verified,
              created_at, last_login_at
         FROM users
        WHERE id = $1`,
      [userId],
    );
    return (result.rows[0] as CleerlystUser) ?? null;
  } finally {
    client.release();
  }
}

/**
 * Fetch all identifier_hash values for a user from user_identifiers.
 * Optionally filter by identifier type (reg_no, roll_no, employee_id).
 *
 * NOTE: this query touches user_identifiers only — never dataset_records.
 */
export async function getUserIdentifierHashes(
  userId: string,
  type?: string,
): Promise<string[]> {
  const client = await pool.connect();
  try {
    const query = type
      ? `SELECT identifier_hash FROM user_identifiers
          WHERE user_id = $1 AND type = $2`
      : `SELECT identifier_hash FROM user_identifiers
          WHERE user_id = $1`;

    const params = type ? [userId, type] : [userId];
    const result = await client.query<{ identifier_hash: string }>(
      query,
      params,
    );
    return result.rows.map((r) => r.identifier_hash);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// User identifier deletion — scoped to (user_id, type), no wildcards
// ---------------------------------------------------------------------------

/**
 * Delete a user identifier by (user_id, type).
 *
 * SECURITY INVARIANTS:
 *   • Both user_id AND type are required in the WHERE clause — no wildcard deletes.
 *   • Does NOT return identifier_hash or any sensitive data.
 *   • Returns true if a row was deleted, false if no matching row existed.
 */
export async function deleteUserIdentifier(
  userId: string,
  type: string,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM user_identifiers
        WHERE user_id = $1
          AND type = $2`,
      [userId, type],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset record lookup — identity-bound, NO join to users
// ---------------------------------------------------------------------------

/**
 * Find a single matching record in dataset_records by identifier hashes.
 *
 * SECURITY INVARIANTS:
 *   • This function receives pre-fetched hashes — it NEVER queries users.
 *   • There is NO join between users and dataset_records.
 *   • Only encrypted_payload is returned — never identifier_hash.
 *   • LIMIT 1 prevents any size inference.
 */
export async function findRecordByHashes(
  datasetId: string,
  identifierHashes: string[],
): Promise<Buffer | null> {
  if (identifierHashes.length === 0) return null;

  const client = await pool.connect();
  try {
    const result = await client.query<{ encrypted_payload: Buffer }>(
      `SELECT encrypted_payload
         FROM dataset_records
        WHERE dataset_id = $1
          AND identifier_hash = ANY($2)
        LIMIT 1`,
      [datasetId, identifierHashes],
    );
    return result.rows[0]?.encrypted_payload ?? null;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset queries
// ---------------------------------------------------------------------------

export interface Dataset {
  id: string;
  institute_id: string;
  created_by: string;
  type: string;
  title: string;
  description: string | null;
  identifier_type: string;
  visibility_config: Record<string, unknown>;
  expires_at: Date | null;
  status: string;
  created_at: Date;
  published_at: Date | null;
}

/**
 * Fetch a dataset by ID. Returns null if not found.
 * Used to validate ownership before record ingestion.
 */
export async function getDatasetById(
  datasetId: string,
): Promise<Dataset | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<Dataset>(
      `SELECT id, institute_id, created_by, type, title, description,
              identifier_type, visibility_config, expires_at,
              status, created_at, published_at
         FROM datasets
        WHERE id = $1`,
      [datasetId],
    );
    return (result.rows[0] as Dataset) ?? null;
  } finally {
    client.release();
  }
}

/**
 * Fetch the institute for a given institute_id.
 */
export async function getInstituteById(
  instituteId: string,
): Promise<Institute | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<Institute>(
      `SELECT id, name, primary_domain, allowed_domains, created_at
         FROM institutes
        WHERE id = $1`,
      [instituteId],
    );
    return (result.rows[0] as Institute) ?? null;
  } finally {
    client.release();
  }
}

/**
 * Published-dataset metadata — the ONLY fields a student may see.
 * No record counts, no created_by, no identifier_type, no visibility_config.
 */
export interface PublishedDatasetMeta {
  id: string;
  title: string;
  type: string;
  description: string | null;
  expires_at: Date | null;
  created_at: Date;
  published_at: Date;
}

/**
 * Return published, non-expired dataset metadata for a given institute.
 *
 * SECURITY INVARIANTS:
 *   • No SELECT * — columns are listed explicitly.
 *   • No JOIN — single-table query on `datasets` only.
 *   • No COUNT / record_count — zero row-level information.
 *   • Does NOT touch `dataset_records`.
 */
export async function getPublishedDatasetsForInstitute(
  instituteId: string,
): Promise<PublishedDatasetMeta[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<PublishedDatasetMeta>(
      `SELECT id, title, type, description, expires_at, created_at, published_at
         FROM datasets
        WHERE institute_id = $1
          AND status = 'published'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY published_at DESC`,
      [instituteId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset publishing — transactional status transition + audit
// ---------------------------------------------------------------------------

/**
 * Return type for publishDataset — only safe, non-internal fields.
 * No institute_id. No created_by. No status. No visibility_config.
 */
export interface PublishDatasetResult {
  id: string;
  title: string;
  published_at: Date;
}

/**
 * Transition a dataset from 'draft' → 'published' in a single transaction.
 *
 * RULES:
 *   • Dataset must exist — throws if not found.
 *   • Dataset must be in 'draft' status — throws if already published or revoked.
 *   • Sets status = 'published' and published_at = NOW().
 *   • Inserts an immutable audit log entry (action only, never payload).
 *   • Returns only { id, title, published_at } — no internal fields.
 *
 * SECURITY INVARIANTS:
 *   • No SELECT * — columns listed explicitly.
 *   • No JOIN — single-table operations on `datasets` and `audit_logs`.
 *   • No COUNT — no row-level information.
 *   • Does NOT touch `dataset_records`.
 */
export async function publishDataset(
  datasetId: string,
  actorUserId: string,
): Promise<PublishDatasetResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ----- 1. Fetch dataset (explicit columns only) -----

    const lookup = await client.query<{ id: string; status: string }>(
      `SELECT id, status
         FROM datasets
        WHERE id = $1
        FOR UPDATE`,
      [datasetId],
    );

    if (lookup.rows.length === 0) {
      throw new Error("Dataset not found");
    }

    const current = lookup.rows[0];

    if (current.status === "published") {
      throw new Error("Dataset is already published");
    }

    if (current.status === "revoked") {
      throw new Error("Cannot publish a revoked dataset");
    }

    // ----- 2. Update status + published_at -----

    const updated = await client.query<PublishDatasetResult>(
      `UPDATE datasets
          SET status = 'published',
              published_at = NOW()
        WHERE id = $1
        RETURNING id, title, published_at`,
      [datasetId],
    );

    // ----- 3. Audit log (action only, never payload) -----

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, dataset_id, metadata)
       VALUES ($1, 'dataset.publish', $2, '{}'::jsonb)`,
      [actorUserId, datasetId],
    );

    await client.query("COMMIT");

    return updated.rows[0] as PublishDatasetResult;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset revoking — transactional status transition + audit
// ---------------------------------------------------------------------------

/**
 * Return type for revokeDataset — only id and status.
 * No institute_id. No title. No published_at.
 */
export interface RevokeDatasetResult {
  id: string;
  status: string;
}

/**
 * Transition a dataset to 'revoked' status in a single transaction.
 *
 * RULES:
 *   • Dataset must exist — throws if not found.
 *   • Dataset must NOT already be 'revoked' — throws if so.
 *   • Sets status = 'revoked'. Does NOT modify published_at.
 *   • Inserts an immutable audit log entry (action only, never payload).
 *   • Returns only { id, status } — no internal fields.
 *
 * SECURITY INVARIANTS:
 *   • Columns listed explicitly — no wildcard selects.
 *   • No JOIN — single-table operations on datasets and audit_logs.
 *   • Does NOT touch dataset_records.
 *   • Does NOT delete any records.
 *   • Does NOT touch notifications.
 */
export async function revokeDataset(
  datasetId: string,
  actorUserId: string,
): Promise<RevokeDatasetResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ----- 1. Fetch dataset (explicit columns only, row-level lock) -----

    const lookup = await client.query<{ id: string; status: string }>(
      `SELECT id, status
         FROM datasets
        WHERE id = $1
        FOR UPDATE`,
      [datasetId],
    );

    if (lookup.rows.length === 0) {
      throw new Error("Dataset not found");
    }

    const current = lookup.rows[0];

    if (current.status === "revoked") {
      throw new Error("Dataset is already revoked");
    }

    // ----- 2. Update status only — do NOT touch published_at -----

    const updated = await client.query<RevokeDatasetResult>(
      `UPDATE datasets
          SET status = 'revoked'
        WHERE id = $1
        RETURNING id, status`,
      [datasetId],
    );

    // ----- 3. Audit log (action only, never payload) -----

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, dataset_id, metadata)
       VALUES ($1, 'dataset.revoke', $2, '{}'::jsonb)`,
      [actorUserId, datasetId],
    );

    await client.query("COMMIT");

    return updated.rows[0] as RevokeDatasetResult;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset visibility config update — draft-only
// ---------------------------------------------------------------------------

/**
 * Update the visibility_config for a dataset.
 *
 * SECURITY INVARIANTS:
 *   • Caller must verify dataset is in 'draft' status BEFORE calling.
 *   • Explicit column selection — no SELECT *.
 *   • Does NOT return visibility_config contents.
 *   • Does NOT modify status or any other column.
 */
export async function updateDatasetVisibilityConfig(
  datasetId: string,
  visibilityConfig: { allowed_fields: string[] },
): Promise<{ id: string; updated_at: Date }> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ id: string; updated_at: Date }>(
      `UPDATE datasets
          SET visibility_config = $2::jsonb
        WHERE id = $1
        RETURNING id, created_at AS updated_at`,
      [datasetId, JSON.stringify(visibilityConfig)],
    );
    if (result.rows.length === 0) {
      throw new Error("Dataset not found");
    }
    return result.rows[0] as { id: string; updated_at: Date };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset record insertion — transactional batch
// ---------------------------------------------------------------------------

export interface RecordInsertRow {
  identifierHash: string;
  encryptedPayload: Buffer;
}

/**
 * Insert dataset records in a single transaction.
 *
 * Each row is an individually-parameterised INSERT — safe from injection.
 * On any failure the entire batch is rolled back; no partial writes.
 *
 * Returns the number of rows inserted.
 */
export async function insertRecordsBatch(
  datasetId: string,
  rows: RecordInsertRow[],
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let inserted = 0;
    for (const row of rows) {
      await client.query(
        `INSERT INTO dataset_records (dataset_id, identifier_hash, encrypted_payload)
         VALUES ($1, $2, $3)`,
        [datasetId, row.identifierHash, row.encryptedPayload],
      );
      inserted++;
    }

    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/**
 * Write an immutable audit log entry.
 * Logs actions, NEVER payloads or record content.
 */
export async function insertAuditLog(
  actorUserId: string,
  action: string,
  datasetId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, dataset_id, metadata)
       VALUES ($1, $2, $3, $4)`,
      [actorUserId, action, datasetId, JSON.stringify(metadata)],
    );
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Notifications — idempotent insert, no joins, no payload
// ---------------------------------------------------------------------------

/** Allowed notification types. */
export type NotificationType = "new" | "update" | "action_required";

/**
 * Create a notification row only when one does not already exist for the
 * given (user_id, dataset_id, type) triple.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING so it never throws on duplicates.
 *
 * SECURITY INVARIANTS:
 *   • No wildcard selects — no columns are read back except the insert outcome.
 *   • No JOIN — single-table operation on notifications only.
 *   • Does NOT touch dataset_records.
 *   • Does NOT return payload data.
 *
 * @returns `true` if a new row was inserted, `false` if it already existed.
 */
export async function createNotificationIfAbsent(
  userId: string,
  datasetId: string,
  type: NotificationType,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO notifications (user_id, dataset_id, type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, dataset_id, type) DO NOTHING`,
      [userId, datasetId, type],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Notification listing & mark-read — user-scoped, no payload, no joins
// ---------------------------------------------------------------------------

/**
 * A single notification row as returned to the client.
 * Contains NO payload content, NO student data, NO record references.
 */
export interface NotificationRow {
  id: string;
  dataset_id: string;
  dataset_title: string;
  type: string;
  read_at: Date | null;
  created_at: Date;
}

/**
 * Fetch notifications for a user, most recent first.
 *
 * SECURITY INVARIANTS:
 *   • Scoped to user_id — a user can only see their own notifications.
 *   • Columns listed explicitly — no SELECT *.
 *   • Joins datasets ONLY for title — no record counts, no visibility_config.
 *   • Does NOT touch dataset_records.
 *   • Does NOT return payload content.
 *   • Capped at 50 rows to prevent abuse.
 */
export async function getNotificationsForUser(
  userId: string,
): Promise<NotificationRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<NotificationRow>(
      `SELECT n.id,
              n.dataset_id,
              d.title AS dataset_title,
              n.type,
              n.read_at,
              n.created_at
         FROM notifications n
         JOIN datasets d ON d.id = n.dataset_id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 50`,
      [userId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Mark a single notification as read for a specific user.
 *
 * SECURITY INVARIANTS:
 *   • user_id is part of the WHERE clause — prevents cross-user mutation.
 *   • Only sets read_at — no other columns modified.
 *   • Returns true if exactly one row was updated, false otherwise.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE notifications
          SET read_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND read_at IS NULL`,
      [notificationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Admin dataset listing — metadata only, no records, no user info
// ---------------------------------------------------------------------------

/**
 * Admin-safe dataset metadata — only fields an admin may see.
 * No visibility_config. No created_by details. No record counts.
 */
export interface AdminDatasetMeta {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: Date;
  published_at: Date | null;
}

/**
 * Fetch ALL datasets for an institute — admin view.
 *
 * SECURITY INVARIANTS:
 *   • Columns listed explicitly — no SELECT *.
 *   • No JOIN — single-table query on `datasets` only.
 *   • No record counts — zero row-level information.
 *   • Does NOT touch `dataset_records`.
 *   • Does NOT return visibility_config.
 *   • Does NOT return created_by (user details).
 *   • Filtered by institute_id — admin cannot see other institutes' datasets.
 */
export async function getAdminDatasetsForInstitute(
  instituteId: string,
): Promise<AdminDatasetMeta[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<AdminDatasetMeta>(
      `SELECT id, title, type, status, created_at, published_at
         FROM datasets
        WHERE institute_id = $1
        ORDER BY created_at DESC`,
      [instituteId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Dataset creation — draft only
// ---------------------------------------------------------------------------

/**
 * Fields required to create a new dataset.
 */
export interface CreateDatasetInput {
  instituteId: string;
  createdBy: string;
  title: string;
  type: string;
  description: string | null;
  identifierType: string;
  expiresAt: Date | null;
}

/**
 * Return type for createDataset — safe, non-internal fields.
 */
export interface CreateDatasetResult {
  id: string;
  title: string;
  status: string;
  created_at: Date;
}

/**
 * Create a new dataset in 'draft' status with an accompanying audit log entry.
 *
 * SECURITY INVARIANTS:
 *   • Columns listed explicitly — no SELECT *.
 *   • Status is always 'draft' — caller cannot override.
 *   • Transactional — dataset row + audit log in one TX.
 *   • Audit log records action only, never payload.
 */
export async function createDataset(
  input: CreateDatasetInput,
  actorUserId: string,
): Promise<CreateDatasetResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query<CreateDatasetResult>(
      `INSERT INTO datasets
         (institute_id, created_by, type, title, description,
          identifier_type, status, visibility_config)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', '{}'::jsonb)
       RETURNING id, title, status, created_at`,
      [
        input.instituteId,
        input.createdBy,
        input.type,
        input.title,
        input.description,
        input.identifierType,
      ],
    );

    const created = result.rows[0] as CreateDatasetResult;

    // Audit log — action only, never payload
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, dataset_id, metadata)
       VALUES ($1, 'dataset.create', $2, $3)`,
      [
        actorUserId,
        created.id,
        JSON.stringify({ title: input.title, type: input.type }),
      ],
    );

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// User identifier insertion — identity-bound, no plaintext
// ---------------------------------------------------------------------------

/**
 * Insert a hashed + encrypted identifier for a user.
 *
 * SECURITY INVARIANTS:
 *   • No plaintext identifier stored — only hash and encrypted blob.
 *   • identifier_hash is used for matching (one-way, non-reversible).
 *   • identifier_encrypted is AES-256-GCM ciphertext (recoverable with key).
 *   • Columns listed explicitly — no SELECT *.
 *   • Does NOT return identifier_hash or identifier_encrypted.
 *   • Caller must pre-check (user_id, type) uniqueness.
 *
 * @throws If identifier_hash already exists (UNIQUE violation).
 */
export async function insertUserIdentifier(
  userId: string,
  type: string,
  identifierHash: string,
  identifierEncrypted: Buffer,
): Promise<{ id: string; created_at: Date }> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO user_identifiers (user_id, type, identifier_hash, identifier_encrypted)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [userId, type, identifierHash, identifierEncrypted],
    );
    return result.rows[0] as { id: string; created_at: Date };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// User identifier retrieval — encrypted only, no hash, no plaintext
// ---------------------------------------------------------------------------

/**
 * Fetch all encrypted identifiers for a user.
 *
 * SECURITY INVARIANTS:
 *   • Returns type + identifier_encrypted ONLY — never identifier_hash.
 *   • Decryption is the caller's responsibility (server-side only).
 *   • Explicit column selection — no SELECT *.
 *   • Scoped to a single user_id — no cross-user reads.
 */
export async function getUserEncryptedIdentifiers(
  userId: string,
): Promise<Array<{ type: string; identifier_encrypted: Buffer }>> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      type: string;
      identifier_encrypted: Buffer;
    }>(
      `SELECT type, identifier_encrypted
         FROM user_identifiers
        WHERE user_id = $1
        ORDER BY type`,
      [userId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Aggregate record count — safe stat (count only, no identifiers)
// ---------------------------------------------------------------------------

/**
 * Return the total number of records for a dataset.
 *
 * SECURITY INVARIANTS:
 *   • Returns a single aggregate COUNT — no row-level data.
 *   • Does NOT return identifiers, hashes, or payloads.
 *   • Does NOT join to users.
 *   • Reveals only dataset size, NOT membership.
 */
export async function getDatasetRecordCount(
  datasetId: string,
): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM dataset_records
        WHERE dataset_id = $1`,
      [datasetId],
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Pool lifecycle
// ---------------------------------------------------------------------------

/**
 * Close the pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
