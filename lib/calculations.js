/**
 * Patch Hat QuoteKit - Unified Pricing Engine
 * Single source of truth for all pricing calculations
 */

// =====================================================
// FORMATTING HELPERS
// =====================================================

export function roundToCents(value) {
  return Math.round(value * 100) / 100
}

export function formatMoney(value) {
  if (value === null || value === undefined || isNaN(value)) return '$0.00'
  return '$' + roundToCents(value).toFixed(2)
}

export function roundToNickel(value) {
  return Math.round(value * 20) / 20
}

// =====================================================
// TIER DEFINITIONS
// =====================================================

export const TIER_RANGES = [
  { key: '1-23', label: '1–23', minQty: 1, maxQty: 23, startQty: 1 },
  { key: '24-47', label: '24–47', minQty: 24, maxQty: 47, startQty: 24 },
  { key: '48-95', label: '48–95', minQty: 48, maxQty: 95, startQty: 48 },
  { key: '96-143', label: '96–143', minQty: 96, maxQty: 143, startQty: 96 },
  { key: '144-287', label: '144–287', minQty: 144, maxQty: 287, startQty: 144 },
  { key: '288-575', label: '288–575', minQty: 288, maxQty: 575, startQty: 288 },
  { key: '576+', label: '576+', minQty: 576, maxQty: Infinity, startQty: 576 }
]

export function getTierForQty(qty) {
  for (const tier of TIER_RANGES) {
    if (qty >= tier.minQty && qty <= tier.maxQty) {
      return tier
    }
  }
  return TIER_RANGES[TIER_RANGES.length - 1] // Default to highest tier
}

// =====================================================
// SHOP RATE CALCULATIONS
// =====================================================

export function calculateShopRates(shopSettings) {
  const {
    workable_hours_per_week = 40,
    billable_efficiency_pct = 75,
    monthly_overhead = 3000,
    monthly_owner_pay_goal = 5000,
    monthly_profit_goal = 2000
  } = shopSettings || {}

  const workableHoursMonth = workable_hours_per_week * 4.33
  const billableHoursMonth = workableHoursMonth * (billable_efficiency_pct / 100)
  
  if (billableHoursMonth === 0) {
    return { shopRate: 0, shopMinuteRate: 0 }
  }

  const requiredMonthly = monthly_overhead + monthly_owner_pay_goal + monthly_profit_goal
  const shopRate = requiredMonthly / billableHoursMonth
  const shopMinuteRate = shopRate / 60

  return {
    shopRate: roundToCents(shopRate),
    shopMinuteRate: roundToCents(shopMinuteRate),
    workableHoursMonth,
    billableHoursMonth,
    requiredMonthly
  }
}

// =====================================================
// YIELD CALCULATIONS
// =====================================================

export function calculatePatchOverallSize(patchWidthInput, patchHeightInput, patchSizeMode, outlineAllowance) {
  if (patchSizeMode === 'art') {
    return {
      patchWOverall: patchWidthInput + (outlineAllowance || 0.125),
      patchHOverall: patchHeightInput + (outlineAllowance || 0.125)
    }
  }
  return {
    patchWOverall: patchWidthInput,
    patchHOverall: patchHeightInput
  }
}

export function calculateAutoYield(material, patchWOverall, patchHOverall, gap, border) {
  const { sheet_width = 12, sheet_height = 24 } = material || {}
  
  const usableW = sheet_width - (2 * border)
  const usableH = sheet_height - (2 * border)

  // Normal orientation
  const countW = Math.floor((usableW + gap) / (patchWOverall + gap))
  const countH = Math.floor((usableH + gap) / (patchHOverall + gap))
  const yieldRaw = countW * countH

  // Rotated orientation
  const countWRot = Math.floor((usableW + gap) / (patchHOverall + gap))
  const countHRot = Math.floor((usableH + gap) / (patchWOverall + gap))
  const yieldRot = countWRot * countHRot

  const bestYield = Math.max(yieldRaw, yieldRot, 1)
  
  return { yieldRaw, yieldRot, bestYield }
}

export function calculateEffectiveYield(bestYield, wastePct) {
  const effectiveYield = bestYield * (1 - (wastePct || 0) / 100)
  return effectiveYield > 0 ? effectiveYield : 1
}

// =====================================================
// CORE COST CALCULATION - TRUE COST PER PIECE
// =====================================================

export function calculateTrueCostBreakdown(params) {
  const {
    qty,
    material,
    effectiveYield,
    shopMinuteRate,
    machineMinutesPerSheet,
    cleanupMinutesPerSheet,
    proofMinutes,
    setupMinutes,
    packingMinutes,
    applyMinutesPerHat,
    hatsSuppliedBy,
    hatUnitCost,
    quoteType
  } = params

  // Sheets needed (ceiling)
  const sheetsNeeded = Math.ceil(qty / effectiveYield)
  
  // Material cost
  const sheetCost = material?.sheet_cost || 7
  const materialCostTotal = sheetsNeeded * sheetCost
  const materialCostPerPiece = materialCostTotal / qty

  // Sheet labor (machine + cleanup)
  const sheetMinutesTotal = sheetsNeeded * (machineMinutesPerSheet + cleanupMinutesPerSheet)
  const sheetLaborCost = sheetMinutesTotal * shopMinuteRate
  const sheetLaborPerPiece = sheetLaborCost / qty

  // Fixed order labor (proof + setup + packing) - amortized
  const fixedMinutes = proofMinutes + setupMinutes + packingMinutes
  const fixedLaborCost = fixedMinutes * shopMinuteRate
  const fixedLaborPerPiece = fixedLaborCost / qty

  // Application labor (only for patch_press)
  let applyLaborPerPiece = 0
  if (quoteType === 'patch_press') {
    applyLaborPerPiece = applyMinutesPerHat * shopMinuteRate
  }

  // Blank/hat cost (only if we supply)
  let blankCostPerPiece = 0
  if (quoteType === 'patch_press' && hatsSuppliedBy === 'us') {
    blankCostPerPiece = hatUnitCost || 0
  }

  // Total labor
  const totalLaborMinutes = sheetMinutesTotal + fixedMinutes + (quoteType === 'patch_press' ? applyMinutesPerHat * qty : 0)
  const totalLaborCost = sheetLaborCost + fixedLaborCost + (applyLaborPerPiece * qty)
  const totalLaborPerPiece = sheetLaborPerPiece + fixedLaborPerPiece + applyLaborPerPiece

  // TRUE COST per piece
  const trueCostPerPiece = materialCostPerPiece + totalLaborPerPiece + blankCostPerPiece

  return {
    qty,
    sheetsNeeded,
    effectiveYield,
    // Material breakdown
    materialCostTotal: roundToCents(materialCostTotal),
    materialCostPerPiece: roundToCents(materialCostPerPiece),
    // Labor breakdown
    sheetMinutesTotal: roundToCents(sheetMinutesTotal),
    sheetLaborCost: roundToCents(sheetLaborCost),
    sheetLaborPerPiece: roundToCents(sheetLaborPerPiece),
    fixedMinutes,
    fixedLaborCost: roundToCents(fixedLaborCost),
    fixedLaborPerPiece: roundToCents(fixedLaborPerPiece),
    applyLaborPerPiece: roundToCents(applyLaborPerPiece),
    totalLaborMinutes: roundToCents(totalLaborMinutes),
    totalLaborCost: roundToCents(totalLaborCost),
    totalLaborPerPiece: roundToCents(totalLaborPerPiece),
    // Blank cost
    blankCostPerPiece: roundToCents(blankCostPerPiece),
    // TRUE COST
    trueCostPerPiece: roundToCents(trueCostPerPiece)
  }
}

// =====================================================
// COST-BASED WHOLESALE PRICING
// =====================================================

export function calculateCostBasedWholesale(trueCostPerPiece, pricingMethod, markupPct, marginPct) {
  let wholesalePrice
  
  if (pricingMethod === 'margin') {
    // Margin: price = cost / (1 - margin%)
    const effectiveMargin = Math.min(marginPct || 40, 99) // Cap at 99%
    wholesalePrice = trueCostPerPiece / (1 - effectiveMargin / 100)
  } else {
    // Markup: price = cost * (1 + markup%)
    wholesalePrice = trueCostPerPiece * (1 + (markupPct || 50) / 100)
  }
  
  return roundToNickel(wholesalePrice)
}

// =====================================================
// PUBLISHED PRICE FROM LADDER
// =====================================================

export function getPublishedPrice(tierKey, publishedLadder) {
  if (!publishedLadder || typeof publishedLadder !== 'object') {
    // Default ladder if none set
    const defaults = {
      '1-23': 15.00,
      '24-47': 12.00,
      '48-95': 11.00,
      '96-143': 10.00,
      '144-287': 9.50,
      '288-575': 9.00,
      '576+': 8.50
    }
    return defaults[tierKey] || 10.00
  }
  return publishedLadder[tierKey] || 10.00
}

// =====================================================
// UNIFIED PRICING RESULT FOR A QUANTITY
// =====================================================

export function calculateUnifiedPricing(params) {
  const {
    qty,
    material,
    shopSettings,
    quoteType,
    patchWidthInput,
    patchHeightInput,
    patchSizeMode,
    outlineAllowance,
    gap,
    border,
    wastePct,
    yieldMethod,
    manualYield,
    machineMinutesPerSheet,
    cleanupMinutesPerSheet,
    proofMinutes,
    setupMinutes,
    packingMinutes,
    applyMinutesPerHat,
    hatsSuppliedBy,
    hatUnitCost
  } = params

  // Get shop rates
  const { shopMinuteRate } = calculateShopRates(shopSettings)

  // Calculate patch size
  const { patchWOverall, patchHOverall } = calculatePatchOverallSize(
    patchWidthInput,
    patchHeightInput,
    patchSizeMode,
    outlineAllowance
  )

  // Calculate yield
  let bestYield
  if (yieldMethod === 'manual' && manualYield) {
    bestYield = manualYield
  } else {
    const yieldCalc = calculateAutoYield(material, patchWOverall, patchHOverall, gap, border)
    bestYield = yieldCalc.bestYield
  }
  const effectiveYield = calculateEffectiveYield(bestYield, wastePct)

  // Get current tier
  const activeTier = getTierForQty(qty)

  // Get pricing settings
  const pricingMethod = shopSettings?.default_pricing_method || 'markup'
  const markupPct = shopSettings?.default_markup_pct || 50
  const marginPct = shopSettings?.default_margin_pct || 40
  const setupFee = shopSettings?.setup_fee_default || 30
  const setupWaiveQty = shopSettings?.setup_waive_qty || 24

  // Get published ladder for this quote type
  const publishedLadder = quoteType === 'patch_only'
    ? shopSettings?.published_ladder_patch_only
    : shopSettings?.published_ladder_patch_press

  // Calculate cost breakdown for ACTIVE quantity
  const activeCostBreakdown = calculateTrueCostBreakdown({
    qty,
    material,
    effectiveYield,
    shopMinuteRate,
    machineMinutesPerSheet,
    cleanupMinutesPerSheet,
    proofMinutes,
    setupMinutes,
    packingMinutes,
    applyMinutesPerHat,
    hatsSuppliedBy,
    hatUnitCost,
    quoteType
  })

  // Cost-based wholesale for active qty
  const costBasedWholesalePerPiece = calculateCostBasedWholesale(
    activeCostBreakdown.trueCostPerPiece,
    pricingMethod,
    markupPct,
    marginPct
  )

  // Published price for active tier
  const publishedPricePerPiece = getPublishedPrice(activeTier.key, publishedLadder)

  // Profit and margin based on published price
  const profitPerPiece = roundToCents(publishedPricePerPiece - activeCostBreakdown.trueCostPerPiece)
  const marginPctActual = publishedPricePerPiece > 0 
    ? roundToCents((profitPerPiece / publishedPricePerPiece) * 100)
    : 0

  // Setup fee
  const setupFeeApplied = qty >= setupWaiveQty ? 0 : setupFee

  // Totals based on published price
  const subtotal = roundToCents(publishedPricePerPiece * qty)
  const totalPrice = roundToCents(subtotal + setupFeeApplied)

  // Calculate tier matrix (cost at each tier START qty)
  const tierMatrix = TIER_RANGES.map(tier => {
    const tierCostBreakdown = calculateTrueCostBreakdown({
      qty: tier.startQty,
      material,
      effectiveYield,
      shopMinuteRate,
      machineMinutesPerSheet,
      cleanupMinutesPerSheet,
      proofMinutes,
      setupMinutes,
      packingMinutes,
      applyMinutesPerHat,
      hatsSuppliedBy,
      hatUnitCost,
      quoteType
    })

    const tierWholesale = calculateCostBasedWholesale(
      tierCostBreakdown.trueCostPerPiece,
      pricingMethod,
      markupPct,
      marginPct
    )

    const tierPublished = getPublishedPrice(tier.key, publishedLadder)
    const tierProfit = roundToCents(tierPublished - tierCostBreakdown.trueCostPerPiece)
    const tierMargin = tierPublished > 0 
      ? roundToCents((tierProfit / tierPublished) * 100)
      : 0

    // Warning flags
    const belowCost = tierPublished < tierCostBreakdown.trueCostPerPiece
    const lowMargin = tierMargin < 20 // Warning if margin below 20%

    return {
      ...tier,
      isActive: tier.key === activeTier.key,
      trueCostPerPiece: tierCostBreakdown.trueCostPerPiece,
      wholesalePerPiece: tierWholesale,
      publishedPerPiece: tierPublished,
      profitPerPiece: tierProfit,
      marginPct: tierMargin,
      belowCost,
      lowMargin,
      warning: belowCost || lowMargin
    }
  })

  return {
    // Active quantity results
    qty,
    activeTier,
    bestYield,
    effectiveYield: roundToCents(effectiveYield),
    
    // Three key prices (all per piece)
    trueCostPerPiece: activeCostBreakdown.trueCostPerPiece,
    costBasedWholesalePerPiece,
    publishedPricePerPiece,
    
    // Profit analysis
    profitPerPiece,
    marginPctActual,
    
    // Cost breakdown
    costBreakdown: activeCostBreakdown,
    
    // Pricing settings used
    pricingMethod,
    markupPct,
    marginPct,
    
    // Totals
    setupFee: setupFeeApplied,
    subtotal,
    totalPrice,
    
    // Tier matrix for display
    tierMatrix,
    
    // Shop rate info
    shopMinuteRate
  }
}

// =====================================================
// QUOTE SCRIPTS GENERATOR
// =====================================================

export function generateQuoteScripts(params) {
  const {
    qty,
    quoteType,
    hatsSuppliedBy,
    materialName,
    patchWidth,
    patchHeight,
    publishedPrice,
    totalPrice,
    tierMatrix,
    turnaroundText
  } = params

  const unitLabel = quoteType === 'patch_only' ? 'patch' : 'hat'
  const unitLabelPlural = quoteType === 'patch_only' ? 'patches' : 'hats'

  // Get tier prices for scripts (published prices only)
  const tierParts = tierMatrix.slice(1, 5).map(t => `${t.label} ${formatMoney(t.publishedPerPiece)}`).join(' | ')

  const quoteSMS = `Quote: ${qty} ${unitLabelPlural}${quoteType === 'patch_press' ? ` (${hatsSuppliedBy} hats)` : ''} w/ ${materialName} patch ${patchWidth}×${patchHeight}. ${formatMoney(publishedPrice)}/${unitLabel} = ${formatMoney(totalPrice)}. Tiers: ${tierParts}. Turnaround ${turnaroundText}. Reply APPROVED and I'll send proof + invoice.`

  const quoteDM = `Quote for ${qty} ${unitLabelPlural} — ${materialName} patch ${patchWidth}×${patchHeight}${quoteType === 'patch_press' ? ' applied front' : ''}.
Price: ${formatMoney(publishedPrice)}/${unitLabel} = ${formatMoney(totalPrice)}.
Tiers: ${tierParts} (higher qty available).
Includes: patch production${quoteType === 'patch_press' ? ' + application' : ''} + QC + pack-out.
Turnaround: ${turnaroundText} after proof approval.
Next step: Reply APPROVED${quoteType === 'patch_press' ? ' + confirm hat colors' : ''} + ship-to address and I'll invoice.`

  const quotePhone = `For ${qty} ${unitLabelPlural} with a ${patchWidth}×${patchHeight} ${materialName} patch${quoteType === 'patch_press' ? ' applied' : ''}, you're around ${formatMoney(publishedPrice)} each (${formatMoney(totalPrice)} total). That includes making the patches${quoteType === 'patch_press' ? ', applying them,' : ''} and QC. Turnaround is ${turnaroundText}. If you're good with it, I'll send the proof and invoice and get you on the schedule.`

  return { quoteSMS, quoteDM, quotePhone }
}

// =====================================================
// MAIN EXPORT FOR API
// =====================================================

export function calculateCompleteQuote(quoteData, shopSettings, material) {
  const result = calculateUnifiedPricing({
    qty: quoteData.qty || 144,
    material,
    shopSettings,
    quoteType: quoteData.quote_type || 'patch_press',
    patchWidthInput: quoteData.patch_width_input || 3.25,
    patchHeightInput: quoteData.patch_height_input || 2.25,
    patchSizeMode: quoteData.patch_size_mode || 'overall',
    outlineAllowance: quoteData.outline_allowance || 0.125,
    gap: quoteData.gap || 0.0625,
    border: quoteData.border || 0.25,
    wastePct: quoteData.waste_pct || 5,
    yieldMethod: quoteData.yield_method || 'auto',
    manualYield: quoteData.manual_yield,
    machineMinutesPerSheet: quoteData.machine_minutes_per_sheet || 12,
    cleanupMinutesPerSheet: quoteData.cleanup_minutes_per_sheet || 5,
    proofMinutes: quoteData.proof_minutes || 5,
    setupMinutes: quoteData.setup_minutes || 5,
    packingMinutes: quoteData.packing_minutes || 5,
    applyMinutesPerHat: quoteData.apply_minutes_per_hat || 2,
    hatsSuppliedBy: quoteData.hats_supplied_by || 'customer',
    hatUnitCost: quoteData.hat_unit_cost || 0
  })

  // Generate scripts
  const scripts = generateQuoteScripts({
    qty: result.qty,
    quoteType: quoteData.quote_type || 'patch_press',
    hatsSuppliedBy: quoteData.hats_supplied_by || 'customer',
    materialName: material?.name || 'Leatherette',
    patchWidth: quoteData.patch_width_input || 3.25,
    patchHeight: quoteData.patch_height_input || 2.25,
    publishedPrice: result.publishedPricePerPiece,
    totalPrice: result.totalPrice,
    tierMatrix: result.tierMatrix,
    turnaroundText: quoteData.turnaround_text || '5-7 business days'
  })

  return {
    ...result,
    quote_sms: scripts.quoteSMS,
    quote_dm: scripts.quoteDM,
    quote_phone: scripts.quotePhone,
    // Legacy field names for compatibility
    unit_price: result.publishedPricePerPiece,
    true_cost_per_hat: result.trueCostPerPiece,
    best_yield: result.bestYield,
    effective_yield: result.effectiveYield,
    total_price: result.totalPrice,
    setup_fee: result.setupFee,
    tier_prices_json: result.tierMatrix.reduce((acc, t) => {
      acc[t.key] = { unit: t.publishedPerPiece, cost: t.trueCostPerPiece, wholesale: t.wholesalePerPiece }
      return acc
    }, {})
  }
}

// =====================================================
// PROFIT FIRST ALLOCATIONS (unchanged)
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
