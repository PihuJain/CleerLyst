-- ============================================================================
-- CLEERLYST MIGRATION 011: Add headers column to datasets
-- ============================================================================
-- Stores canonical CSV column headers (excluding the identifier column).
-- Used to render the visibility configuration UI.
--
-- RULES:
--   • JSON array of trimmed, non-empty strings.
--   • Defaults to empty array (no headers = no upload yet).
--   • Immutable after first upload — application code enforces this.
--   • Identifier column is NEVER included.
--
-- Idempotent — safe to re-run (IF NOT EXISTS guard).
-- Wrapped in a transaction.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'datasets'
      AND column_name  = 'headers'
  ) THEN
    ALTER TABLE datasets
      ADD COLUMN headers JSONB NOT NULL DEFAULT '[]';
  END IF;
END $$;

COMMENT ON COLUMN datasets.headers
  IS 'Canonical column headers from uploaded CSV — immutable after upload, excludes identifier column';

COMMIT;
