-- =====================================================
-- PATCH HAT QUOTEKIT - COMPLETE DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1) SHOP SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_overhead NUMERIC NOT NULL DEFAULT 750,
  monthly_owner_pay_goal NUMERIC NOT NULL DEFAULT 2400,
  monthly_profit_goal NUMERIC NOT NULL DEFAULT 1000,
  workable_hours_per_week NUMERIC NOT NULL DEFAULT 30,
  billable_efficiency_pct NUMERIC NOT NULL DEFAULT 70,
  tax_reserve_pct NUMERIC NOT NULL DEFAULT 10,
  default_target_margin_pct NUMERIC NOT NULL DEFAULT 40,
  default_rush_pct NUMERIC NOT NULL DEFAULT 15,
  default_apply_minutes_per_hat NUMERIC NOT NULL DEFAULT 2.0,
  default_proof_minutes NUMERIC NOT NULL DEFAULT 5,
  default_setup_minutes NUMERIC NOT NULL DEFAULT 5,
  default_packing_minutes NUMERIC NOT NULL DEFAULT 5,
  default_gap NUMERIC NOT NULL DEFAULT 0.0625,
  default_border NUMERIC NOT NULL DEFAULT 0.25,
  default_waste_pct NUMERIC NOT NULL DEFAULT 5,
  outline_allowance NUMERIC NOT NULL DEFAULT 0.125,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2) PROFIT FIRST SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profit_first_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profit_pct NUMERIC NOT NULL DEFAULT 5,
  tax_pct NUMERIC NOT NULL DEFAULT 10,
  owner_pay_pct NUMERIC NOT NULL DEFAULT 35,
  ops_pct NUMERIC NOT NULL DEFAULT 45,
  buffer_pct NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3) PATCH MATERIALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS patch_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sheet_width NUMERIC NOT NULL DEFAULT 12,
  sheet_height NUMERIC NOT NULL DEFAULT 24,
  sheet_cost NUMERIC NOT NULL,
  default_machine_minutes_per_sheet NUMERIC NOT NULL DEFAULT 12,
  default_cleanup_minutes_per_sheet NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4) CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5) QUOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL,
  tier_quantities JSONB NOT NULL DEFAULT '[24,48,96,144,384,768]',
  patch_material_id UUID NOT NULL REFERENCES patch_materials(id) ON DELETE RESTRICT,
  patch_width_input NUMERIC NOT NULL,
  patch_height_input NUMERIC NOT NULL,
  patch_size_mode TEXT NOT NULL DEFAULT 'overall' CHECK (patch_size_mode IN ('overall','art')),
  outline_allowance NUMERIC NOT NULL DEFAULT 0.125,
  gap NUMERIC NOT NULL DEFAULT 0.0625,
  border NUMERIC NOT NULL DEFAULT 0.25,
  waste_pct NUMERIC NOT NULL DEFAULT 5,
  yield_method TEXT NOT NULL DEFAULT 'auto' CHECK (yield_method IN ('auto','manual')),
  manual_yield NUMERIC,
  machine_minutes_per_sheet NUMERIC NOT NULL DEFAULT 12,
  cleanup_minutes_per_sheet NUMERIC NOT NULL DEFAULT 5,
  hats_supplied_by TEXT NOT NULL DEFAULT 'customer' CHECK (hats_supplied_by IN ('customer','us')),
  hat_unit_cost NUMERIC NOT NULL DEFAULT 0,
  apply_minutes_per_hat NUMERIC NOT NULL DEFAULT 2.0,
  proof_minutes NUMERIC NOT NULL DEFAULT 5,
  setup_minutes NUMERIC NOT NULL DEFAULT 5,
  packing_minutes NUMERIC NOT NULL DEFAULT 5,
  target_margin_pct NUMERIC NOT NULL DEFAULT 40,
  rush_pct NUMERIC NOT NULL DEFAULT 15,
  turnaround_text TEXT NOT NULL DEFAULT '5–7 business days',
  shipping_charge NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  -- Computed fields
  shop_rate NUMERIC,
  shop_minute_rate NUMERIC,
  best_yield NUMERIC,
  effective_yield NUMERIC,
  material_cost_per_patch NUMERIC,
  labor_cost_per_patch NUMERIC,
  true_cost_per_hat NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  tier_prices_json JSONB,
  quote_sms TEXT,
  quote_dm TEXT,
  quote_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6) FINISHED HAT QUOTES TABLE (NEW FEATURE)
-- =====================================================
CREATE TABLE IF NOT EXISTS finished_hat_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  hat_name TEXT NOT NULL,
  buy_qty INTEGER NOT NULL,
  hat_unit_cost NUMERIC NOT NULL,
  shipping_per_hat NUMERIC NOT NULL DEFAULT 0,
  patch_cost_per_hat NUMERIC NOT NULL,
  apply_minutes_per_hat NUMERIC NOT NULL,
  proof_minutes NUMERIC NOT NULL,
  setup_minutes NUMERIC NOT NULL,
  packing_minutes NUMERIC NOT NULL,
  -- Pricing method
  pricing_method TEXT NOT NULL DEFAULT 'margin' CHECK (pricing_method IN ('margin','markup')),
  target_margin_pct NUMERIC NOT NULL DEFAULT 40,
  markup_multiplier NUMERIC NOT NULL DEFAULT 2.0,
  -- Tiers
  tier_quantities JSONB NOT NULL DEFAULT '[12,24,48,96,144,288,384,768]',
  -- Computed fields
  shop_rate NUMERIC,
  shop_minute_rate NUMERIC,
  true_cost_per_hat NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  tier_prices_json JSONB,
  tier_quote_text TEXT,
  -- Metadata
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7) ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_first_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patch_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_hat_quotes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8) CREATE RLS POLICIES
-- =====================================================

-- Shop Settings Policies
CREATE POLICY "Users can view their own shop settings"
  ON shop_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shop settings"
  ON shop_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shop settings"
  ON shop_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shop settings"
  ON shop_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Profit First Settings Policies
CREATE POLICY "Users can view their own profit first settings"
  ON profit_first_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profit first settings"
  ON profit_first_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profit first settings"
  ON profit_first_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profit first settings"
  ON profit_first_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Patch Materials Policies
CREATE POLICY "Users can view their own patch materials"
  ON patch_materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patch materials"
  ON patch_materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patch materials"
  ON patch_materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patch materials"
  ON patch_materials FOR DELETE
  USING (auth.uid() = user_id);

-- Customers Policies
CREATE POLICY "Users can view their own customers"
  ON customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own customers"
  ON customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers"
  ON customers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers"
  ON customers FOR DELETE
  USING (auth.uid() = user_id);

-- Quotes Policies
CREATE POLICY "Users can view their own quotes"
  ON quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotes"
  ON quotes FOR DELETE
  USING (auth.uid() = user_id);

-- Finished Hat Quotes Policies
CREATE POLICY "Users can view their own finished hat quotes"
  ON finished_hat_quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own finished hat quotes"
  ON finished_hat_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own finished hat quotes"
  ON finished_hat_quotes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own finished hat quotes"
  ON finished_hat_quotes FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 9) CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_shop_settings_user_id ON shop_settings(user_id);
CREATE INDEX idx_profit_first_settings_user_id ON profit_first_settings(user_id);
CREATE INDEX idx_patch_materials_user_id ON patch_materials(user_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_finished_hat_quotes_user_id ON finished_hat_quotes(user_id);
CREATE INDEX idx_finished_hat_quotes_customer_id ON finished_hat_quotes(customer_id);
CREATE INDEX idx_finished_hat_quotes_status ON finished_hat_quotes(status);

-- =====================================================
-- 10) CREATE UPDATE TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_shop_settings_updated_at ON shop_settings;
DROP TRIGGER IF EXISTS update_profit_first_settings_updated_at ON profit_first_settings;
DROP TRIGGER IF EXISTS update_patch_materials_updated_at ON patch_materials;
DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
DROP TRIGGER IF EXISTS update_finished_hat_quotes_updated_at ON finished_hat_quotes;

-- Create triggers
CREATE TRIGGER update_shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profit_first_settings_updated_at
  BEFORE UPDATE ON profit_first_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patch_materials_updated_at
  BEFORE UPDATE ON patch_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finished_hat_quotes_updated_at
  BEFORE UPDATE ON finished_hat_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Next steps:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Verify tables appear in Table Editor
-- 5. Configure authentication redirect URLs:
--    - Go to Authentication > URL Configuration
--    - Add: http://localhost:3000/** and http://localhost:3000/auth/callback
-- =====================================================
