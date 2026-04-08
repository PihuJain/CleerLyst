-- ============================================================================
-- BEST SAAS KIT V2 - DATABASE FUNCTIONS AND TRIGGERS
-- ============================================================================
-- This file creates utility functions and triggers for the Best SAAS Kit V2
-- Execute this file after creating tables and indexes

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

-- Function to get user statistics (used by admin dashboard)
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
    -- Get current credits
    SELECT credits INTO current_credits FROM users WHERE id = user_id;
    
    -- Check if user exists
    IF current_credits IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found';
        RETURN;
    END IF;
    
    -- Calculate new credits
    new_credits := current_credits + credit_amount;
    
    -- Ensure credits don't go below 0
    IF new_credits < 0 THEN
        new_credits := 0;
    END IF;
    
    -- Update user credits
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
    -- Get current credits
    SELECT credits INTO current_credits FROM users WHERE id = user_id;
    
    -- Check if user exists
    IF current_credits IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found';
        RETURN;
    END IF;
    
    -- Check if user has enough credits
    IF current_credits < credit_amount THEN
        RETURN QUERY SELECT FALSE, current_credits, 'Insufficient credits';
        RETURN;
    END IF;
    
    -- Calculate new credits
    new_credits := current_credits - credit_amount;
    
    -- Update user credits
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
    -- Update user subscription
    UPDATE users SET 
        subscription_status = 'pro',
        stripe_customer_id = stripe_customer_id_param,
        subscription_id = subscription_id_param,
        credits = credits + 1000,  -- Add bonus credits for pro users
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
    
    -- Check if update was successful
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'User upgraded to pro successfully';
    ELSE
        RETURN QUERY SELECT FALSE, 'User not found';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on record changes';
COMMENT ON FUNCTION get_user_stats() IS 'Returns comprehensive user statistics for admin dashboard';
COMMENT ON FUNCTION get_revenue_stats() IS 'Returns revenue and subscription statistics';
COMMENT ON FUNCTION add_user_credits(INTEGER, INTEGER) IS 'Safely adds credits to user account';
COMMENT ON FUNCTION deduct_user_credits(INTEGER, INTEGER) IS 'Safely deducts credits from user account';
COMMENT ON FUNCTION upgrade_user_to_pro(INTEGER, VARCHAR, VARCHAR) IS 'Upgrades user to pro subscription';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database functions and triggers created successfully!';
    RAISE NOTICE '🔧 Functions created:';
    RAISE NOTICE '   • update_updated_at_column() - Auto timestamp updates';
    RAISE NOTICE '   • get_user_stats() - User analytics';
    RAISE NOTICE '   • get_revenue_stats() - Revenue analytics';
    RAISE NOTICE '   • add_user_credits() - Credit management';
    RAISE NOTICE '   • deduct_user_credits() - Credit deduction';
    RAISE NOTICE '   • upgrade_user_to_pro() - Subscription management';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Triggers created:';
    RAISE NOTICE '   • update_users_updated_at - Auto-update timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Run 04-insert-sample-data.sql (optional)';
END $$;
