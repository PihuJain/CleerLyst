-- ============================================================================
-- CLEERLYST — VERIFY DATABASE SETUP
-- ============================================================================
-- Checks that all Cleerlyst tables exist and the schema is correct.
-- Run after 00-complete-setup.sql or after running all migrations.
-- ============================================================================

DO $$
DECLARE
    tbl   TEXT;
    found BOOLEAN;
    ok    BOOLEAN := TRUE;
    expected_tables TEXT[] := ARRAY[
        'institutes',
        'users',
        'user_identifiers',
        'datasets',
        'dataset_records',
        'notifications',
        'audit_logs'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'CLEERLYST — SCHEMA VERIFICATION';
    RAISE NOTICE '================================';
    RAISE NOTICE '';

    -- Check each expected table
    FOREACH tbl IN ARRAY expected_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) INTO found;

        IF found THEN
            RAISE NOTICE '[OK]    %', tbl;
        ELSE
            RAISE NOTICE '[MISS]  %', tbl;
            ok := FALSE;
        END IF;
    END LOOP;

    RAISE NOTICE '';

    -- Verify users table has NO plaintext email column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'email'
    ) THEN
        RAISE NOTICE '[FAIL]  users table still has a plaintext "email" column!';
        ok := FALSE;
    ELSE
        RAISE NOTICE '[OK]    users table has NO plaintext email column';
    END IF;

    -- Verify users table has email_hash
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'email_hash'
    ) THEN
        RAISE NOTICE '[OK]    users.email_hash exists';
    ELSE
        RAISE NOTICE '[FAIL]  users.email_hash is missing!';
        ok := FALSE;
    END IF;

    -- Verify dataset_records has NO user_id FK
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dataset_records'
          AND column_name = 'user_id'
    ) THEN
        RAISE NOTICE '[FAIL]  dataset_records has a user_id column (forbidden)!';
        ok := FALSE;
    ELSE
        RAISE NOTICE '[OK]    dataset_records has NO user_id column';
    END IF;

    -- Verify identifier_hash index on dataset_records
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'dataset_records'
          AND indexname   = 'idx_dataset_records_identifier_hash'
    ) THEN
        RAISE NOTICE '[OK]    idx_dataset_records_identifier_hash exists';
    ELSE
        RAISE NOTICE '[WARN]  idx_dataset_records_identifier_hash missing';
    END IF;

    -- Verify UNIQUE (user_id, type) on user_identifiers
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'user_identifiers'
          AND indexdef LIKE '%user_id%type%'
          AND indexdef LIKE '%UNIQUE%'
    ) THEN
        RAISE NOTICE '[OK]    user_identifiers UNIQUE (user_id, type) exists';
    ELSE
        RAISE NOTICE '[FAIL]  user_identifiers UNIQUE (user_id, type) missing!';
        ok := FALSE;
    END IF;

    -- Verify UNIQUE (type, identifier_hash) on user_identifiers
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'user_identifiers'
          AND indexdef LIKE '%type%identifier_hash%'
          AND indexdef LIKE '%UNIQUE%'
    ) THEN
        RAISE NOTICE '[OK]    user_identifiers UNIQUE (type, identifier_hash) exists';
    ELSE
        RAISE NOTICE '[FAIL]  user_identifiers UNIQUE (type, identifier_hash) missing!';
        ok := FALSE;
    END IF;

    -- Warn if the old bare UNIQUE(identifier_hash) still exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'user_identifiers'::regclass
          AND conname   = 'user_identifiers_identifier_hash_key'
    ) THEN
        RAISE NOTICE '[WARN]  old UNIQUE(identifier_hash) constraint still present — run migration 009';
    END IF;

    RAISE NOTICE '';

    IF ok THEN
        RAISE NOTICE 'RESULT: ALL CHECKS PASSED';
    ELSE
        RAISE NOTICE 'RESULT: SOME CHECKS FAILED — review output above';
    END IF;

    RAISE NOTICE '';
END $$;
