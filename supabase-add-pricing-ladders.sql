-- =====================================================
-- ADD PRICING LADDERS TO SHOP SETTINGS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add pricing system columns to shop_settings
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS default_pricing_mode TEXT NOT NULL DEFAULT 'profit' 
CHECK (default_pricing_mode IN ('fixed', 'profit'));

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS setup_fee_default NUMERIC NOT NULL DEFAULT 30;

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS setup_waive_qty INTEGER NOT NULL DEFAULT 12;

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS min_tier_stepdown NUMERIC NOT NULL DEFAULT 0.05;

-- Fixed ladder prices (direct $/unit for each tier)
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS fixed_ladder_patch_press JSONB NOT NULL DEFAULT '{"24": 12.00, "48": 11.50, "96": 11.00, "144": 10.50, "384": 10.00, "768": 9.50}';

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS fixed_ladder_patch_only JSONB NOT NULL DEFAULT '{"24": 8.00, "48": 7.50, "96": 7.00, "144": 6.50, "384": 6.00, "768": 5.50}';

-- Profit-based multipliers (for each tier)
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS profit_multipliers_patch_press JSONB NOT NULL DEFAULT '{"24": 1.00, "48": 0.92, "96": 0.85, "144": 0.80, "384": 0.72, "768": 0.65}';

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS profit_multipliers_patch_only JSONB NOT NULL DEFAULT '{"24": 1.00, "48": 0.92, "96": 0.85, "144": 0.80, "384": 0.72, "768": 0.65}';

-- Default profit anchors for each quote type
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS default_profit_anchor_patch_press NUMERIC NOT NULL DEFAULT 3.00;

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS default_profit_anchor_patch_only NUMERIC NOT NULL DEFAULT 2.00;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
