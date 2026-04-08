-- =========================================================================
-- Migration 015 — Constraint tightening
-- =========================================================================
--
-- Closes three gaps between code assumptions and DB enforcement:
--
--   1. notification_type enum missing 'dataset_published' value.
--      publishDataset() inserts type='dataset_published' but the enum
--      only has ('new','update','action_required') → runtime failure.
--
--   2. user_identifiers.identifier_encrypted is NULLABLE at DB level.
--      Code always writes a non-null Buffer and reads without null guard.
--      Migration 010 added the column but never tightened to NOT NULL.
--
--   3. institutes.primary_domain has no UNIQUE constraint.
--      Two institutes with the same domain would cause non-deterministic
--      user assignment — violating institute isolation.
--
-- Idempotent: safe to re-run.
-- =========================================================================

-- Step 1: Add 'dataset_published' to notification_type enum
-- NOTE: ALTER TYPE ... ADD VALUE IF NOT EXISTS requires Postgres >= 9.3
--       and cannot be rolled back, so it must be outside a transaction.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dataset_published';

BEGIN;

-- Step 2: Enforce NOT NULL on user_identifiers.identifier_encrypted
-- Fail loudly if any NULL rows exist (backfill required first).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_identifiers WHERE identifier_encrypted IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot add NOT NULL: rows with NULL identifier_encrypted exist. Delete or backfill them first.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_identifiers'
      AND column_name = 'identifier_encrypted'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE user_identifiers
      ALTER COLUMN identifier_encrypted SET NOT NULL;
  END IF;
END $$;

-- Step 3: UNIQUE constraint on institutes.primary_domain
CREATE UNIQUE INDEX IF NOT EXISTS uq_institutes_primary_domain
  ON institutes (primary_domain);

COMMIT;
