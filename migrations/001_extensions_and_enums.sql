-- ============================================================================
-- CLEERLYST MIGRATION 001: Extensions & Enum Types
-- ============================================================================
-- Enables required extensions and creates all enum types used across tables.
-- Must run FIRST before any table migrations.
-- ============================================================================

BEGIN;

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Enum: user role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'admin');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Enum: identifier type (for user_identifiers)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identifier_type') THEN
        CREATE TYPE identifier_type AS ENUM ('reg_no', 'roll_no', 'employee_id');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Enum: dataset type
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_type') THEN
        CREATE TYPE dataset_type AS ENUM ('placement', 'academic', 'fest', 'finance', 'other');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Enum: dataset identifier type (email or reg_no used for matching)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_identifier_type') THEN
        CREATE TYPE dataset_identifier_type AS ENUM ('email', 'reg_no');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Enum: dataset status
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dataset_status') THEN
        CREATE TYPE dataset_status AS ENUM ('draft', 'published', 'revoked');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Enum: notification type
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('new', 'update', 'action_required');
    END IF;
END $$;

COMMIT;
