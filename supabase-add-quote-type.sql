-- =====================================================
-- ADD QUOTE TYPE TO EXISTING QUOTES TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add quote_type column to existing quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_type TEXT NOT NULL DEFAULT 'patch_press' 
CHECK (quote_type IN ('patch_only', 'patch_press'));

-- Make apply_minutes_per_hat nullable since it's not used for patch_only
ALTER TABLE quotes 
ALTER COLUMN apply_minutes_per_hat DROP NOT NULL;

-- Make hats_supplied_by nullable since it's not used for patch_only
ALTER TABLE quotes 
ALTER COLUMN hats_supplied_by DROP NOT NULL;

-- Add optional units_label for convenience
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS units_label TEXT DEFAULT 'hat';

-- Create index on quote_type for filtering
CREATE INDEX IF NOT EXISTS idx_quotes_quote_type ON quotes(quote_type);

-- Update existing quotes to have patch_press as default (backwards compatible)
UPDATE quotes SET quote_type = 'patch_press' WHERE quote_type IS NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Verify by running: SELECT quote_type, count(*) FROM quotes GROUP BY quote_type;
-- =====================================================
