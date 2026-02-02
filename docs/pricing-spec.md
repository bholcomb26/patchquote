# Patch Hat QuoteKit - Pricing Specification

## Overview

This document defines the single source of truth for all pricing calculations in the Patch Hat QuoteKit application.

---

## Tier Ranges (Single Source of Truth)

| Key | Range Label | Start Qty | End Qty |
|-----|-------------|-----------|---------|
| `1-23` | 1–23 | 1 | 23 |
| `24-47` | 24–47 | 24 | 47 |
| `48-95` | 48–95 | 48 | 95 |
| `96-143` | 96–143 | 96 | 143 |
| `144-287` | 144–287 | 144 | 287 |
| `288-575` | 288–575 | 288 | 575 |
| `576+` | 576+ | 576 | ∞ |

---

## Cost Formula

For any quantity `qty`, true cost is calculated as:

```
effectiveYield = bestYield × (1 - wastePct/100)   // NO rounding
sheets = ceil(qty / effectiveYield)              // ALWAYS ceiling

materialCost = sheets × sheetCost
blankCost = (hatsSuppliedBy === "us") ? qty × hatUnitCost : 0

timeMins = (machineMinutesPerSheet + cleanupMinutesPerSheet) × sheets
         + applyMinutesPerHat × qty              // only for patch_press
         + proofMinutes + setupMinutes + packingMinutes  // fixed per order

laborCost = (timeMins / 60) × shopRatePerHour

totalCost = materialCost + blankCost + laborCost
costPerPiece = totalCost / qty
```

### Shop Rate Calculation

```
workableHoursMonth = workableHoursPerWeek × 4.33
billableHoursMonth = workableHoursMonth × (billableEfficiencyPct / 100)
requiredMonthly = monthlyOverhead + monthlyOwnerPayGoal + monthlyProfitGoal
shopRatePerHour = requiredMonthly / billableHoursMonth
```

---

## Wholesale Calculation (Cost-Based)

Two methods available, configured in Shop Settings:

### Markup %
```
wholesalePerPiece = costPerPiece × (1 + markupPct/100)
```

### Margin %
```
wholesalePerPiece = costPerPiece / (1 - marginPct/100)
```

---

## Published Price (Fixed Ladder)

Published prices are fixed tier values stored in Shop Settings. They are customer-facing and do NOT change based on cost.

Two separate ladders:
- `published_ladder_patch_press` - for Patch + Press quotes
- `published_ladder_patch_only` - for Patch Only quotes

Default values:
| Tier | Patch + Press | Patch Only |
|------|---------------|------------|
| 1-23 | $15.00 | $10.00 |
| 24-47 | $12.00 | $8.00 |
| 48-95 | $11.00 | $7.00 |
| 96-143 | $10.00 | $6.50 |
| 144-287 | $9.50 | $6.00 |
| 288-575 | $9.00 | $5.50 |
| 576+ | $8.50 | $5.00 |

---

## Tier Card Economics (Per-Piece ONLY)

Each tier card displays:
- **Published $/piece** (big, primary)
- **Cost $/piece** (shop view only)
- **Wholesale $/piece** (shop view only)
- **Profit $/piece** = Published - Cost (shop view only)
- **Margin %** = (Profit / Published) × 100 (shop view only)

⚠️ **CRITICAL**: Tier cards show PER-PIECE values only. No totals on cards.

---

## Tier Cost Computation Rule

For each tier in the matrix, cost MUST be computed at the **tier START quantity** (1, 24, 48, 96, 144, 288, 576).

❌ **WRONG**: Reusing active qty cost for all tiers
✅ **CORRECT**: Recompute `costPerPiece` at each tier's `startQty`

This ensures accurate cost-per-piece at volume breakpoints.

---

## Customer Pass-Through Pricing

For distributors/resellers, a markup can be applied on top of a baseline price:

### Configuration
- `customer_markup_pct` - Markup percentage (0-100)
- `customer_price_baseline` - Either "published" or "wholesale"

### Calculation
```
baselinePerPiece = (baseline === "wholesale") ? wholesalePerPiece : publishedPerPiece
customerPricePerPiece = baselinePerPiece × (1 + customerMarkupPct/100)
customerProfitPerPiece = customerPricePerPiece - baselinePerPiece
```

---

## Setup Fee

- `setup_fee_default` - Default setup fee (e.g., $30)
- `setup_waive_qty` - Quantity at which fee is waived (e.g., 24)

```
setupFeeApplied = (qty >= setupWaiveQty) ? 0 : setupFeeDefault
```

---

## Rounding Rules

All currency values use `roundToCents()`:
```javascript
function roundToCents(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
```

For display, use `formatMoney()`:
```javascript
function formatMoney(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(roundToCents(n))
}
```

---

## Views

### Shop View
Shows ALL pricing information:
- Published Price (primary)
- True Cost
- Wholesale
- Profit/piece
- Margin %
- Full tier matrix with cost breakdown

### Customer View
Shows ONLY customer-facing information:
- Published Price
- Customer pricing matrix (if customer markup configured)
- No cost, wholesale, or margin data

---

## File References

- **Pricing Engine**: `/lib/pricingEngine.js`
- **Shop Settings UI**: `/app/shop-settings.js`
- **Quote Builder UI**: `/app/quote-builder.js`
- **API Route**: `/app/api/[[...path]]/route.js`

---

## Migration

Run `/supabase-pricing-update.sql` to add new columns to `shop_settings` table.
