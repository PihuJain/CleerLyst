-- ============================================================================
-- CLEERLYST MIGRATION 012: Unique constraint on dataset_records
-- ============================================================================
-- Enforces that each identifier_hash appears at most once per dataset.
-- Prevents duplicate records from re-uploads or race conditions.
--
-- IMPORTANT:
--   • If duplicates already exist, this migration WILL FAIL.
--   • In that case: investigate and deduplicate before re-running.
--   • Query to find duplicates:
--       SELECT dataset_id, identifier_hash, COUNT(*)
--         FROM dataset_records
--        GROUP BY dataset_id, identifier_hash
--       HAVING COUNT(*) > 1;
--
-- Idempotent — IF NOT EXISTS guard.
-- Wrapped in a transaction.
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_records_dataset_identifier
    ON dataset_records (dataset_id, identifier_hash);

COMMENT ON INDEX uq_dataset_records_dataset_identifier
  IS 'Each identifier_hash may appear at most once per dataset — no duplicate records';

COMMIT;
