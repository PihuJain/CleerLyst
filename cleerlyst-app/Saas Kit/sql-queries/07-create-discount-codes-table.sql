-- ============================================================================
-- CREATE DISCOUNT CODES TABLE FOR BEST SAAS KIT V2
-- ============================================================================
-- This script creates the discount_codes table for managing promotional codes
-- that integrate with Stripe coupons for checkout discounts.
-- ============================================================================

-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Discount code details
    code VARCHAR(50) NOT NULL UNIQUE,
    stripe_coupon_id VARCHAR(255), -- Stripe coupon ID for integration
    
    -- Discount configuration
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL, -- percentage (1-100) or cents for fixed amount
    
    -- Usage limits and tracking
    max_uses INTEGER DEFAULT NULL, -- NULL = unlimited uses
    current_uses INTEGER DEFAULT 0 NOT NULL,
    
    -- Expiration and status
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = no expiry
    is_active BOOLEAN DEFAULT true NOT NULL,
    
    -- Admin tracking
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT discount_codes_value_check CHECK (
        (discount_type = 'percentage' AND discount_value BETWEEN 1 AND 100) OR
        (discount_type = 'fixed' AND discount_value > 0)
    ),
    CONSTRAINT discount_codes_uses_check CHECK (current_uses >= 0),
    CONSTRAINT discount_codes_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0)
);

-- Add table comment
COMMENT ON TABLE discount_codes IS 'Discount codes for promotional pricing with Stripe integration';

-- Add column comments
COMMENT ON COLUMN discount_codes.id IS 'Primary key - auto-incrementing discount code ID';
COMMENT ON COLUMN discount_codes.code IS 'Unique discount code string (e.g., SAVE20, WELCOME10)';
COMMENT ON COLUMN discount_codes.stripe_coupon_id IS 'Corresponding Stripe coupon ID for checkout integration';
COMMENT ON COLUMN discount_codes.discount_type IS 'Type of discount: percentage or fixed amount';
COMMENT ON COLUMN discount_codes.discount_value IS 'Discount value: 1-100 for percentage, cents for fixed';
COMMENT ON COLUMN discount_codes.max_uses IS 'Maximum number of uses allowed (NULL = unlimited)';
COMMENT ON COLUMN discount_codes.current_uses IS 'Current number of times this code has been used';
COMMENT ON COLUMN discount_codes.expires_at IS 'Expiration timestamp (NULL = never expires)';
COMMENT ON COLUMN discount_codes.is_active IS 'Whether the discount code is currently active';
COMMENT ON COLUMN discount_codes.created_by IS 'Admin user who created this discount code';
COMMENT ON COLUMN discount_codes.created_at IS 'Timestamp when discount code was created';
COMMENT ON COLUMN discount_codes.updated_at IS 'Timestamp when discount code was last updated';

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON discount_codes(expires_at) WHERE expires_at IS NOT NULL;

-- Admin management indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_created_by ON discount_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_discount_codes_created_at ON discount_codes(created_at);

-- Stripe integration index
CREATE INDEX IF NOT EXISTS idx_discount_codes_stripe_coupon ON discount_codes(stripe_coupon_id) WHERE stripe_coupon_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_discount_codes_active_valid ON discount_codes(is_active, expires_at, max_uses, current_uses);
CREATE INDEX IF NOT EXISTS idx_discount_codes_usage_tracking ON discount_codes(current_uses, max_uses) WHERE max_uses IS NOT NULL;

-- ============================================================================
-- CREATE TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_discount_codes_updated_at
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREATE UTILITY FUNCTIONS
-- ============================================================================

-- Function to validate if a discount code can be used
CREATE OR REPLACE FUNCTION validate_discount_code(
    p_code VARCHAR(50)
) RETURNS TABLE(
    is_valid BOOLEAN,
    discount_id INTEGER,
    discount_type VARCHAR(20),
    discount_value INTEGER,
    error_message TEXT
) AS $$
DECLARE
    discount_record RECORD;
BEGIN
    -- Get discount code details
    SELECT * INTO discount_record
    FROM discount_codes
    WHERE code = p_code;
    
    -- Check if code exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::INTEGER, NULL::VARCHAR(20), NULL::INTEGER, 'Invalid discount code'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code is active
    IF NOT discount_record.is_active THEN
        RETURN QUERY SELECT false, discount_record.id, discount_record.discount_type, discount_record.discount_value, 'Discount code is no longer active'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code has expired
    IF discount_record.expires_at IS NOT NULL AND discount_record.expires_at < CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT false, discount_record.id, discount_record.discount_type, discount_record.discount_value, 'Discount code has expired'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code has reached max uses
    IF discount_record.max_uses IS NOT NULL AND discount_record.current_uses >= discount_record.max_uses THEN
        RETURN QUERY SELECT false, discount_record.id, discount_record.discount_type, discount_record.discount_value, 'Discount code has reached maximum usage limit'::TEXT;
        RETURN;
    END IF;
    
    -- Code is valid
    RETURN QUERY SELECT true, discount_record.id, discount_record.discount_type, discount_record.discount_value, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to increment discount code usage
CREATE OR REPLACE FUNCTION increment_discount_usage(
    p_code VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE discount_codes
    SET current_uses = current_uses + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      AND (max_uses IS NULL OR current_uses < max_uses);
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get discount code statistics
CREATE OR REPLACE FUNCTION get_discount_stats()
RETURNS TABLE(
    total_codes INTEGER,
    active_codes INTEGER,
    expired_codes INTEGER,
    used_codes INTEGER,
    total_usage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_codes,
        COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_codes,
        COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)::INTEGER as expired_codes,
        COUNT(*) FILTER (WHERE current_uses > 0)::INTEGER as used_codes,
        COALESCE(SUM(current_uses), 0)::INTEGER as total_usage
    FROM discount_codes;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION validate_discount_code(VARCHAR) IS 'Validates if a discount code can be used and returns details';
COMMENT ON FUNCTION increment_discount_usage(VARCHAR) IS 'Increments the usage count for a valid discount code';
COMMENT ON FUNCTION get_discount_stats() IS 'Returns statistics about discount codes usage';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Discount codes table created successfully!';
    RAISE NOTICE '📊 Table: discount_codes';
    RAISE NOTICE '🔑 Primary key: id (SERIAL)';
    RAISE NOTICE '🔐 Unique constraint: code';
    RAISE NOTICE '💰 Discount types: percentage, fixed';
    RAISE NOTICE '🎯 Features: usage limits, expiration, Stripe integration';
    RAISE NOTICE '⚙️  Functions: validate_discount_code, increment_discount_usage, get_discount_stats';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Update your application code to use discount functionality';
END $$;
