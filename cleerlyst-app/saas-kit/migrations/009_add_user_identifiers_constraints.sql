-- ============================================================================
-- CLEERLYST MIGRATION 009: user_identifiers constraint tightening
-- ============================================================================
--
-- Adds two compound unique constraints and replaces the overly broad
-- single-column unique on identifier_hash.
--
-- BEFORE (migration 004):
--   UNIQUE (identifier_hash)           ← global; too broad
--
-- AFTER:
--   UNIQUE (user_id, type)             ← one identifier per type per user
--   UNIQUE (type, identifier_hash)     ← one hash per type maps to one user
--
-- WHY the old constraint is replaced:
--   The bare UNIQUE(identifier_hash) prevents two different identifier types
--   from ever sharing the same hash (theoretically possible with different
--   salts or future algorithm changes). Scoping to (type, identifier_hash)
--   is semantically correct while still preventing duplicate registrations
--   within a type.
--
-- SAFETY:
--   • No data is deleted.
--   • No tables are dropped.
--   • dataset_records is NOT touched.
--   • All operations are idempotent (IF EXISTS / IF NOT EXISTS).
--   • Wrapped in a transaction — all-or-nothing.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop the old single-column unique on identifier_hash
-- ---------------------------------------------------------------------------
-- The inline UNIQUE from migration 004 creates a constraint named
-- user_identifiers_identifier_hash_key (Postgres default naming).

ALTER TABLE user_identifiers
  DROP CONSTRAINT IF EXISTS user_identifiers_identifier_hash_key;

-- ---------------------------------------------------------------------------
-- 2. Add UNIQUE (user_id, type)
-- ---------------------------------------------------------------------------
-- A user may register at most one identifier per type.
-- This is the constraint that the POST endpoint's pre-check relies on.

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identifiers_user_type
  ON user_identifiers (user_id, type);

-- ---------------------------------------------------------------------------
-- 3. Add UNIQUE (type, identifier_hash)
-- ---------------------------------------------------------------------------
-- Within a given type, each hash maps to exactly one user.
-- This is the constraint that surfaces "identifier_already_registered".

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identifiers_type_hash
  ON user_identifiers (type, identifier_hash);

COMMIT;
