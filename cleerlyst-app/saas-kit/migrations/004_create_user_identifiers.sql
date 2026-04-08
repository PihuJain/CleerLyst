-- ============================================================================
-- CLEERLYST MIGRATION 004: user_identifiers
-- ============================================================================
-- Allows multiple hashed identifiers per user (reg_no, roll_no, employee_id).
-- identifier_hash is unique — one hash maps to exactly one user.
-- No plaintext identifier is ever persisted.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_identifiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type            identifier_type NOT NULL,
    identifier_hash TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  user_identifiers IS 'Hashed identifiers (reg_no, roll_no, etc.) linked to users';
COMMENT ON COLUMN user_identifiers.identifier_hash IS 'SHA-256 hash of the identifier — plaintext never stored';

COMMIT;
