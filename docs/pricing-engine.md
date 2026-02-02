# Pricing Engine - Single Source of Truth

## Overview
This document defines the ONLY correct way to calculate pricing in Patch Hat QuoteKit. All calculations must follow this logic exactly.

## Core Principle
**Tier pricing MUST recalculate true cost at each tier's START quantity.**

Do NOT reuse the active quote's trueCostPerHat for all tiers. Each tier has different economics due to order labor spreading over more units.

## Tier Ranges (Fixed)
```
Tier 1:   1–23    (start qty: 1)
Tier 2:   24–47   (start qty: 24)
Tier 3:   48–95   (start qty: 48)
Tier 4:   96–143  (start qty: 96)
Tier 5:   144–287 (start qty: 144)
Tier 6:   288–575 (start qty: 288)
Tier 7:   576+    (start qty: 576)
```

## Calculation Steps (Per Tier)

### Step 1: Calculate True Cost at Tier Start Quantity

```javascript
function calculateTrueCostAtQty(qty, inputs) {
  // 1. Yield (no rounding yet)
  const effectiveYield = inputs.bestYield * (1 - inputs.wastePct / 100)
  
  // 2. Sheets needed
  const sheetsNeeded = Math.ceil(qty / effectiveYield)
  
  // 3. Material cost
  const materialCost = sheetsNeeded * inputs.sheetCost
  
  // 4. Labor time
  const machineTime = sheetsNeeded * inputs.machineMinutesPerSheet
  const cleanupTime = sheetsNeeded * inputs.cleanupMinutesPerSheet
  const applyTime = qty * inputs.applyMinutesPerHat
  const orderTime = inputs.proofMinutes + inputs.setupMinutes + inputs.packingMinutes
  const totalMinutes = machineTime + cleanupTime + applyTime + orderTime
  
  // 5. Labor cost
  const laborCost = (totalMinutes / 60) * inputs.shopRatePerHour
  
  // 6. Blank cost
  const blankCost = (inputs.hatsSuppliedBy === 'us') ? (qty * inputs.hatUnitCost) : 0
  
  // 7. Total cost
  const totalCost = materialCost + laborCost + blankCost
  
  // 8. Cost per piece (keep precision)
  const costPerPiece = totalCost / qty
  
  return costPerPiece // DO NOT ROUND YET
}
```

### Step 2: Apply Pricing Method

```javascript
function applyPricingMethod(costPerPiece, method, methodValue) {
  let wholesalePrice
  
  if (method === 'markup') {
    // Markup %: price = cost × (1 + markup)
    wholesalePrice = costPerPiece * (1 + methodValue)
  } else if (method === 'margin') {
    // Margin %: price = cost / (1 - margin)
    wholesalePrice = costPerPiece / (1 - methodValue)
  } else if (method === 'profit_dollar') {
    // Profit $: price = cost + profit
    wholesalePrice = costPerPiece + methodValue
  }
  
  return wholesalePrice // DO NOT ROUND YET
}
```

### Step 3: Generate Tier Matrix

```javascript
function generateTierMatrix(inputs, shopSettings) {
  const tierBreaks = [1, 24, 48, 96, 144, 288, 576]
  const tierPrices = []
  let previousPrice = Infinity
  const minStepDown = 0.05
  
  for (const startQty of tierBreaks) {
    // Recalculate cost at THIS tier's start quantity
    const costAtTier = calculateTrueCostAtQty(startQty, inputs)
    
    // Apply pricing method
    let priceAtTier = applyPricingMethod(costAtTier, inputs.pricingMethod, inputs.methodValue)
    
    // Enforce strictly decreasing
    if (priceAtTier >= previousPrice) {
      priceAtTier = previousPrice - minStepDown
      if (priceAtTier < costAtTier + 0.10) {
        priceAtTier = costAtTier + 0.10
      }
    }
    
    // NOW round for display only
    const priceRounded = Math.round(priceAtTier * 100) / 100
    
    tierPrices.push({
      range: getRangeLabel(startQty),
      startQty: startQty,
      unitPrice: priceRounded,
      costPerPiece: Math.round(costAtTier * 100) / 100
    })
    
    previousPrice = priceRounded
  }
  
  return tierPrices
}

function getRangeLabel(startQty) {
  const ranges = {
    1: '1-23',
    24: '24-47',
    48: '48-95',
    96: '96-143',
    144: '144-287',
    288: '288-575',
    576: '576+'
  }
  return ranges[startQty] || `${startQty}+`
}
```

### Step 4: Find Active Tier

```javascript
function findActiveTier(qty, tierPrices) {
  // Find the tier where qty falls in range
  for (let i = tierPrices.length - 1; i >= 0; i--) {
    if (qty >= tierPrices[i].startQty) {
      return tierPrices[i]
    }
  }
  return tierPrices[0] // Default to smallest tier
}
```

### Step 5: Calculate Quote Total

```javascript
function calculateQuoteTotal(qty, tierPrices, setupFee, setupWaiveQty) {
  const activeTier = findActiveTier(qty, tierPrices)
  const unitPrice = activeTier.unitPrice
  const subtotal = unitPrice * qty
  const setupFeeApplied = qty >= setupWaiveQty ? 0 : setupFee
  const total = Math.round((subtotal + setupFeeApplied) * 100) / 100
  
  return {
    unitPrice,
    subtotal: Math.round(subtotal * 100) / 100,
    setupFee: setupFeeApplied,
    total,
    activeTier
  }
}
```

## Pricing Method Options

### Margin Ladder (Default)
Uses margin % from ladder:
```javascript
margin_ladder = {
  "24": 0.40,   // 40% margin
  "48": 0.38,   // 38% margin
  "96": 0.35,   // 35% margin
  "144": 0.33,  // 33% margin
  "288": 0.31,  // 31% margin
  "384": 0.30,  // 30% margin
  "768": 0.28   // 28% margin
}

price = cost / (1 - margin)
```

### Profit $ Ladder
Uses fixed profit dollars from ladder:
```javascript
profit_ladder = {
  "24": 3.00,
  "48": 2.75,
  "96": 2.50,
  "144": 2.25,
  "288": 2.00,
  "384": 1.90,
  "768": 1.75
}

price = cost + profit
```

## Validation Rules

1. **Tier prices must be strictly decreasing**
   - Each tier must be ≥ $0.05 less than previous
   
2. **Keep precision until final display**
   - No intermediate rounding
   - Round to 2 decimals only for UI display

3. **Cost components**
   - Material: sheets × sheet_cost (from selected material)
   - Labor: (total_minutes / 60) × shop_rate_per_hour
   - Blanks: qty × hat_unit_cost (if supplied by us)

4. **Setup fee**
   - Applied when qty < setupWaiveQty
   - Default: $30, waived at 12+

## Common Errors to Avoid

❌ **Wrong**: Using the same trueCostPerHat for all tiers
```javascript
// BAD - cost doesn't change with volume
for (tier of tiers) {
  price[tier] = trueCostPerHat + profit[tier]
}
```

✅ **Correct**: Recalculate cost at each tier
```javascript
// GOOD - order labor spreads over more units
for (tier of tiers) {
  cost = calculateTrueCostAtQty(tier.startQty, inputs)
  price[tier] = cost + profit[tier]
}
```

## Testing Requirements

Unit tests must verify:
1. Cost recalculation at different quantities (24 vs 144 should have different costs)
2. Tier prices strictly decreasing
3. Active tier selection based on quantity
4. Setup fee waiver logic
5. Rounding only at display

## Integration Points

- **Quote Builder**: Uses this engine for live calculation
- **API Routes**: Server-side validation uses same logic
- **Dashboard**: Displays saved quote results
- **Shop Settings**: Configures ladders and defaults

---

**Version**: 1.0  
**Last Updated**: 2026-02-01  
**Status**: Active - Single source of truth for all pricing
