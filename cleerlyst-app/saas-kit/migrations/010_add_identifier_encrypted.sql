-- ============================================================================
-- CLEERLYST MIGRATION 010: add encrypted identifier column
-- ============================================================================
--
-- Adds identifier_encrypted (BYTEA) to user_identifiers so that the
-- original identifier value can be recovered for display or re-hashing
-- if the normalization policy changes.
--
-- The column stores the output of AES-256-GCM encryption (via
-- lib/encryption.ts) — the plaintext identifier is NEVER stored.
--
-- Column is NULLABLE in this migration to allow a two-step rollout:
--   1. Add column (this migration)
--   2. Update API to populate it on every insert
--   3. Backfill any existing rows (if applicable)
--   4. SET NOT NULL (migration 011 or manual ALTER once backfill completes)
--
-- SAFETY:
--   • No existing columns are dropped.
--   • No existing data is modified.
--   • dataset_records is NOT touched.
--   • Idempotent — safe to re-run (IF NOT EXISTS guard via DO block).
--   • Wrapped in a transaction.
--
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_identifiers'
      AND column_name  = 'identifier_encrypted'
  ) THEN
    ALTER TABLE user_identifiers
      ADD COLUMN identifier_encrypted BYTEA;
  END IF;
END $$;

COMMENT ON COLUMN user_identifiers.identifier_encrypted
  IS 'AES-256-GCM encrypted identifier — plaintext never stored, recoverable for re-hashing';

COMMIT;
