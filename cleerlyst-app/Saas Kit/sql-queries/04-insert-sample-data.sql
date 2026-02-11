-- ============================================================================
-- BEST SAAS KIT V2 - SAMPLE DATA
-- ============================================================================
-- This file inserts sample data for testing and development
-- ⚠️  WARNING: Only run this in development environments!
-- ⚠️  Do NOT run this in production!

-- Check if this is a development environment
DO $$
BEGIN
    -- Only proceed if there are no existing users (fresh database)
    IF (SELECT COUNT(*) FROM users) > 0 THEN
        RAISE EXCEPTION 'Database already contains users. Sample data insertion cancelled for safety.';
    END IF;
    
    RAISE NOTICE '🧪 Inserting sample data for development and testing...';
    RAISE NOTICE '⚠️  This should only be run in development environments!';
END $$;

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

-- Display sample data statistics
DO $$
DECLARE
    total_users INTEGER;
    free_users INTEGER;
    pro_users INTEGER;
    total_credits INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO free_users FROM users WHERE subscription_status = 'free';
    SELECT COUNT(*) INTO pro_users FROM users WHERE subscription_status = 'pro';
    SELECT SUM(credits) INTO total_credits FROM users;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sample data inserted successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Sample Data Summary:';
    RAISE NOTICE '   👥 Total Users: %', total_users;
    RAISE NOTICE '   🆓 Free Users: %', free_users;
    RAISE NOTICE '   💎 Pro Users: %', pro_users;
    RAISE NOTICE '   🪙 Total Credits: %', total_credits;
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Sample Users Created:';
    RAISE NOTICE '   • john.doe@example.com (Free, 15 credits)';
    RAISE NOTICE '   • jane.smith@example.com (Free, 8 credits)';
    RAISE NOTICE '   • mike.johnson@example.com (Free, 25 credits)';
    RAISE NOTICE '   • sarah.wilson@example.com (Pro, 1250 credits)';
    RAISE NOTICE '   • alex.brown@example.com (Pro, 890 credits)';
    RAISE NOTICE '   • emma.davis@example.com (Free, 10 credits)';
    RAISE NOTICE '   • david.miller@example.com (Free, 10 credits)';
    RAISE NOTICE '   • lisa.garcia@example.com (Pro, 1500 credits)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Use these for testing:';
    RAISE NOTICE '   • Authentication flows';
    RAISE NOTICE '   • Subscription management';
    RAISE NOTICE '   • Credit system';
    RAISE NOTICE '   • Analytics dashboard';
    RAISE NOTICE '   • User management features';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Remember: This is sample data for development only!';
    RAISE NOTICE '🗑️  Delete this data before going to production!';
END $$;
