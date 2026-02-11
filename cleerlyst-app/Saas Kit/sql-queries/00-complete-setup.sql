-- ============================================================================
-- BEST SAAS KIT V2 - COMPLETE DATABASE SETUP
-- ============================================================================
-- This file runs the complete database setup for Best SAAS Kit V2
-- It executes all necessary SQL files in the correct order
-- 
-- ⚠️  IMPORTANT: Only run this on a fresh database!
-- ⚠️  This will create tables, indexes, functions, and sample data

-- Display welcome message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚀 BEST SAAS KIT V2 - DATABASE SETUP';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 This script will set up your complete database:';
    RAISE NOTICE '   1. Create users table';
    RAISE NOTICE '   2. Create performance indexes';
    RAISE NOTICE '   3. Create utility functions and triggers';
    RAISE NOTICE '   4. Insert sample data for testing';
    RAISE NOTICE '   5. Verify setup completion';
    RAISE NOTICE '';
    RAISE NOTICE '⏱️  Estimated time: 30-60 seconds';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Starting setup process...';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: CREATE USERS TABLE
-- ============================================================================

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

-- Add table comments
COMMENT ON TABLE users IS 'Main users table storing authentication, subscription, and usage data';

DO $$
BEGIN
    RAISE NOTICE '✅ Step 1/5: Users table created successfully';
END $$;

-- ============================================================================
-- STEP 2: CREATE INDEXES
-- ============================================================================

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_subscription_created ON users(subscription_status, created_at);
CREATE INDEX IF NOT EXISTS idx_users_activity_subscription ON users(last_login, subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription_end_date ON users(subscription_end_date) WHERE subscription_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_pro_active ON users(created_at, last_login) WHERE subscription_status = 'pro';
CREATE INDEX IF NOT EXISTS idx_users_free_active ON users(created_at, last_login) WHERE subscription_status = 'free';
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);

DO $$
BEGIN
    RAISE NOTICE '✅ Step 2/5: Database indexes created successfully';
END $$;

-- ============================================================================
-- STEP 3: CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(
    total_users BIGINT,
    free_users BIGINT,
    pro_users BIGINT,
    active_today BIGINT,
    active_week BIGINT,
    active_month BIGINT,
    new_today BIGINT,
    new_week BIGINT,
    new_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE subscription_status = 'free') as free_users,
        (SELECT COUNT(*) FROM users WHERE subscription_status = 'pro') as pro_users,
        (SELECT COUNT(*) FROM users WHERE last_login >= CURRENT_DATE) as active_today,
        (SELECT COUNT(*) FROM users WHERE last_login >= CURRENT_DATE - INTERVAL '7 days') as active_week,
        (SELECT COUNT(*) FROM users WHERE last_login >= CURRENT_DATE - INTERVAL '30 days') as active_month,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) as new_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_week,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_month;
END;
$$ LANGUAGE plpgsql;

-- Function to get revenue statistics
CREATE OR REPLACE FUNCTION get_revenue_stats()
RETURNS TABLE(
    total_revenue NUMERIC,
    pro_users_count BIGINT,
    average_revenue_per_user NUMERIC,
    monthly_recurring_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) * 99 FROM users WHERE subscription_status = 'pro') as total_revenue,
        (SELECT COUNT(*) FROM users WHERE subscription_status = 'pro') as pro_users_count,
        (SELECT CASE 
            WHEN COUNT(*) > 0 THEN (COUNT(*) * 99.0) / (SELECT COUNT(*) FROM users)::NUMERIC 
            ELSE 0 
         END FROM users WHERE subscription_status = 'pro') as average_revenue_per_user,
        (SELECT COUNT(*) * 99 FROM users WHERE subscription_status = 'pro') as monthly_recurring_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to safely add credits to a user
CREATE OR REPLACE FUNCTION add_user_credits(user_id INTEGER, credit_amount INTEGER)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    SELECT credits INTO current_credits FROM users WHERE id = user_id;
    
    IF current_credits IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found';
        RETURN;
    END IF;
    
    new_credits := current_credits + credit_amount;
    
    IF new_credits < 0 THEN
        new_credits := 0;
    END IF;
    
    UPDATE users SET credits = new_credits WHERE id = user_id;
    
    RETURN QUERY SELECT TRUE, new_credits, 'Credits updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to deduct credits safely
CREATE OR REPLACE FUNCTION deduct_user_credits(user_id INTEGER, credit_amount INTEGER)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    SELECT credits INTO current_credits FROM users WHERE id = user_id;
    
    IF current_credits IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found';
        RETURN;
    END IF;
    
    IF current_credits < credit_amount THEN
        RETURN QUERY SELECT FALSE, current_credits, 'Insufficient credits';
        RETURN;
    END IF;
    
    new_credits := current_credits - credit_amount;
    UPDATE users SET credits = new_credits WHERE id = user_id;
    
    RETURN QUERY SELECT TRUE, new_credits, 'Credits deducted successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to upgrade user to pro
CREATE OR REPLACE FUNCTION upgrade_user_to_pro(
    user_id INTEGER,
    stripe_customer_id_param VARCHAR(255),
    subscription_id_param VARCHAR(255)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    UPDATE users SET 
        subscription_status = 'pro',
        stripe_customer_id = stripe_customer_id_param,
        subscription_id = subscription_id_param,
        credits = credits + 1000,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'User upgraded to pro successfully';
    ELSE
        RETURN QUERY SELECT FALSE, 'User not found';
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    RAISE NOTICE '✅ Step 3/5: Functions and triggers created successfully';
END $$;

-- ============================================================================
-- STEP 4: INSERT SAMPLE DATA (DEVELOPMENT ONLY)
-- ============================================================================

-- Insert sample users for testing
INSERT INTO users (
    google_id,
    email,
    name,
    image_url,
    credits,
    subscription_status,
    stripe_customer_id,
    created_at,
    last_login
) VALUES
-- Free user samples
(
    'google_123456789',
    'john.doe@example.com',
    'John Doe',
    'https://lh3.googleusercontent.com/a/default-user',
    15,
    'free',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
),
(
    'google_987654321',
    'jane.smith@example.com',
    'Jane Smith',
    'https://lh3.googleusercontent.com/a/default-user-2',
    8,
    'free',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'google_456789123',
    'mike.johnson@example.com',
    'Mike Johnson',
    'https://lh3.googleusercontent.com/a/default-user-3',
    25,
    'free',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
),
-- Pro user samples
(
    'google_789123456',
    'sarah.wilson@example.com',
    'Sarah Wilson',
    'https://lh3.googleusercontent.com/a/default-user-4',
    1250,
    'pro',
    'cus_sample_stripe_customer_1',
    CURRENT_TIMESTAMP - INTERVAL '45 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
),
(
    'google_321654987',
    'alex.brown@example.com',
    'Alex Brown',
    'https://lh3.googleusercontent.com/a/default-user-5',
    890,
    'pro',
    'cus_sample_stripe_customer_2',
    CURRENT_TIMESTAMP - INTERVAL '20 days',
    CURRENT_TIMESTAMP - INTERVAL '30 minutes'
),
-- Recently registered users
(
    'google_147258369',
    'emma.davis@example.com',
    'Emma Davis',
    'https://lh3.googleusercontent.com/a/default-user-6',
    10,
    'free',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'google_963852741',
    'david.miller@example.com',
    'David Miller',
    'https://lh3.googleusercontent.com/a/default-user-7',
    10,
    'free',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
),
-- Active pro user
(
    'google_852741963',
    'lisa.garcia@example.com',
    'Lisa Garcia',
    'https://lh3.googleusercontent.com/a/default-user-8',
    1500,
    'pro',
    'cus_sample_stripe_customer_3',
    CURRENT_TIMESTAMP - INTERVAL '60 days',
    CURRENT_TIMESTAMP - INTERVAL '15 minutes'
);

DO $$
BEGIN
    RAISE NOTICE '✅ Step 4/5: Sample data inserted successfully';
END $$;

-- ============================================================================
-- STEP 5: VERIFY SETUP
-- ============================================================================

DO $$
DECLARE
    user_count INTEGER;
    free_count INTEGER;
    pro_count INTEGER;
    total_credits INTEGER;
    index_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Get statistics
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO free_count FROM users WHERE subscription_status = 'free';
    SELECT COUNT(*) INTO pro_count FROM users WHERE subscription_status = 'pro';
    SELECT COALESCE(SUM(credits), 0) INTO total_credits FROM users;

    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'users' AND schemaname = 'public';

    -- Count functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_updated_at_column',
        'get_user_stats',
        'get_revenue_stats',
        'add_user_credits',
        'deduct_user_credits',
        'upgrade_user_to_pro'
    );

    RAISE NOTICE '✅ Step 5/5: Setup verification completed';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DATABASE SETUP COMPLETE!';
    RAISE NOTICE '========================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Setup Summary:';
    RAISE NOTICE '   ✅ Users table created with % columns',
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public');
    RAISE NOTICE '   ✅ % performance indexes created', index_count;
    RAISE NOTICE '   ✅ % utility functions created', function_count;
    RAISE NOTICE '   ✅ Automatic triggers configured';
    RAISE NOTICE '   ✅ % sample users inserted', user_count;
    RAISE NOTICE '';
    RAISE NOTICE '📈 Sample Data Statistics:';
    RAISE NOTICE '   👥 Total Users: %', user_count;
    RAISE NOTICE '   🆓 Free Users: %', free_count;
    RAISE NOTICE '   💎 Pro Users: %', pro_count;
    RAISE NOTICE '   🪙 Total Credits: %', total_credits;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '   1. Copy your Neon connection string';
    RAISE NOTICE '   2. Add DATABASE_URL to your .env.local file';
    RAISE NOTICE '   3. Test your Next.js application';
    RAISE NOTICE '   4. Try user authentication and features';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Production Note:';
    RAISE NOTICE '   Run 06-cleanup-sample-data.sql before going live!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Your Best SAAS Kit V2 database is ready to use!';
END $$;
