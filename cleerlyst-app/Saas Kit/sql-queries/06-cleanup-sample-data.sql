-- ============================================================================
-- BEST SAAS KIT V2 - CLEANUP SAMPLE DATA
-- ============================================================================
-- This file removes sample data from the database
-- ⚠️  WARNING: This will delete all sample users!
-- Use this before going to production or when you want to start fresh

-- Safety check and confirmation
DO $$
DECLARE
    user_count INTEGER;
    sample_users INTEGER;
BEGIN
    -- Count total users
    SELECT COUNT(*) INTO user_count FROM users;
    
    -- Count sample users (those with @example.com emails)
    SELECT COUNT(*) INTO sample_users FROM users WHERE email LIKE '%@example.com';
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹 SAMPLE DATA CLEANUP';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Current Database State:';
    RAISE NOTICE '   👥 Total Users: %', user_count;
    RAISE NOTICE '   🧪 Sample Users: %', sample_users;
    RAISE NOTICE '   👤 Real Users: %', user_count - sample_users;
    RAISE NOTICE '';
    
    IF sample_users = 0 THEN
        RAISE NOTICE '✅ No sample data found to clean up';
        RAISE NOTICE '🎯 Database is already clean';
        RETURN;
    END IF;
    
    RAISE NOTICE '⚠️  WARNING: This will delete % sample users!', sample_users;
    RAISE NOTICE '🔒 Real users (non-@example.com) will be preserved';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Proceeding with cleanup...';
END $$;

-- Delete sample users (those with @example.com emails)
DELETE FROM users WHERE email LIKE '%@example.com';

-- Get the number of deleted rows
DO $$
DECLARE
    deleted_count INTEGER;
    remaining_count INTEGER;
BEGIN
    -- This is an approximation since we can't get the exact count from DELETE
    SELECT COUNT(*) INTO remaining_count FROM users;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sample data cleanup completed!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Cleanup Results:';
    RAISE NOTICE '   🗑️  Sample users removed: All @example.com users';
    RAISE NOTICE '   👥 Remaining users: %', remaining_count;
    RAISE NOTICE '';
    
    IF remaining_count = 0 THEN
        RAISE NOTICE '🆕 Database is now empty and ready for production';
        RAISE NOTICE '🎯 First real user will get ID = 1';
    ELSE
        RAISE NOTICE '👤 Real user accounts preserved';
        RAISE NOTICE '🔒 Production data is safe';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ What to do next:';
    RAISE NOTICE '   1. Your database is now clean of sample data';
    RAISE NOTICE '   2. Deploy your application to production';
    RAISE NOTICE '   3. Real users can now register normally';
    RAISE NOTICE '   4. Monitor your analytics dashboard';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Your Best SAAS Kit V2 is production-ready!';
END $$;

-- Optional: Reset the sequence if database is completely empty
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    
    IF user_count = 0 THEN
        -- Reset the ID sequence to start from 1
        ALTER SEQUENCE users_id_seq RESTART WITH 1;
        RAISE NOTICE '🔄 User ID sequence reset to start from 1';
    END IF;
END $$;
