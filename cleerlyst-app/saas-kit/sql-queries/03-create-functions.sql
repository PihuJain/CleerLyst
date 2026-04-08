-- ============================================================================
-- DEPRECATED — Old SaaS Kit functions removed
-- ============================================================================
-- The old schema had functions for:
--   get_user_stats, get_revenue_stats, add_user_credits,
--   deduct_user_credits, upgrade_user_to_pro
--
-- None of these apply to Cleerlyst. The Cleerlyst schema has no credits,
-- no Stripe integration, and no subscription tiers at the DB level.
-- ============================================================================

DO $$ BEGIN RAISE EXCEPTION
    'This file is deprecated. Run 00-complete-setup.sql or the migrations/ files instead.';
END $$;
