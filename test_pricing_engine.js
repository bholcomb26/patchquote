#!/usr/bin/env node
/**
 * Direct Pricing Engine Testing
 * Tests the new unified pricing engine functions directly
 */

import {
  computeQuote,
  calculateCompleteQuote,
  formatMoney,
  roundToCents,
  formatPct,
  TIER_RANGES,
  getTierForQty,
  calculateShopRate,
  calculateYield,
  calculateCostAtQty,
  calculateWholesale,
  getPublishedPrice,
  calculateCustomerPrice
} from './lib/pricingEngine.js';

class PricingEngineDirectTester {
  constructor() {
    this.testResults = [];
  }

  log(testName, success, message, details = {}) {
    const result = { test: testName, success, message, details };
    this.testResults.push(result);
    const status = success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${testName}: ${message}`);
    if (!success && Object.keys(details).length > 0) {
      console.log(`   Details:`, details);
    }
  }

  testFormatting() {
    console.log("\n=== Testing Formatting Functions ===");
    
    // Test formatMoney
    const testValues = [10.123, 5.99, 0, 15.1, 100];
    let formatErrors = [];
    
    for (const value of testValues) {
      const formatted = formatMoney(value);
      if (!formatted.startsWith('$')) {
        formatErrors.push(`${value} -> ${formatted} (no $ prefix)`);
      } else if (!formatted.match(/\$\d+\.\d{2}$/)) {
        formatErrors.push(`${value} -> ${formatted} (not 2 decimal places)`);
      }
    }
    
    if (formatErrors.length > 0) {
      this.log("Format Money", false, "Money formatting issues", { errors: formatErrors });
    } else {
      this.log("Format Money", true, "All money values formatted correctly with $X.XX");
    }
    
    // Test roundToCents
    const roundingTests = [
      { input: 10.123, expected: 10.12 },
      { input: 5.999, expected: 6.00 },
      { input: 0.001, expected: 0.00 },
      { input: null, expected: 0 },
      { input: undefined, expected: 0 }
    ];
    
    let roundingErrors = [];
    for (const test of roundingTests) {
      const result = roundToCents(test.input);
      if (Math.abs(result - test.expected) > 0.001) {
        roundingErrors.push(`${test.input} -> ${result}, expected ${test.expected}`);
      }
    }
    
    if (roundingErrors.length > 0) {
      this.log("Round To Cents", false, "Rounding issues", { errors: roundingErrors });
    } else {
      this.log("Round To Cents", true, "All values rounded correctly to cents");
    }
  }

  testTierSystem() {
    console.log("\n=== Testing Tier System ===");
    
    // Test tier ranges
    if (TIER_RANGES.length !== 7) {
      this.log("Tier Count", false, `Expected 7 tiers, got ${TIER_RANGES.length}`);
      return;
    }
    
    this.log("Tier Count", true, "Correct number of tiers (7)");
    
    // Test tier lookup
    const testQuantities = [1, 24, 48, 96, 144, 288, 576, 1000];
    let tierErrors = [];
    
    for (const qty of testQuantities) {
      const tier = getTierForQty(qty);
      if (!tier || !tier.key) {
        tierErrors.push(`Qty ${qty} -> no tier found`);
      }
    }
    
    if (tierErrors.length > 0) {
      this.log("Tier Lookup", false, "Tier lookup issues", { errors: tierErrors });
    } else {
      this.log("Tier Lookup", true, "All quantities map to correct tiers");
    }
  }

  testShopRateCalculation() {
    console.log("\n=== Testing Shop Rate Calculation ===");
    
    const testSettings = {
      workable_hours_per_week: 40,
      billable_efficiency_pct: 75,
      monthly_overhead: 3000,
      monthly_owner_pay_goal: 5000,
      monthly_profit_goal: 2000
    };
    
    try {
      const shopRate = calculateShopRate(testSettings);
      
      if (typeof shopRate !== 'number' || shopRate <= 0) {
        this.log("Shop Rate Calculation", false, `Invalid shop rate: ${shopRate}`);
      } else {
        this.log("Shop Rate Calculation", true, `Shop rate calculated: $${shopRate}/hour`);
      }
    } catch (error) {
      this.log("Shop Rate Calculation", false, `Error: ${error.message}`, { error: error.stack });
    }
  }

  testYieldCalculation() {
    console.log("\n=== Testing Yield Calculation ===");
    
    const material = {
      sheet_width: 12,
      sheet_height: 24,
      sheet_cost: 7
    };
    
    const yieldParams = {
      material,
      patchWidthInput: 3.25,
      patchHeightInput: 2.25,
      patchSizeMode: 'art',
      outlineAllowance: 0.125,
      gap: 0.0625,
      border: 0.25,
      wastePct: 5,
      yieldMethod: 'auto'
    };
    
    try {
      const yieldResult = calculateYield(yieldParams);
      
      if (!yieldResult || typeof yieldResult.bestYield !== 'number' || typeof yieldResult.effectiveYield !== 'number') {
        this.log("Yield Calculation", false, "Invalid yield result structure", { result: yieldResult });
      } else if (yieldResult.bestYield <= 0 || yieldResult.effectiveYield <= 0) {
        this.log("Yield Calculation", false, "Yield values must be positive", { result: yieldResult });
      } else {
        this.log("Yield Calculation", true, `Yield calculated: ${yieldResult.bestYield} best, ${yieldResult.effectiveYield} effective`);
      }
    } catch (error) {
      this.log("Yield Calculation", false, `Error: ${error.message}`, { error: error.stack });
    }
  }

  testCostCalculation() {
    console.log("\n=== Testing Cost Calculation ===");
    
    const material = {
      sheet_width: 12,
      sheet_height: 24,
      sheet_cost: 7
    };
    
    const costParams = {
      material,
      effectiveYield: 20,
      shopRatePerHour: 75,
      machineMinutesPerSheet: 12,
      cleanupMinutesPerSheet: 5,
      applyMinutesPerHat: 2,
      proofMinutes: 5,
      setupMinutes: 5,
      packingMinutes: 5,
      hatsSuppliedBy: 'customer',
      hatUnitCost: 0,
      quoteType: 'patch_press'
    };
    
    try {
      const cost144 = calculateCostAtQty(144, costParams);
      const cost24 = calculateCostAtQty(24, costParams);
      
      if (!cost144 || !cost24) {
        this.log("Cost Calculation", false, "Cost calculation returned null/undefined");
        return;
      }
      
      // Costs should be different for different quantities
      if (cost144.costPerPiece === cost24.costPerPiece) {
        this.log("Cost Variation", false, "Cost per piece should vary by quantity", {
          cost144: cost144.costPerPiece,
          cost24: cost24.costPerPiece
        });
      } else {
        this.log("Cost Variation", true, "Cost per piece varies correctly by quantity");
      }
      
      // Check required fields
      const requiredFields = ['qty', 'sheets', 'materialCost', 'laborCost', 'totalCost', 'costPerPiece'];
      const missing144 = requiredFields.filter(field => !(field in cost144));
      
      if (missing144.length > 0) {
        this.log("Cost Fields", false, `Missing cost fields: ${missing144.join(', ')}`);
      } else {
        this.log("Cost Fields", true, "All required cost fields present");
      }
      
    } catch (error) {
      this.log("Cost Calculation", false, `Error: ${error.message}`, { error: error.stack });
    }
  }

  testCompleteQuoteCalculation() {
    console.log("\n=== Testing Complete Quote Calculation ===");
    
    const quoteInputs = {
      quote_type: "patch_press",
      qty: 144,
      patch_width_input: 3.25,
      patch_height_input: 2.25,
      waste_pct: 5,
      machine_minutes_per_sheet: 12,
      cleanup_minutes_per_sheet: 5,
      apply_minutes_per_hat: 2,
      proof_minutes: 5,
      setup_minutes: 5,
      packing_minutes: 5
    };
    
    const shopSettings = {
      workable_hours_per_week: 40,
      billable_efficiency_pct: 75,
      monthly_overhead: 3000,
      monthly_owner_pay_goal: 5000,
      monthly_profit_goal: 2000,
      default_pricing_method: 'markup',
      default_markup_pct: 50,
      default_margin_pct: 40,
      setup_fee_default: 30,
      setup_waive_qty: 24,
      customer_markup_pct: 0,
      customer_price_baseline: 'published',
      published_ladder_patch_press: {
        '1-23': 15.00,
        '24-47': 12.00,
        '48-95': 11.00,
        '96-143': 10.00,
        '144-287': 9.50,
        '288-575': 9.00,
        '576+': 8.50
      }
    };
    
    const material = {
      name: 'Standard Leatherette',
      sheet_width: 12,
      sheet_height: 24,
      sheet_cost: 7
    };
    
    try {
      console.log("Testing computeQuote function...");
      const result = computeQuote(quoteInputs, shopSettings, material);
      
      // Test for stack overflow (if we get here, no stack overflow occurred)
      this.log("No Stack Overflow", true, "Quote calculation completed without stack overflow");
      
      // Validate response structure
      this.validateQuoteResponse(result, 'patch_press');
      
      // Test patch_only quote type
      console.log("\nTesting patch_only quote type...");
      const patchOnlyInputs = { ...quoteInputs, quote_type: 'patch_only' };
      const patchOnlyResult = computeQuote(patchOnlyInputs, shopSettings, material);
      
      this.log("Patch Only - No Stack Overflow", true, "Patch only calculation completed without stack overflow");
      this.validateQuoteResponse(patchOnlyResult, 'patch_only');
      
    } catch (error) {
      if (error.message.includes('stack') || error.message.includes('recursion')) {
        this.log("Stack Overflow Test", false, `CRITICAL: Stack overflow detected: ${error.message}`);
      } else {
        this.log("Quote Calculation Error", false, `Error: ${error.message}`, { error: error.stack });
      }
    }
  }

  validateQuoteResponse(result, quoteType) {
    console.log(`\n--- Validating ${quoteType} Quote Response ---`);
    
    // Check active pricing fields
    const active = result.active;
    if (!active) {
      this.log(`${quoteType} - Active Object`, false, "Missing active object in response");
      return;
    }
    
    const requiredActiveFields = ['publishedPerPiece', 'costPerPiece', 'wholesalePerPiece', 'profitPerPiece', 'marginPct'];
    const missingActive = requiredActiveFields.filter(field => !(field in active));
    
    if (missingActive.length > 0) {
      this.log(`${quoteType} - Active Fields`, false, `Missing active fields: ${missingActive.join(', ')}`);
    } else {
      this.log(`${quoteType} - Active Fields`, true, "All required active fields present");
      
      // Validate profit calculation
      const published = active.publishedPerPiece;
      const cost = active.costPerPiece;
      const profit = active.profitPerPiece;
      const expectedProfit = roundToCents(published - cost);
      
      if (Math.abs(profit - expectedProfit) > 0.01) {
        this.log(`${quoteType} - Profit Calculation`, false, 
          `Profit calculation incorrect: expected ${expectedProfit}, got ${profit}`);
      } else {
        this.log(`${quoteType} - Profit Calculation`, true, 
          `Profit calculation correct: ${profit}`);
      }
    }
    
    // Check tiers array
    const tiers = result.tiers;
    if (!Array.isArray(tiers) || tiers.length !== 7) {
      this.log(`${quoteType} - Tiers Array`, false, 
        `Expected 7 tiers, got ${Array.isArray(tiers) ? tiers.length : 'not array'}`);
    } else {
      this.log(`${quoteType} - Tiers Array`, true, "Correct number of tiers (7)");
      
      // Check tier cost variation
      const tierCosts = tiers.map(t => t.costPerPiece);
      const uniqueCosts = new Set(tierCosts).size;
      
      if (uniqueCosts <= 1) {
        this.log(`${quoteType} - Tier Cost Variation`, false, 
          `All tier costs are the same: ${tierCosts[0]}`);
      } else {
        this.log(`${quoteType} - Tier Cost Variation`, true, 
          `Tier costs vary correctly (${uniqueCosts} unique values)`);
      }
      
      // Check each tier has required fields
      const tierFields = ['costPerPiece', 'publishedPerPiece', 'profitPerPiece', 'marginPct'];
      let allTiersValid = true;
      
      for (let i = 0; i < tiers.length; i++) {
        const missingFields = tierFields.filter(field => !(field in tiers[i]));
        if (missingFields.length > 0) {
          this.log(`${quoteType} - Tier ${i+1} Fields`, false, 
            `Missing fields: ${missingFields.join(', ')}`);
          allTiersValid = false;
          break;
        }
      }
      
      if (allTiersValid) {
        this.log(`${quoteType} - All Tier Fields`, true, "All tiers have required fields");
      }
    }
    
    // Check customerView.tiers
    const customerTiers = result.customerView?.tiers;
    if (!Array.isArray(customerTiers)) {
      this.log(`${quoteType} - Customer Tiers`, false, "Customer tiers missing or not array");
    } else {
      this.log(`${quoteType} - Customer Tiers`, true, 
        `Customer pricing matrix present (${customerTiers.length} tiers)`);
    }
    
    // Check scripts
    const scripts = result.scripts;
    const scriptTypes = ['sms', 'dm', 'phone'];
    const missingScripts = scriptTypes.filter(type => !scripts?.[type]);
    
    if (missingScripts.length > 0) {
      this.log(`${quoteType} - Quote Scripts`, false, 
        `Missing scripts: ${missingScripts.join(', ')}`);
    } else {
      this.log(`${quoteType} - Quote Scripts`, true, "All quote scripts present");
    }
    
    // Check display formatting
    const display = result.display;
    if (display) {
      const moneyFields = ['publishedPerPiece', 'costPerPiece', 'wholesalePerPiece', 'profitPerPiece', 'total'];
      const formatIssues = [];
      
      for (const field of moneyFields) {
        const value = display[field];
        if (typeof value === 'string' && value.startsWith('$')) {
          if (!value.match(/\$\d+\.\d{2}$/)) {
            formatIssues.push(`${field}: ${value}`);
          }
        }
      }
      
      if (formatIssues.length > 0) {
        this.log(`${quoteType} - Money Formatting`, false, 
          `Format issues: ${formatIssues.join(', ')}`);
      } else {
        this.log(`${quoteType} - Money Formatting`, true, 
          "All money values formatted correctly");
      }
    }
  }

  runAllTests() {
    console.log("🚀 Starting Direct Pricing Engine Tests");
    console.log("=" * 60);
    
    try {
      this.testFormatting();
      this.testTierSystem();
      this.testShopRateCalculation();
      this.testYieldCalculation();
      this.testCostCalculation();
      this.testCompleteQuoteCalculation();
      
    } catch (error) {
      console.log(`\n❌ CRITICAL ERROR during testing: ${error.message}`);
      console.log(error.stack);
      this.log("Test Suite Execution", false, `Critical error: ${error.message}`);
    }
    
    this.printSummary();
  }

  printSummary() {
    console.log("\n" + "=" * 60);
    console.log("📊 PRICING ENGINE TEST SUMMARY");
    console.log("=" * 60);
    
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.success).length;
    const failed = total - passed;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    
    if (failed > 0) {
      console.log(`\n🔍 FAILED TESTS:`);
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`  ❌ ${result.test}: ${result.message}`);
      });
    }
    
    // Check for critical issues
    const criticalIssues = this.testResults.filter(r => 
      !r.success && (r.message.includes('stack') || r.message.includes('recursion'))
    );
    
    if (criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES FOUND:`);
      criticalIssues.forEach(issue => {
        console.log(`  🚨 ${issue.test}: ${issue.message}`);
      });
    }
    
    console.log("\n" + "=" * 60);
    
    return { total, passed, failed, criticalIssues: criticalIssues.length };
  }
}

// Run the tests
const tester = new PricingEngineDirectTester();
const summary = tester.runAllTests();

// Exit with appropriate code
if (summary.criticalIssues > 0) {
  console.log("\n🚨 CRITICAL ISSUES DETECTED");
  process.exit(2);
} else if (summary.failed > 0) {
  console.log("\n⚠️  Some tests failed");
  process.exit(1);
} else {
  console.log("\n✅ All pricing engine tests passed!");
  process.exit(0);
}