-- ============================================================================
-- DEPRECATED — Old SaaS Kit users table removed
-- ============================================================================
-- The old schema stored plaintext email, google_id, credits, and Stripe
-- fields. All of that has been replaced by the Cleerlyst schema.
--
-- The Cleerlyst users table stores ONLY:
--   id, institute_id, role, email_hash, email_verified, created_at, last_login_at
--
-- To set up the database, run EITHER:
--   • migrations/001 through 008 (individual files, in order)
--   • sql-queries/00-complete-setup.sql (all-in-one)
-- ============================================================================

DO $$ BEGIN RAISE EXCEPTION
    'This file is deprecated. Run 00-complete-setup.sql or the migrations/ files instead.';
END $$;
