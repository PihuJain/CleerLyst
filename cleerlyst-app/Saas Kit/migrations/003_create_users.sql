-- ============================================================================
-- CLEERLYST MIGRATION 003: users
-- ============================================================================
-- Stores authenticated users. Plaintext email is NEVER stored.
-- email_hash = SHA-256(lowercase(email) + institute_salt).
-- Lookup by email_hash only; no plaintext search path exists.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id    UUID NOT NULL REFERENCES institutes (id) ON DELETE RESTRICT,
    role            user_role NOT NULL DEFAULT 'student',
    email_hash      TEXT NOT NULL UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

COMMENT ON TABLE  users IS 'Authenticated users — no plaintext email stored';
COMMENT ON COLUMN users.email_hash IS 'SHA-256(lowercase(email) + institute_salt)';

COMMIT;
