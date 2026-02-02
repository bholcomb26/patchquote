#!/usr/bin/env python3
"""
Direct calculation engine testing for stack overflow and recursion issues
"""

import subprocess
import sys
import json

def test_calculation_engine():
    """Test the calculation engine directly using Node.js"""
    
    test_script = """
const {
  calculateCompleteQuote,
  calculatePatchOnlyQuote,
  calculateShopRates,
  calculateAutoYield,
  calculateProfitTierPricing,
  calculateFixedTierPricing
} = require('./lib/calculations.js');

console.log('🧮 Testing Calculation Engine...');

// Test data
const shopSettings = {
  workable_hours_per_week: 40,
  billable_efficiency_pct: 75,
  monthly_overhead: 5000,
  monthly_owner_pay_goal: 8000,
  monthly_profit_goal: 3000,
  default_pricing_mode: 'profit',
  setup_fee_default: 30,
  setup_waive_qty: 12,
  min_tier_stepdown: 0.05,
  profit_multipliers_patch_press: {
    "24": 1.00,
    "48": 0.92,
    "96": 0.85,
    "144": 0.80,
    "384": 0.72,
    "768": 0.65
  },
  default_profit_anchor_patch_press: 3.00
};

const material = {
  name: 'Test Leatherette',
  sheet_width: 12,
  sheet_height: 24,
  sheet_cost: 10.00,
  default_machine_minutes_per_sheet: 15,
  default_cleanup_minutes_per_sheet: 5
};

const quoteData = {
  qty: 48,
  patch_width_input: 3.0,
  patch_height_input: 2.5,
  patch_size_mode: 'art',
  outline_allowance: 0.125,
  yield_method: 'auto',
  gap: 0.25,
  border: 0.5,
  waste_pct: 10,
  machine_minutes_per_sheet: 12,
  cleanup_minutes_per_sheet: 5,
  proof_minutes: 30,
  setup_minutes: 15,
  packing_minutes: 10,
  apply_minutes_per_hat: 2,
  hats_supplied_by: 'customer',
  hat_unit_cost: 0,
  target_margin_pct: 65,
  rush_pct: 0,
  shipping_charge: 0,
  turnaround_text: '5-7 business days',
  quote_type: 'patch_press'
};

try {
  console.log('✅ Testing shop rates calculation...');
  const shopRates = calculateShopRates(shopSettings);
  console.log('Shop rates:', JSON.stringify(shopRates, null, 2));

  console.log('✅ Testing auto yield calculation...');
  const yieldCalc = calculateAutoYield(material, 3.125, 2.625, 0.25, 0.5);
  console.log('Yield calculation:', JSON.stringify(yieldCalc, null, 2));

  console.log('✅ Testing complete quote calculation...');
  const completeQuote = calculateCompleteQuote(quoteData, shopSettings, material);
  console.log('Complete quote keys:', Object.keys(completeQuote));
  console.log('Unit price:', completeQuote.unit_price);
  console.log('Total price:', completeQuote.total_price);

  console.log('✅ Testing patch only quote calculation...');
  const patchOnlyData = { ...quoteData, quote_type: 'patch_only' };
  const patchOnlyQuote = calculatePatchOnlyQuote(patchOnlyData, shopSettings, material);
  console.log('Patch only quote keys:', Object.keys(patchOnlyQuote));
  console.log('Unit price:', patchOnlyQuote.unit_price);
  console.log('Total price:', patchOnlyQuote.total_price);

  console.log('✅ Testing profit tier pricing...');
  const calculateTrueCostAtQty = (tierQty) => {
    const orderMinutes = 30 + 15 + 10;
    const orderLabor = orderMinutes * (shopRates.shopMinuteRate || 1);
    const orderLaborPerHat = orderLabor / tierQty;
    return 5.0 + orderLaborPerHat; // simplified
  };
  
  const profitTiers = calculateProfitTierPricing(
    calculateTrueCostAtQty,
    shopSettings.profit_multipliers_patch_press,
    3.00,
    48,
    30,
    12,
    0.05
  );
  console.log('Profit tier pricing keys:', Object.keys(profitTiers));

  console.log('✅ All calculation tests passed! No stack overflow detected.');
  
} catch (error) {
  console.error('❌ Calculation error:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
"""
    
    try:
        # Write test script to temporary file
        with open('/tmp/calc_test.js', 'w') as f:
            f.write(test_script)
        
        # Run the test
        result = subprocess.run(
            ['node', '/tmp/calc_test.js'],
            cwd='/app',
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print("=== Calculation Engine Test Results ===")
        print("STDOUT:")
        print(result.stdout)
        
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        print(f"Exit code: {result.returncode}")
        
        if result.returncode == 0:
            print("✅ Calculation engine test PASSED - No stack overflow issues")
            return True
        else:
            print("❌ Calculation engine test FAILED")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Calculation engine test TIMED OUT - Possible infinite loop")
        return False
    except Exception as e:
        print(f"❌ Error running calculation test: {e}")
        return False

if __name__ == "__main__":
    success = test_calculation_engine()
    sys.exit(0 if success else 1)