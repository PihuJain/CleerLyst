-- ============================================================================
-- CLEERLYST — COMPLETE DATABASE SETUP
-- ============================================================================
-- Replaces the old SaaS Kit schema. Run on a FRESH database only.
--
-- Schema invariants:
--   • No plaintext email stored anywhere
--   • User identity = email_hash (SHA-256 of lowercase email + institute salt)
--   • No SELECT * in any query
--   • No FK from dataset_records → users
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Extensions & Enum Types
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')              THEN CREATE TYPE user_role              AS ENUM ('student', 'admin');                            END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identifier_type')        THEN CREATE TYPE identifier_type        AS ENUM ('reg_no', 'roll_no', 'employee_id');             END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_type')           THEN CREATE TYPE dataset_type           AS ENUM ('placement', 'academic', 'fest', 'finance', 'other'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_identifier_type')THEN CREATE TYPE dataset_identifier_type AS ENUM ('email', 'reg_no');                            END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_status')         THEN CREATE TYPE dataset_status         AS ENUM ('draft', 'published', 'revoked');                END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type')      THEN CREATE TYPE notification_type      AS ENUM ('new', 'update', 'action_required');              END IF; END $$;

-- ============================================================================
-- STEP 2: institutes
-- ============================================================================

CREATE TABLE IF NOT EXISTS institutes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    primary_domain  TEXT NOT NULL,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 3: users — NO PLAINTEXT EMAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id    UUID NOT NULL REFERENCES institutes (id) ON DELETE RESTRICT,
    role            user_role NOT NULL DEFAULT 'student',
    email_hash      TEXT NOT NULL UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

COMMENT ON TABLE  users IS 'Authenticated users — email_hash is the ONLY identity stored';
COMMENT ON COLUMN users.email_hash IS 'SHA-256(lowercase(email) + institute.id) — plaintext never persisted';

-- ============================================================================
-- STEP 4: user_identifiers
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_identifiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type            identifier_type NOT NULL,
    identifier_hash TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 5: datasets
-- ============================================================================

CREATE TABLE IF NOT EXISTS datasets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id      UUID NOT NULL REFERENCES institutes (id) ON DELETE RESTRICT,
    created_by        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    type              dataset_type NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    identifier_type   dataset_identifier_type NOT NULL,
    visibility_config JSONB NOT NULL DEFAULT '{}',
    expires_at        TIMESTAMPTZ,
    status            dataset_status NOT NULL DEFAULT 'draft',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at      TIMESTAMPTZ
);

-- ============================================================================
-- STEP 6: dataset_records — NO FK TO USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataset_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id        UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    identifier_hash   TEXT NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The ONLY search index on this table.
CREATE INDEX IF NOT EXISTS idx_dataset_records_identifier_hash
    ON dataset_records (identifier_hash);

-- Index for institute-scoped queries (admin dataset list, student feed)
CREATE INDEX IF NOT EXISTS idx_datasets_institute_id
    ON datasets (institute_id);

-- ============================================================================
-- STEP 7: notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    dataset_id  UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, dataset_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id, created_at DESC);

-- ============================================================================
-- STEP 8: audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    action          TEXT NOT NULL,
    dataset_id      UUID REFERENCES datasets (id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail — actions only, never payloads';

COMMIT;
