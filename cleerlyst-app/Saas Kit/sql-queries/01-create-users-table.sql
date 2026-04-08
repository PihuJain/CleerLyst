-- ============================================================================
-- BEST SAAS KIT V2 - USERS TABLE
-- ============================================================================
-- This file creates the main users table for the Best SAAS Kit V2
-- Execute this file first before running other SQL files

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Authentication fields
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    image_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Credits system for AI usage
    credits INTEGER DEFAULT 10 NOT NULL,
    
    -- Subscription and billing
    subscription_status VARCHAR(50) DEFAULT 'free' NOT NULL 
        CHECK (subscription_status IN ('free', 'pro')),
    stripe_customer_id VARCHAR(255),
    subscription_id VARCHAR(255),
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_credits_check CHECK (credits >= 0)
);

-- Add comments to table and columns for documentation
COMMENT ON TABLE users IS 'Main users table storing authentication, subscription, and usage data';
COMMENT ON COLUMN users.id IS 'Primary key - auto-incrementing user ID';
COMMENT ON COLUMN users.google_id IS 'Unique Google OAuth ID for authentication';
COMMENT ON COLUMN users.email IS 'User email address - must be unique';
COMMENT ON COLUMN users.name IS 'User display name from Google profile';
COMMENT ON COLUMN users.image_url IS 'URL to user profile image from Google';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user account was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when user record was last updated';
COMMENT ON COLUMN users.last_login IS 'Timestamp of user last login/activity';
COMMENT ON COLUMN users.credits IS 'Number of AI credits available to user (default: 10)';
COMMENT ON COLUMN users.subscription_status IS 'User subscription level: free or pro';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN users.subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN users.subscription_end_date IS 'When subscription expires (NULL for lifetime)';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Users table created successfully!';
    RAISE NOTICE '📊 Table: users';
    RAISE NOTICE '🔑 Primary key: id (SERIAL)';
    RAISE NOTICE '🔐 Unique constraints: google_id, email';
    RAISE NOTICE '💳 Default credits: 10';
    RAISE NOTICE '📅 Default subscription: free';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Run 02-create-indexes.sql';
END $$;
