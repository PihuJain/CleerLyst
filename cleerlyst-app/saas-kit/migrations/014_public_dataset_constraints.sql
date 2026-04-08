-- ============================================================================
-- CLEERLYST MIGRATION 014: public dataset constraints
-- ============================================================================
-- Public datasets must not require identifier matching.
-- Make identifier_type nullable and enforce the invariant via CHECK.
-- ============================================================================

BEGIN;

-- Step 1: Allow NULL identifier_type (for public datasets)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'datasets'
      AND column_name  = 'identifier_type'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE datasets ALTER COLUMN identifier_type DROP NOT NULL;
  END IF;
END $$;

-- Step 2: Add CHECK constraint
-- Public datasets MUST have identifier_type IS NULL.
-- Restricted datasets MUST have identifier_type IS NOT NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_public_no_identifier'
  ) THEN
    ALTER TABLE datasets
      ADD CONSTRAINT chk_public_no_identifier
      CHECK (
        (audience_type = 'restricted' AND identifier_type IS NOT NULL)
        OR
        (audience_type = 'public' AND identifier_type IS NULL)
      );
  END IF;
END $$;

-- Step 3: Fix any existing public datasets that have identifier_type set
UPDATE datasets
   SET identifier_type = NULL
 WHERE audience_type = 'public'
   AND identifier_type IS NOT NULL;

COMMIT;
