-- Patch Hat QuoteKit - Pricing System Migration
-- Run this in your Supabase SQL Editor to add new pricing columns

-- Add new pricing columns to shop_settings
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS default_pricing_method TEXT DEFAULT 'markup',
ADD COLUMN IF NOT EXISTS default_markup_pct NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS default_margin_pct NUMERIC DEFAULT 40,
ADD COLUMN IF NOT EXISTS setup_fee_default NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS setup_waive_qty INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS customer_markup_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_price_baseline TEXT DEFAULT 'published',
ADD COLUMN IF NOT EXISTS published_ladder_patch_press JSONB DEFAULT '{
  "1-23": 15.00,
  "24-47": 12.00,
  "48-95": 11.00,
  "96-143": 10.00,
  "144-287": 9.50,
  "288-575": 9.00,
  "576+": 8.50
}'::jsonb,
ADD COLUMN IF NOT EXISTS published_ladder_patch_only JSONB DEFAULT '{
  "1-23": 10.00,
  "24-47": 8.00,
  "48-95": 7.00,
  "96-143": 6.50,
  "144-287": 6.00,
  "288-575": 5.50,
  "576+": 5.00
}'::jsonb;

-- Add comment explaining the columns
COMMENT ON COLUMN shop_settings.default_pricing_method IS 'Either "markup" or "margin" for wholesale calculation';
COMMENT ON COLUMN shop_settings.customer_markup_pct IS 'Pass-through markup % for customer/distributor pricing matrix';
COMMENT ON COLUMN shop_settings.customer_price_baseline IS 'Baseline for customer price: "published" or "wholesale"';
COMMENT ON COLUMN shop_settings.published_ladder_patch_press IS 'Fixed tier prices for Patch+Press quotes (customer-facing)';
COMMENT ON COLUMN shop_settings.published_ladder_patch_only IS 'Fixed tier prices for Patch Only quotes (customer-facing)';
