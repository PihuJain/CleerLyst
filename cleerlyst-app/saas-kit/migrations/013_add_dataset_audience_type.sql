-- ============================================================================
-- CLEERLYST MIGRATION 013: Add audience_type to datasets
-- ============================================================================
-- Introduces controlled audience visibility for datasets.
--
-- Values:
--   restricted — current behavior: only matched identities can view records.
--   public     — all institute students can view records (no match required).
--
-- DEFAULT is 'restricted' — all existing datasets retain current behavior.
--
-- SAFETY:
--   • No existing columns are dropped.
--   • No existing data is modified.
--   • dataset_records is NOT touched.
--   • Idempotent — safe to re-run (IF NOT EXISTS guards).
--   • Wrapped in a transaction.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Create enum type (idempotent)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_audience_type') THEN
    CREATE TYPE dataset_audience_type AS ENUM ('restricted', 'public');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Add column to datasets (idempotent)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'datasets'
      AND column_name  = 'audience_type'
  ) THEN
    ALTER TABLE datasets
      ADD COLUMN audience_type dataset_audience_type NOT NULL DEFAULT 'restricted';
  END IF;
END $$;

COMMENT ON COLUMN datasets.audience_type
  IS 'restricted = identity-bound match required; public = visible to all institute students';

COMMIT;
