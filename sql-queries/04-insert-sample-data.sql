-- ============================================================================
-- DEPRECATED — Old SaaS Kit sample data removed
-- ============================================================================
-- The old file inserted 8 sample users with PLAINTEXT emails like
-- john.doe@example.com, google_id values, and Stripe customer IDs.
--
-- Cleerlyst never stores plaintext email. Sample data for development
-- must insert hashed values only. See migrations/ for the schema.
-- ============================================================================

DO $$ BEGIN RAISE EXCEPTION
    'This file is deprecated. Cleerlyst does not ship plaintext sample data.';
END $$;
