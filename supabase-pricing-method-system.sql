-- =====================================================
-- PRICING METHOD SYSTEM - MARGIN & PROFIT LADDERS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add pricing method columns to shop_settings
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS default_pricing_method TEXT NOT NULL DEFAULT 'margin_ladder' 
CHECK (default_pricing_method IN ('margin_ladder', 'profit_ladder'));

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS tier_breaks JSONB NOT NULL DEFAULT '[24,48,96,144,288,384,768]';

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS margin_ladder JSONB NOT NULL DEFAULT 
'{"24":0.40,"48":0.38,"96":0.35,"144":0.33,"288":0.31,"384":0.30,"768":0.28}';

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS profit_ladder JSONB NOT NULL DEFAULT 
'{"24":3.00,"48":2.75,"96":2.50,"144":2.25,"288":2.00,"384":1.90,"768":1.75}';

-- Add pricing method override to quotes
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS pricing_method_override TEXT 
CHECK (pricing_method_override IN ('margin_ladder', 'profit_ladder') OR pricing_method_override IS NULL);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_pricing_method ON quotes(pricing_method_override);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
