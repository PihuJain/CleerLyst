-- ============================================================================
-- DEPRECATED — Old SaaS Kit cleanup removed
-- ============================================================================
-- The old file ran:  DELETE FROM users WHERE email LIKE '%@example.com'
-- That query references a plaintext email column that no longer exists.
--
-- Cleerlyst has no plaintext email column and does not ship sample data.
-- ============================================================================

DO $$ BEGIN RAISE EXCEPTION
    'This file is deprecated. Cleerlyst does not store plaintext email.';
END $$;
