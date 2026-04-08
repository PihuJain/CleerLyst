-- ============================================================================
-- BEST SAAS KIT V2 - DATABASE INDEXES
-- ============================================================================
-- This file creates indexes for optimal query performance
-- Execute this file after creating the users table

-- Index on google_id for authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Index on email for user lookups and authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on subscription_status for filtering users by subscription type
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Index on created_at for analytics and user registration tracking
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Index on last_login for activity tracking and analytics
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Index on updated_at for general record tracking
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Composite index for subscription analytics (status + created_at)
CREATE INDEX IF NOT EXISTS idx_users_subscription_created 
ON users(subscription_status, created_at);

-- Composite index for active user analytics (last_login + subscription_status)
CREATE INDEX IF NOT EXISTS idx_users_activity_subscription 
ON users(last_login, subscription_status);

-- Index on stripe_customer_id for billing operations
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Index on subscription_end_date for subscription management
CREATE INDEX IF NOT EXISTS idx_users_subscription_end_date ON users(subscription_end_date)
WHERE subscription_end_date IS NOT NULL;

-- Partial index for pro users (most common queries)
CREATE INDEX IF NOT EXISTS idx_users_pro_active 
ON users(created_at, last_login) 
WHERE subscription_status = 'pro';

-- Partial index for free users
CREATE INDEX IF NOT EXISTS idx_users_free_active 
ON users(created_at, last_login) 
WHERE subscription_status = 'free';

-- Index for credit-based queries
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);

-- Add comments for documentation
COMMENT ON INDEX idx_users_google_id IS 'Fast lookups for Google OAuth authentication';
COMMENT ON INDEX idx_users_email IS 'Fast email-based user lookups';
COMMENT ON INDEX idx_users_subscription_status IS 'Filter users by subscription type';
COMMENT ON INDEX idx_users_created_at IS 'Analytics queries for user registration trends';
COMMENT ON INDEX idx_users_last_login IS 'Activity tracking and user engagement analytics';
COMMENT ON INDEX idx_users_subscription_created IS 'Subscription analytics over time';
COMMENT ON INDEX idx_users_activity_subscription IS 'Active user analytics by subscription type';
COMMENT ON INDEX idx_users_stripe_customer_id IS 'Billing and payment operations';
COMMENT ON INDEX idx_users_subscription_end_date IS 'Subscription expiration management';
COMMENT ON INDEX idx_users_pro_active IS 'Optimized queries for pro user analytics';
COMMENT ON INDEX idx_users_free_active IS 'Optimized queries for free user analytics';
COMMENT ON INDEX idx_users_credits IS 'Credit-based queries and analytics';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database indexes created successfully!';
    RAISE NOTICE '🚀 Performance optimizations applied:';
    RAISE NOTICE '   • Authentication lookups (google_id, email)';
    RAISE NOTICE '   • Subscription filtering and analytics';
    RAISE NOTICE '   • User activity tracking';
    RAISE NOTICE '   • Billing operations (Stripe integration)';
    RAISE NOTICE '   • Credit system queries';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Run 03-create-functions.sql';
END $$;
