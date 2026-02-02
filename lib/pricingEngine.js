/**
 * Patch Hat QuoteKit - Unified Pricing Engine
 * Single source of truth for ALL pricing calculations
 * 
 * @fileoverview This module exports computeQuote() which returns:
 * - active: pricing for the entered quantity
 * - tiers: pricing at each tier START quantity
 * - customerView: customer-facing pricing matrix with pass-through profit
 * - display: pre-formatted strings for UI and scripts
 */

// =====================================================
// FORMATTING HELPERS (used everywhere)
// =====================================================

/**
 * Round to cents with epsilon correction for floating point
 */
export function roundToCents(n) {
  if (n === null || n === undefined || isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Format number as USD currency string
 */
export function formatMoney(n) {
  const rounded = roundToCents(n)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded)
}

/**
 * Format percentage with 1 decimal
 */
export function formatPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.0%'
  return `${roundToCents(n).toFixed(1)}%`
}

// =====================================================
// TIER DEFINITIONS (single source of truth)
// =====================================================

export const TIER_RANGES = [
  { key: '1-23', rangeLabel: '1–23', startQty: 1, endQty: 23 },
  { key: '24-47', rangeLabel: '24–47', startQty: 24, endQty: 47 },
  { key: '48-95', rangeLabel: '48–95', startQty: 48, endQty: 95 },
  { key: '96-143', rangeLabel: '96–143', startQty: 96, endQty: 143 },
  { key: '144-287', rangeLabel: '144–287', startQty: 144, endQty: 287 },
  { key: '288-575', rangeLabel: '288–575', startQty: 288, endQty: 575 },
  { key: '576+', rangeLabel: '576+', startQty: 576, endQty: null }
]

export const TIER_KEYS = TIER_RANGES.map(t => t.key)

/**
 * Find which tier a quantity falls into
 */
export function getTierForQty(qty) {
  for (const tier of TIER_RANGES) {
    if (tier.endQty === null) {
      if (qty >= tier.startQty) return tier
    } else {
      if (qty >= tier.startQty && qty <= tier.endQty) return tier
    }
  }
  return TIER_RANGES[TIER_RANGES.length - 1]
}

// =====================================================
// SHOP RATE CALCULATION
// =====================================================

export function calculateShopRate(shopSettings) {
  const workableHoursPerWeek = shopSettings?.workable_hours_per_week || 40
  const billableEfficiencyPct = shopSettings?.billable_efficiency_pct || 75
  const monthlyOverhead = shopSettings?.monthly_overhead || 3000
  const monthlyOwnerPayGoal = shopSettings?.monthly_owner_pay_goal || 5000
  const monthlyProfitGoal = shopSettings?.monthly_profit_goal || 2000

  const workableHoursMonth = workableHoursPerWeek * 4.33
  const billableHoursMonth = workableHoursMonth * (billableEfficiencyPct / 100)
  
  if (billableHoursMonth === 0) return 0

  const requiredMonthly = monthlyOverhead + monthlyOwnerPayGoal + monthlyProfitGoal
  return roundToCents(requiredMonthly / billableHoursMonth)
}

// =====================================================
// YIELD CALCULATION
// =====================================================

export function calculateYield(params) {
  const {
    material,
    patchWidthInput,
    patchHeightInput,
    patchSizeMode,
    outlineAllowance,
    gap,
    border,
    wastePct,
    yieldMethod,
    manualYield
  } = params

  // Calculate patch overall size
  let patchW = patchWidthInput || 3.25
  let patchH = patchHeightInput || 2.25
  
  if (patchSizeMode === 'art') {
    patchW += (outlineAllowance || 0.125)
    patchH += (outlineAllowance || 0.125)
  }

  // Manual yield override
  if (yieldMethod === 'manual' && manualYield && manualYield > 0) {
    const effectiveYield = manualYield * (1 - (wastePct || 0) / 100)
    return { bestYield: manualYield, effectiveYield: effectiveYield > 0 ? effectiveYield : 1 }
  }

  // Auto-calculate yield
  const sheetWidth = material?.sheet_width || 12
  const sheetHeight = material?.sheet_height || 24
  const gapVal = gap || 0.0625
  const borderVal = border || 0.25

  const usableW = sheetWidth - (2 * borderVal)
  const usableH = sheetHeight - (2 * borderVal)

  // Normal orientation
  const countW = Math.floor((usableW + gapVal) / (patchW + gapVal))
  const countH = Math.floor((usableH + gapVal) / (patchH + gapVal))
  const yieldNormal = countW * countH

  // Rotated orientation
  const countWRot = Math.floor((usableW + gapVal) / (patchH + gapVal))
  const countHRot = Math.floor((usableH + gapVal) / (patchW + gapVal))
  const yieldRotated = countWRot * countHRot

  const bestYield = Math.max(yieldNormal, yieldRotated, 1)
  
  // Apply waste percentage (no rounding per spec)
  const effectiveYield = bestYield * (1 - (wastePct || 0) / 100)
  
  return { 
    bestYield, 
    effectiveYield: effectiveYield > 0 ? effectiveYield : 1 
  }
}

// =====================================================
// CORE COST CALCULATION (quantity-dependent)
// =====================================================

/**
 * Calculate true cost for a specific quantity
 * This is the core cost function - used for active qty AND each tier start qty
 */
export function calculateCostAtQty(qty, params) {
  const {
    material,
    effectiveYield,
    shopRatePerHour,
    machineMinutesPerSheet,
    cleanupMinutesPerSheet,
    applyMinutesPerHat,
    proofMinutes,
    setupMinutes,
    packingMinutes,
    hatsSuppliedBy,
    hatUnitCost,
    quoteType
  } = params

  // Sheets needed (ceiling)
  const sheets = Math.ceil(qty / effectiveYield)
  
  // Material cost
  const sheetCost = material?.sheet_cost || 7
  const materialCost = roundToCents(sheets * sheetCost)

  // Blank cost (only if we supply hats for patch_press)
  let blankCost = 0
  if (quoteType === 'patch_press' && hatsSuppliedBy === 'us') {
    blankCost = roundToCents(qty * (hatUnitCost || 0))
  }

  // Time calculation
  const sheetMinutes = (machineMinutesPerSheet + cleanupMinutesPerSheet) * sheets
  const applyMinutes = quoteType === 'patch_press' ? (applyMinutesPerHat * qty) : 0
  const fixedMinutes = proofMinutes + setupMinutes + packingMinutes
  const timeMins = sheetMinutes + applyMinutes + fixedMinutes

  // Labor cost
  const laborCost = roundToCents((timeMins / 60) * shopRatePerHour)

  // Total cost
  const totalCost = roundToCents(materialCost + blankCost + laborCost)
  
  // Cost per piece
  const costPerPiece = roundToCents(totalCost / qty)

  return {
    qty,
    effectiveYield: roundToCents(effectiveYield),
    sheets,
    materialCost,
    blankCost,
    timeMins: roundToCents(timeMins),
    laborCost,
    totalCost,
    costPerPiece
  }
}

// =====================================================
// WHOLESALE CALCULATION (cost-based)
// =====================================================

/**
 * Calculate wholesale price from cost using markup or margin
 */
export function calculateWholesale(costPerPiece, pricingMethod, markupPct, marginPct) {
  let wholesalePerPiece
  
  if (pricingMethod === 'margin') {
    // Margin: wholesale = cost / (1 - marginPct)
    const margin = Math.min((marginPct || 40) / 100, 0.99)
    wholesalePerPiece = costPerPiece / (1 - margin)
  } else {
    // Markup: wholesale = cost * (1 + markupPct)
    const markup = (markupPct || 50) / 100
    wholesalePerPiece = costPerPiece * (1 + markup)
  }
  
  return roundToCents(wholesalePerPiece)
}

// =====================================================
// PUBLISHED PRICE FROM LADDER
// =====================================================

/**
 * Get published price from shop settings ladder
 */
export function getPublishedPrice(tierKey, publishedLadder, quoteType) {
  // Default ladders
  const defaultPatchPress = {
    '1-23': 15.00, '24-47': 12.00, '48-95': 11.00,
    '96-143': 10.00, '144-287': 9.50, '288-575': 9.00, '576+': 8.50
  }
  const defaultPatchOnly = {
    '1-23': 10.00, '24-47': 8.00, '48-95': 7.00,
    '96-143': 6.50, '144-287': 6.00, '288-575': 5.50, '576+': 5.00
  }
  
  const defaults = quoteType === 'patch_only' ? defaultPatchOnly : defaultPatchPress
  
  if (!publishedLadder || typeof publishedLadder !== 'object') {
    return defaults[tierKey] || 10.00
  }
  
  return publishedLadder[tierKey] ?? defaults[tierKey] ?? 10.00
}

// =====================================================
// CUSTOMER PRICING (pass-through markup)
// =====================================================

/**
 * Calculate customer price with pass-through markup
 * Baseline can be "published" or "wholesale"
 */
export function calculateCustomerPrice(baselinePerPiece, customerMarkupPct) {
  const markup = (customerMarkupPct || 0) / 100
  const customerPricePerPiece = roundToCents(baselinePerPiece * (1 + markup))
  const customerProfitPerPiece = roundToCents(customerPricePerPiece - baselinePerPiece)
  return { customerPricePerPiece, customerProfitPerPiece }
}

// =====================================================
// MAIN EXPORT: computeQuote()
// =====================================================

/**
 * Compute complete quote with all pricing views
 * @param {Object} quoteInputs - Form inputs from Quote Builder
 * @param {Object} shopSettings - Shop settings including ladders
 * @param {Object} material - Selected material
 * @returns {Object} Complete pricing result
 */
export function computeQuote(quoteInputs, shopSettings, material) {
  const quoteType = quoteInputs.quote_type || 'patch_press'
  const qty = quoteInputs.qty || 144

  // Get shop rate
  const shopRatePerHour = calculateShopRate(shopSettings)

  // Calculate yield
  const { bestYield, effectiveYield } = calculateYield({
    material,
    patchWidthInput: quoteInputs.patch_width_input,
    patchHeightInput: quoteInputs.patch_height_input,
    patchSizeMode: quoteInputs.patch_size_mode,
    outlineAllowance: quoteInputs.outline_allowance,
    gap: quoteInputs.gap,
    border: quoteInputs.border,
    wastePct: quoteInputs.waste_pct,
    yieldMethod: quoteInputs.yield_method,
    manualYield: quoteInputs.manual_yield
  })

  // Common cost params
  const costParams = {
    material,
    effectiveYield,
    shopRatePerHour,
    machineMinutesPerSheet: quoteInputs.machine_minutes_per_sheet || 12,
    cleanupMinutesPerSheet: quoteInputs.cleanup_minutes_per_sheet || 5,
    applyMinutesPerHat: quoteInputs.apply_minutes_per_hat || 2,
    proofMinutes: quoteInputs.proof_minutes || 5,
    setupMinutes: quoteInputs.setup_minutes || 5,
    packingMinutes: quoteInputs.packing_minutes || 5,
    hatsSuppliedBy: quoteInputs.hats_supplied_by || 'customer',
    hatUnitCost: quoteInputs.hat_unit_cost || 0,
    quoteType
  }

  // Pricing settings
  const pricingMethod = shopSettings?.default_pricing_method || 'markup'
  const markupPct = shopSettings?.default_markup_pct || 50
  const marginPct = shopSettings?.default_margin_pct || 40
  const setupFeeDefault = shopSettings?.setup_fee_default || 30
  const setupWaiveQty = shopSettings?.setup_waive_qty || 24
  const customerMarkupPct = shopSettings?.customer_markup_pct || 0
  const customerPriceBaseline = shopSettings?.customer_price_baseline || 'published'

  // Get published ladder
  const publishedLadder = quoteType === 'patch_only'
    ? shopSettings?.published_ladder_patch_only
    : shopSettings?.published_ladder_patch_press

  // ===== ACTIVE QUANTITY CALCULATION =====
  const activeBreakdown = calculateCostAtQty(qty, costParams)
  const activeTier = getTierForQty(qty)
  const activePublishedPerPiece = getPublishedPrice(activeTier.key, publishedLadder, quoteType)
  const activeWholesalePerPiece = calculateWholesale(activeBreakdown.costPerPiece, pricingMethod, markupPct, marginPct)
  const activeProfitPerPiece = roundToCents(activePublishedPerPiece - activeBreakdown.costPerPiece)
  const activeMarginPct = activePublishedPerPiece > 0 
    ? roundToCents((activeProfitPerPiece / activePublishedPerPiece) * 100) 
    : 0
  const activeSetupFee = qty >= setupWaiveQty ? 0 : setupFeeDefault
  const activeSubtotal = roundToCents(activePublishedPerPiece * qty)
  const activeTotal = roundToCents(activeSubtotal + activeSetupFee)

  // ===== TIER MATRIX (recompute at each tier START qty) =====
  const tiers = TIER_RANGES.map(tier => {
    const tierBreakdown = calculateCostAtQty(tier.startQty, costParams)
    const publishedPerPiece = getPublishedPrice(tier.key, publishedLadder, quoteType)
    const wholesalePerPiece = calculateWholesale(tierBreakdown.costPerPiece, pricingMethod, markupPct, marginPct)
    const profitPerPiece = roundToCents(publishedPerPiece - tierBreakdown.costPerPiece)
    const marginPctVal = publishedPerPiece > 0 
      ? roundToCents((profitPerPiece / publishedPerPiece) * 100) 
      : 0
    const setupFeeApplied = tier.startQty >= setupWaiveQty ? 0 : setupFeeDefault
    const totalAtStartQty = roundToCents((publishedPerPiece * tier.startQty) + setupFeeApplied)

    // Warning flags
    const belowCost = publishedPerPiece < tierBreakdown.costPerPiece
    const lowMargin = marginPctVal < 20

    return {
      key: tier.key,
      rangeLabel: tier.rangeLabel,
      startQty: tier.startQty,
      endQty: tier.endQty,
      isActive: tier.key === activeTier.key,
      // Per-piece economics (tier cards show ONLY these)
      publishedPerPiece,
      costPerPiece: tierBreakdown.costPerPiece,
      wholesalePerPiece,
      profitPerPiece,
      marginPct: marginPctVal,
      // Setup fee and total at start qty (for reference)
      setupFeeApplied,
      totalAtStartQty,
      // Warnings
      belowCost,
      lowMargin,
      hasWarning: belowCost || lowMargin,
      // Full breakdown for debugging
      breakdown: tierBreakdown
    }
  })

  // ===== CUSTOMER VIEW MATRIX =====
  const customerTiers = tiers.map(tier => {
    const baseline = customerPriceBaseline === 'wholesale' 
      ? tier.wholesalePerPiece 
      : tier.publishedPerPiece
    const { customerPricePerPiece, customerProfitPerPiece } = calculateCustomerPrice(baseline, customerMarkupPct)
    const customerProfitTotalAtStartQty = roundToCents(customerProfitPerPiece * tier.startQty)

    return {
      key: tier.key,
      rangeLabel: tier.rangeLabel,
      startQty: tier.startQty,
      endQty: tier.endQty,
      isActive: tier.isActive,
      customerPricePerPiece,
      customerProfitPerPiece,
      customerProfitTotalAtStartQty
    }
  })

  // ===== FORMATTED DISPLAY STRINGS =====
  const display = {
    // Active qty
    publishedPerPiece: formatMoney(activePublishedPerPiece),
    costPerPiece: formatMoney(activeBreakdown.costPerPiece),
    wholesalePerPiece: formatMoney(activeWholesalePerPiece),
    profitPerPiece: formatMoney(activeProfitPerPiece),
    marginPct: formatPct(activeMarginPct),
    setupFee: activeSetupFee > 0 ? formatMoney(activeSetupFee) : 'Waived',
    subtotal: formatMoney(activeSubtotal),
    total: formatMoney(activeTotal),
    // Yield info
    bestYield: `${bestYield} patches/sheet`,
    effectiveYield: `${roundToCents(effectiveYield)}`,
    sheets: `${activeBreakdown.sheets}`,
    // Tier labels for scripts
    tierPrices: tiers.slice(1, 5).map(t => `${t.rangeLabel} ${formatMoney(t.publishedPerPiece)}`).join(' | ')
  }

  // ===== QUOTE SCRIPTS =====
  const unitLabel = quoteType === 'patch_only' ? 'patch' : 'hat'
  const unitLabelPlural = quoteType === 'patch_only' ? 'patches' : 'hats'
  const materialName = material?.name || 'Leatherette'
  const patchSize = `${quoteInputs.patch_width_input || 3.25}×${quoteInputs.patch_height_input || 2.25}`
  const turnaround = quoteInputs.turnaround_text || '5–7 business days'
  const hatsSupplied = quoteInputs.hats_supplied_by || 'customer'

  const quoteSMS = `Quote: ${qty} ${unitLabelPlural}${quoteType === 'patch_press' ? ` (${hatsSupplied} hats)` : ''} w/ ${materialName} patch ${patchSize}. ${display.publishedPerPiece}/${unitLabel} = ${display.total}. Tiers: ${display.tierPrices}. Turnaround ${turnaround}. Reply APPROVED and I'll send proof + invoice.`

  const quoteDM = `Quote for ${qty} ${unitLabelPlural} — ${materialName} patch ${patchSize}${quoteType === 'patch_press' ? ' applied front' : ''}.
Price: ${display.publishedPerPiece}/${unitLabel} = ${display.total}.
Tiers: ${display.tierPrices} (higher qty available).
Includes: patch production${quoteType === 'patch_press' ? ' + application' : ''} + QC + pack-out.
Turnaround: ${turnaround} after proof approval.
Next step: Reply APPROVED${quoteType === 'patch_press' ? ' + confirm hat colors' : ''} + ship-to address and I'll invoice.`

  const quotePhone = `For ${qty} ${unitLabelPlural} with a ${patchSize} ${materialName} patch${quoteType === 'patch_press' ? ' applied' : ''}, you're around ${display.publishedPerPiece} each (${display.total} total). That includes making the patches${quoteType === 'patch_press' ? ', applying them,' : ''} and QC. Turnaround is ${turnaround}. If you're good with it, I'll send the proof and invoice and get you on the schedule.`

  // ===== RETURN COMPLETE RESULT =====
  return {
    // Active quantity results
    active: {
      qty,
      tier: activeTier,
      publishedPerPiece: activePublishedPerPiece,
      costPerPiece: activeBreakdown.costPerPiece,
      wholesalePerPiece: activeWholesalePerPiece,
      profitPerPiece: activeProfitPerPiece,
      marginPct: activeMarginPct,
      setupFeeApplied: activeSetupFee,
      subtotal: activeSubtotal,
      total: activeTotal,
      breakdown: activeBreakdown
    },
    // Tier matrix
    tiers,
    // Customer view
    customerView: {
      baseline: customerPriceBaseline,
      markupPct: customerMarkupPct,
      tiers: customerTiers
    },
    // Formatted display strings
    display,
    // Quote scripts
    scripts: {
      sms: quoteSMS,
      dm: quoteDM,
      phone: quotePhone
    },
    // Settings used
    settings: {
      pricingMethod,
      markupPct,
      marginPct,
      setupFeeDefault,
      setupWaiveQty,
      shopRatePerHour,
      bestYield,
      effectiveYield
    }
  }
}

// =====================================================
// LEGACY EXPORT for API compatibility
// =====================================================

export function calculateCompleteQuote(quoteData, shopSettings, material) {
  const result = computeQuote(quoteData, shopSettings, material)
  
  // Map to legacy field names
  return {
    ...result,
    unit_price: result.active.publishedPerPiece,
    true_cost_per_hat: result.active.costPerPiece,
    best_yield: result.settings.bestYield,
    effective_yield: result.settings.effectiveYield,
    total_price: result.active.total,
    setup_fee: result.active.setupFeeApplied,
    subtotal: result.active.subtotal,
    tier_prices_json: result.tiers.reduce((acc, t) => {
      acc[t.key] = { unit: t.publishedPerPiece, cost: t.costPerPiece, wholesale: t.wholesalePerPiece }
      return acc
    }, {}),
    quote_sms: result.scripts.sms,
    quote_dm: result.scripts.dm,
    quote_phone: result.scripts.phone,
    tierMatrix: result.tiers,
    customerTiers: result.customerView.tiers
  }
}

// =====================================================
// PROFIT FIRST ALLOCATIONS
// =====================================================

export function calculateProfitFirstAllocations(totalPrice, profitFirstSettings) {
  return {
    profit: roundToCents((totalPrice * (profitFirstSettings?.profit_pct || 5)) / 100),
    tax: roundToCents((totalPrice * (profitFirstSettings?.tax_pct || 15)) / 100),
    ownerPay: roundToCents((totalPrice * (profitFirstSettings?.owner_pay_pct || 50)) / 100),
    ops: roundToCents((totalPrice * (profitFirstSettings?.ops_pct || 25)) / 100),
    buffer: roundToCents((totalPrice * (profitFirstSettings?.buffer_pct || 5)) / 100)
  }
}
