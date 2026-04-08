-- ============================================================================
-- BEST SAAS KIT V2 - DATABASE SETUP VERIFICATION
-- ============================================================================
-- This file verifies that your database setup is complete and working correctly
-- Run this file after executing all previous SQL files

-- Check if users table exists and has correct structure
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
BEGIN
    -- Check if users table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Users table exists';
        
        -- Count columns
        SELECT COUNT(*) INTO column_count
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public';
        
        RAISE NOTICE '📊 Users table has % columns', column_count;
    ELSE
        RAISE NOTICE '❌ Users table does not exist!';
        RAISE NOTICE '➡️  Please run 01-create-users-table.sql first';
    END IF;
END $$;

-- Verify indexes exist
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE tablename = 'users' AND schemaname = 'public';
    
    RAISE NOTICE '🔍 Found % indexes on users table', index_count;
    
    IF index_count >= 8 THEN
        RAISE NOTICE '✅ Indexes are properly created';
    ELSE
        RAISE NOTICE '⚠️  Some indexes may be missing';
        RAISE NOTICE '➡️  Please run 02-create-indexes.sql';
    END IF;
END $$;

-- Verify functions exist
DO $$
DECLARE
    function_count INTEGER;
BEGIN
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
    
    RAISE NOTICE '⚙️  Found % custom functions', function_count;
    
    IF function_count >= 6 THEN
        RAISE NOTICE '✅ All functions are created';
    ELSE
        RAISE NOTICE '⚠️  Some functions may be missing';
        RAISE NOTICE '➡️  Please run 03-create-functions.sql';
    END IF;
END $$;

-- Verify triggers exist
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE event_object_table = 'users'
    AND trigger_schema = 'public';
    
    RAISE NOTICE '⚡ Found % triggers on users table', trigger_count;
    
    IF trigger_count >= 1 THEN
        RAISE NOTICE '✅ Triggers are properly created';
    ELSE
        RAISE NOTICE '⚠️  Triggers may be missing';
        RAISE NOTICE '➡️  Please run 03-create-functions.sql';
    END IF;
END $$;

-- Test database functions
DO $$
DECLARE
    stats_result RECORD;
    revenue_result RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Testing database functions...';
    
    -- Test get_user_stats function
    BEGIN
        SELECT * INTO stats_result FROM get_user_stats() LIMIT 1;
        RAISE NOTICE '✅ get_user_stats() function works correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ get_user_stats() function failed: %', SQLERRM;
    END;
    
    -- Test get_revenue_stats function
    BEGIN
        SELECT * INTO revenue_result FROM get_revenue_stats() LIMIT 1;
        RAISE NOTICE '✅ get_revenue_stats() function works correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ get_revenue_stats() function failed: %', SQLERRM;
    END;
END $$;

-- Display current database statistics
DO $$
DECLARE
    user_count INTEGER;
    free_count INTEGER;
    pro_count INTEGER;
    total_credits INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO free_count FROM users WHERE subscription_status = 'free';
    SELECT COUNT(*) INTO pro_count FROM users WHERE subscription_status = 'pro';
    SELECT COALESCE(SUM(credits), 0) INTO total_credits FROM users;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Current Database Statistics:';
    RAISE NOTICE '   👥 Total Users: %', user_count;
    RAISE NOTICE '   🆓 Free Users: %', free_count;
    RAISE NOTICE '   💎 Pro Users: %', pro_count;
    RAISE NOTICE '   🪙 Total Credits: %', total_credits;
END $$;

-- Final verification summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Database Setup Verification Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ What to do next:';
    RAISE NOTICE '   1. Update your .env.local with the DATABASE_URL';
    RAISE NOTICE '   2. Test your Next.js application connection';
    RAISE NOTICE '   3. Try user authentication and registration';
    RAISE NOTICE '   4. Test the credit system and subscriptions';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Connection String Format:';
    RAISE NOTICE '   DATABASE_URL=postgresql://username:password@host/database?sslmode=require';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Need help? Check the main README.md file';
    RAISE NOTICE '🐛 Issues? Open a GitHub issue';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your Best SAAS Kit V2 database is ready!';
END $$;
