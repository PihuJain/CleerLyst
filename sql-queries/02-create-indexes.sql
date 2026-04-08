-- ============================================================================
-- DEPRECATED — Old SaaS Kit indexes removed
-- ============================================================================
-- The old schema had 13 indexes on the users table covering email, google_id,
-- subscription_status, credits, stripe_customer_id, and more.
--
-- Cleerlyst uses ONLY:
--   • users.email_hash — UNIQUE constraint (implicit index)
--   • user_identifiers (user_id, type) — UNIQUE constraint (implicit index)
--   • user_identifiers (type, identifier_hash) — UNIQUE constraint (implicit index)
--   • dataset_records.identifier_hash — explicit index (the only search index)
--
-- These are created inside 00-complete-setup.sql / the migrations/ files.
-- ============================================================================

DO $$ BEGIN RAISE EXCEPTION
    'This file is deprecated. Run 00-complete-setup.sql or the migrations/ files instead.';
END $$;
