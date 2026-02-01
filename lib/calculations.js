/**
 * Patch Hat QuoteKit - Calculation Engine
 * All calculations must match spec exactly
 */

// =====================================================
// ROUNDING HELPERS
// =====================================================

export function roundToNickel(value) {
  // Round to nearest $0.05
  return Math.round(value * 20) / 20
}

export function roundToHalfDollar(value) {
  // Round to nearest $0.50
  return Math.round(value * 2) / 2
}

export function roundToDollar(value) {
  // Round to nearest $1
  return Math.round(value)
}

// =====================================================
// SHOP FLOOR CALCULATIONS
// =====================================================

export function calculateShopRates(shopSettings) {
  const {
    workable_hours_per_week,
    billable_efficiency_pct,
    monthly_overhead,
    monthly_owner_pay_goal,
    monthly_profit_goal
  } = shopSettings

  const workableHoursMonth = workable_hours_per_week * 4.33
  const billableHoursMonth = workableHoursMonth * (billable_efficiency_pct / 100)
  
  // Prevent divide by zero
  if (billableHoursMonth === 0) {
    return { shopRate: 0, shopMinuteRate: 0 }
  }

  const requiredMonthly = monthly_overhead + monthly_owner_pay_goal + monthly_profit_goal
  const shopRate = requiredMonthly / billableHoursMonth
  const shopMinuteRate = shopRate / 60

  return {
    shopRate,
    shopMinuteRate,
    workableHoursMonth,
    billableHoursMonth,
    requiredMonthly
  }
}

// =====================================================
// PATCH SIZE MODE CALCULATIONS
// =====================================================

export function calculatePatchOverallSize(patchWidthInput, patchHeightInput, patchSizeMode, outlineAllowance) {
  if (patchSizeMode === 'art') {
    return {
      patchWOverall: patchWidthInput + outlineAllowance,
      patchHOverall: patchHeightInput + outlineAllowance
    }
  }
  
  return {
    patchWOverall: patchWidthInput,
    patchHOverall: patchHeightInput
  }
}

// =====================================================
// YIELD AUTO-CALC (WITH ROTATION)
// =====================================================

export function calculateAutoYield(material, patchWOverall, patchHOverall, gap, border) {
  const { sheet_width, sheet_height } = material
  
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

  const bestYield = Math.max(yieldRaw, yieldRot)
  
  return {
    yieldRaw,
    yieldRot,
    bestYield,
    countW,
    countH,
    countWRot,
    countHRot
  }
}

export function calculateEffectiveYield(bestYield, wastePct) {
  const effectiveYield = bestYield * (1 - wastePct / 100)
  
  // Prevent divide by zero
  return effectiveYield > 0 ? effectiveYield : 0.0001
}

// =====================================================
// PATCH COST CALCULATIONS
// =====================================================

export function calculatePatchCosts(
  material,
  effectiveYield,
  machineMinutesPerSheet,
  cleanupMinutesPerSheet,
  shopMinuteRate
) {
  const { sheet_cost } = material
  
  // Prevent divide by zero
  if (effectiveYield === 0) {
    return {
      materialCostPerPatch: 0,
      laborCostPerPatch: 0
    }
  }

  const materialCostPerPatch = sheet_cost / effectiveYield
  
  const timeSheetTotal = machineMinutesPerSheet + cleanupMinutesPerSheet
  const laborCostPerSheet = timeSheetTotal * shopMinuteRate
  const laborCostPerPatch = laborCostPerSheet / effectiveYield

  return {
    materialCostPerPatch,
    laborCostPerPatch,
    laborCostPerSheet,
    timeSheetTotal
  }
}

// =====================================================
// QUOTE COST CALCULATIONS
// =====================================================

export function calculateQuoteCosts(
  materialCostPerPatch,
  laborCostPerPatch,
  qty,
  proofMinutes,
  setupMinutes,
  packingMinutes,
  applyMinutesPerHat,
  hatsSuppliedBy,
  hatUnitCost,
  shopMinuteRate
) {
  const patchCostPerHat = materialCostPerPatch + laborCostPerPatch

  const orderMinutes = proofMinutes + setupMinutes + packingMinutes
  const orderLabor = orderMinutes * shopMinuteRate
  const orderLaborPerHat = orderLabor / qty

  const applyLaborPerHat = applyMinutesPerHat * shopMinuteRate

  const hatCostPerHat = hatsSuppliedBy === 'us' ? hatUnitCost : 0

  const trueCostPerHat = patchCostPerHat + orderLaborPerHat + applyLaborPerHat + hatCostPerHat

  return {
    patchCostPerHat,
    orderMinutes,
    orderLabor,
    orderLaborPerHat,
    applyLaborPerHat,
    hatCostPerHat,
    trueCostPerHat
  }
}

export function calculatePricing(
  trueCostPerHat,
  targetMarginPct,
  rushPct,
  qty,
  shippingCharge
) {
  // Prevent divide by zero or invalid margin
  const effectiveMargin = targetMarginPct >= 100 ? 99 : targetMarginPct
  
  const unitPriceRaw = trueCostPerHat / (1 - effectiveMargin / 100)
  const unitPrice = roundToNickel(unitPriceRaw)
  
  const unitPriceRush = unitPrice * (1 + rushPct / 100)
  const unitPriceRushRounded = roundToNickel(unitPriceRush)
  
  const totalPrice = roundToDollar(unitPriceRushRounded * qty + shippingCharge)

  return {
    unitPrice: unitPriceRushRounded,
    totalPrice,
    unitPriceBeforeRush: unitPrice
  }
}

// =====================================================
// TIER PRICING GENERATOR - PROFIT LADDER MODEL
// =====================================================

export function calculateTierPricingWithProfitLadder(
  trueCostPerHat,
  profitAnchor, // Target profit at 24+ tier
  tierQuantities = [24, 48, 96, 144, 384, 768],
  profitMultipliers = [1.00, 0.92, 0.85, 0.80, 0.72, 0.65],
  setupFee = 30,
  qty = 0
) {
  const tierPrices = {}
  const MIN_TIER_STEPDOWN = 0.05
  let previousPrice = Infinity

  // Calculate for 1-23 tier (highest price, no volume discount)
  const smallQtyProfit = profitAnchor * 1.2 // 20% higher profit for small quantities
  const smallQtyPrice = trueCostPerHat + smallQtyProfit
  tierPrices['1-23'] = {
    unit: roundToNickel(smallQtyPrice),
    total: null, // Calculated per specific qty
    minQty: 1,
    maxQty: 23
  }
  previousPrice = roundToNickel(smallQtyPrice)

  // Calculate for volume tiers
  tierQuantities.forEach((tierQty, index) => {
    const multiplier = profitMultipliers[index] || 0.65
    const tierProfit = profitAnchor * multiplier
    let tierUnitPrice = trueCostPerHat + tierProfit
    
    // Round to nickel
    let tierUnitPriceRounded = roundToNickel(tierUnitPrice)
    
    // Enforce strictly decreasing with minimum stepdown
    if (tierUnitPriceRounded >= previousPrice) {
      tierUnitPriceRounded = previousPrice - MIN_TIER_STEPDOWN
      if (tierUnitPriceRounded < trueCostPerHat + 0.10) {
        tierUnitPriceRounded = trueCostPerHat + 0.10 // Minimum 10¢ profit
      }
    }
    
    previousPrice = tierUnitPriceRounded
    
    tierPrices[tierQty] = {
      unit: tierUnitPriceRounded,
      total: null, // Calculated when needed
      minQty: tierQty,
      maxQty: null
    }
  })

  // Calculate total for current quantity
  const activeTier = getActiveTierForQty(qty, tierPrices)
  const unitPrice = activeTier ? activeTier.unit : tierPrices['1-23'].unit
  
  // Apply setup fee (waived if qty >= 12)
  const setupFeeToApply = qty >= 12 ? 0 : setupFee
  const subtotal = unitPrice * qty
  const totalPrice = roundToDollar(subtotal + setupFeeToApply)

  return {
    tierPrices,
    unitPrice,
    subtotal,
    setupFee: setupFeeToApply,
    totalPrice,
    activeTierKey: activeTier ? activeTier.key : '1-23'
  }
}

// Helper to find active tier based on quantity
export function getActiveTierForQty(qty, tierPrices) {
  // Check small quantity tier first
  if (qty >= 1 && qty <= 23) {
    return { key: '1-23', ...tierPrices['1-23'] }
  }
  
  // Find the highest tier that qty qualifies for
  const tierKeys = Object.keys(tierPrices)
    .filter(k => k !== '1-23')
    .map(Number)
    .sort((a, b) => b - a) // Sort descending
  
  for (const tierQty of tierKeys) {
    if (qty >= tierQty) {
      return { key: tierQty.toString(), ...tierPrices[tierQty] }
    }
  }
  
  return { key: '1-23', ...tierPrices['1-23'] }
}

// =====================================================
// TIER PRICING GENERATOR (OLD - DEPRECATED, keeping for backwards compat)
// =====================================================

export function calculateTierPricing(
  materialCostPerPatch,
  laborCostPerPatch,
  tierQuantities,
  proofMinutes,
  setupMinutes,
  packingMinutes,
  applyMinutesPerHat,
  hatsSuppliedBy,
  hatUnitCost,
  targetMarginPct,
  rushPct,
  shopMinuteRate
) {
  const tierPrices = {}
  const MIN_TIER_STEPDOWN = 0.05 // Minimum $0.05 decrease between tiers
  
  const orderMinutes = proofMinutes + setupMinutes + packingMinutes
  const orderLabor = orderMinutes * shopMinuteRate
  const applyLaborPerHat = applyMinutesPerHat * shopMinuteRate
  const hatCostPerHat = hatsSuppliedBy === 'us' ? hatUnitCost : 0
  const patchCostPerHat = materialCostPerPatch + laborCostPerPatch

  let previousPrice = Infinity // Track previous tier price to enforce decreasing

  tierQuantities.forEach(tierQty => {
    const orderLaborPerHatT = orderLabor / tierQty
    const trueCostPerHatT = patchCostPerHat + orderLaborPerHatT + applyLaborPerHat + hatCostPerHat
    
    const effectiveMargin = targetMarginPct >= 100 ? 99 : targetMarginPct
    const unitPriceT = trueCostPerHatT / (1 - effectiveMargin / 100)
    const unitPriceTRush = unitPriceT * (1 + rushPct / 100)
    
    // Round to nickel for display
    let unitPriceTRushRounded = roundToNickel(unitPriceTRush)
    
    // Enforce strictly decreasing prices with minimum stepdown
    if (unitPriceTRushRounded >= previousPrice) {
      unitPriceTRushRounded = previousPrice - MIN_TIER_STEPDOWN
      // Ensure it doesn't go below a reasonable minimum
      if (unitPriceTRushRounded < 0.05) {
        unitPriceTRushRounded = 0.05
      }
    }
    
    previousPrice = unitPriceTRushRounded
    
    const totalT = roundToDollar(unitPriceTRushRounded * tierQty)

    tierPrices[tierQty] = {
      unit: unitPriceTRushRounded,
      total: totalT
    }
  })

  return tierPrices
}

// =====================================================
// QUOTE SCRIPTS GENERATOR
// =====================================================

export function generateQuoteScripts(
  qty,
  hatsSuppliedBy,
  materialName,
  patchWidth,
  patchHeight,
  unitPrice,
  totalPrice,
  tierPrices,
  turnaroundText
) {
  // Get first 4 tier prices for scripts
  const tierKeys = Object.keys(tierPrices).sort((a, b) => Number(a) - Number(b))
  const t24 = tierPrices[tierKeys[0]]?.unit || 0
  const t48 = tierPrices[tierKeys[1]]?.unit || 0
  const t96 = tierPrices[tierKeys[2]]?.unit || 0
  const t144 = tierPrices[tierKeys[3]]?.unit || 0

  const quoteSMS = `Quote: ${qty} patch hats (${hatsSuppliedBy} hats) w/ ${materialName} patch ${patchWidth}×${patchHeight}. $${unitPrice}/hat = $${totalPrice}. Tiers: 24+ $${t24} | 48+ $${t48} | 96+ $${t96} | 144+ $${t144}. Turnaround ${turnaroundText}. Reply APPROVED and I'll send proof + invoice.`

  const quoteDM = `Quote for ${qty} patch hats — ${materialName} patch ${patchWidth}×${patchHeight} applied front.
Price: $${unitPrice}/hat = $${totalPrice}.
Tiers: 24+ $${t24} | 48+ $${t48} | 96+ $${t96} | 144+ $${t144} (higher qty available).
Includes: patch production + application + QC + pack-out.
Turnaround: ${turnaroundText} after proof approval.
Next step: Reply APPROVED + confirm hat colors + ship-to address and I'll invoice.`

  const quotePhone = `For ${qty} hats with a ${patchWidth}×${patchHeight} ${materialName} patch applied, you're around $${unitPrice} each ($${totalPrice} total). That includes making the patches, applying them, and QC. Turnaround is ${turnaroundText}. If you're good with it, I'll send the proof and invoice and get you on the schedule.`

  return {
    quoteSMS,
    quoteDM,
    quotePhone
  }
}

// =====================================================
// COMPLETE QUOTE CALCULATION
// =====================================================

export function calculateCompleteQuote(quoteData, shopSettings, material) {
  // Calculate shop rates
  const { shopRate, shopMinuteRate } = calculateShopRates(shopSettings)

  // Calculate patch overall size
  const { patchWOverall, patchHOverall } = calculatePatchOverallSize(
    quoteData.patch_width_input,
    quoteData.patch_height_input,
    quoteData.patch_size_mode,
    quoteData.outline_allowance
  )

  // Calculate yield
  let bestYield
  if (quoteData.yield_method === 'manual') {
    bestYield = quoteData.manual_yield || 1
  } else {
    const yieldCalc = calculateAutoYield(
      material,
      patchWOverall,
      patchHOverall,
      quoteData.gap,
      quoteData.border
    )
    bestYield = yieldCalc.bestYield
  }

  const effectiveYield = calculateEffectiveYield(bestYield, quoteData.waste_pct)

  // Calculate patch costs
  const { materialCostPerPatch, laborCostPerPatch } = calculatePatchCosts(
    material,
    effectiveYield,
    quoteData.machine_minutes_per_sheet,
    quoteData.cleanup_minutes_per_sheet,
    shopMinuteRate
  )

  // Calculate quote costs
  const { trueCostPerHat } = calculateQuoteCosts(
    materialCostPerPatch,
    laborCostPerPatch,
    quoteData.qty,
    quoteData.proof_minutes,
    quoteData.setup_minutes,
    quoteData.packing_minutes,
    quoteData.apply_minutes_per_hat,
    quoteData.hats_supplied_by,
    quoteData.hat_unit_cost,
    shopMinuteRate
  )

  // Calculate pricing using profit ladder model
  const profitAnchor = quoteData.profit_anchor || 3.00 // Default $3 profit at 24+
  const setupFee = quoteData.setup_fee !== undefined ? quoteData.setup_fee : 30
  const profitMultipliers = quoteData.profit_multipliers || [1.00, 0.92, 0.85, 0.80, 0.72, 0.65]
  
  const pricingResult = calculateTierPricingWithProfitLadder(
    trueCostPerHat,
    profitAnchor,
    [24, 48, 96, 144, 384, 768],
    profitMultipliers,
    setupFee,
    quoteData.qty
  )

  const { tierPrices, unitPrice, subtotal, totalPrice, activeTierKey } = pricingResult
  const setupFeeApplied = pricingResult.setupFee

  // Generate quote scripts
  const { quoteSMS, quoteDM, quotePhone } = generateQuoteScripts(
    quoteData.qty,
    quoteData.hats_supplied_by,
    material.name,
    quoteData.patch_width_input,
    quoteData.patch_height_input,
    unitPrice,
    totalPrice,
    tierPrices,
    quoteData.turnaround_text
  )

  return {
    shop_rate: shopRate,
    shop_minute_rate: shopMinuteRate,
    best_yield: bestYield,
    effective_yield: effectiveYield,
    material_cost_per_patch: materialCostPerPatch,
    labor_cost_per_patch: laborCostPerPatch,
    true_cost_per_hat: trueCostPerHat,
    unit_price: unitPrice,
    total_price: totalPrice,
    tier_prices_json: tierPrices,
    quote_sms: quoteSMS,
    quote_dm: quoteDM,
    quote_phone: quotePhone
  }
}

// =====================================================
// FINISHED HAT PRICING CALCULATIONS
// =====================================================

export function calculateFinishedHatQuote(quoteData, shopSettings) {
  // Calculate shop rates
  const { shopRate, shopMinuteRate } = calculateShopRates(shopSettings)

  // Calculate order labor
  const orderMinutes = quoteData.proof_minutes + quoteData.setup_minutes + quoteData.packing_minutes
  const orderLabor = orderMinutes * shopMinuteRate
  const orderLaborPerHat = orderLabor / quoteData.buy_qty

  // Calculate apply labor
  const applyLaborPerHat = quoteData.apply_minutes_per_hat * shopMinuteRate

  // Calculate true cost
  const trueCostPerHat = 
    quoteData.hat_unit_cost +
    quoteData.shipping_per_hat +
    quoteData.patch_cost_per_hat +
    applyLaborPerHat +
    orderLaborPerHat

  // Calculate pricing based on method
  let unitPriceRaw
  if (quoteData.pricing_method === 'margin') {
    const effectiveMargin = quoteData.target_margin_pct >= 100 ? 99 : quoteData.target_margin_pct
    unitPriceRaw = trueCostPerHat / (1 - effectiveMargin / 100)
  } else {
    // markup
    unitPriceRaw = trueCostPerHat * quoteData.markup_multiplier
  }

  const unitPrice = roundToHalfDollar(unitPriceRaw)
  const totalPrice = roundToDollar(unitPrice * quoteData.buy_qty)

  // Calculate tier pricing
  const tierQuantities = quoteData.tier_quantities || [12, 24, 48, 96, 144, 288, 384, 768]
  const tierPrices = {}
  const tierParts = []

  tierQuantities.forEach(tierQty => {
    const orderLaborPerHatT = orderLabor / tierQty
    const trueCostPerHatT = 
      quoteData.hat_unit_cost +
      quoteData.shipping_per_hat +
      quoteData.patch_cost_per_hat +
      applyLaborPerHat +
      orderLaborPerHatT

    let unitPriceTRaw
    if (quoteData.pricing_method === 'margin') {
      const effectiveMargin = quoteData.target_margin_pct >= 100 ? 99 : quoteData.target_margin_pct
      unitPriceTRaw = trueCostPerHatT / (1 - effectiveMargin / 100)
    } else {
      unitPriceTRaw = trueCostPerHatT * quoteData.markup_multiplier
    }

    const unitPriceT = roundToHalfDollar(unitPriceTRaw)
    const totalT = roundToDollar(unitPriceT * tierQty)

    tierPrices[tierQty] = {
      unit: unitPriceT,
      total: totalT
    }

    tierParts.push(`${tierQty}+ $${unitPriceT}`)
  })

  // Generate tier quote text
  const tierQuoteText = `Tier pricing: ${tierParts.join(' | ')}. Includes hat + patch + application + QC. Reply APPROVED to invoice.`

  return {
    shop_rate: shopRate,
    shop_minute_rate: shopMinuteRate,
    true_cost_per_hat: trueCostPerHat,
    unit_price: unitPrice,
    total_price: totalPrice,
    tier_prices_json: tierPrices,
    tier_quote_text: tierQuoteText
  }
}

// =====================================================
// PATCH ONLY CALCULATIONS
// =====================================================

export function calculatePatchOnlyQuote(quoteData, shopSettings, material) {
  // Calculate shop rates
  const { shopRate, shopMinuteRate } = calculateShopRates(shopSettings)

  // Calculate patch overall size
  const { patchWOverall, patchHOverall } = calculatePatchOverallSize(
    quoteData.patch_width_input,
    quoteData.patch_height_input,
    quoteData.patch_size_mode,
    quoteData.outline_allowance
  )

  // Calculate yield
  let bestYield
  if (quoteData.yield_method === 'manual') {
    bestYield = quoteData.manual_yield || 1
  } else {
    const yieldCalc = calculateAutoYield(
      material,
      patchWOverall,
      patchHOverall,
      quoteData.gap,
      quoteData.border
    )
    bestYield = yieldCalc.bestYield
  }

  const effectiveYield = calculateEffectiveYield(bestYield, quoteData.waste_pct)

  // Calculate sheets needed
  const sheetsNeeded = quoteData.qty / effectiveYield

  // Material costs
  const materialCostTotal = sheetsNeeded * material.sheet_cost
  
  // Labor costs (machine + cleanup)
  const timePerSheet = quoteData.machine_minutes_per_sheet + quoteData.cleanup_minutes_per_sheet
  const laborTotal = sheetsNeeded * timePerSheet * shopMinuteRate

  // Order labor (proof + setup + packing)
  const orderMinutes = quoteData.proof_minutes + quoteData.setup_minutes + quoteData.packing_minutes
  const orderLaborTotal = orderMinutes * shopMinuteRate

  // Total cost
  const totalCost = materialCostTotal + laborTotal + orderLaborTotal
  const trueCostPerUnit = totalCost / quoteData.qty

  // Pricing
  const effectiveMargin = quoteData.target_margin_pct >= 100 ? 99 : quoteData.target_margin_pct
  const unitPriceRaw = trueCostPerUnit / (1 - effectiveMargin / 100)
  const unitPrice = roundToNickel(unitPriceRaw)
  
  const unitPriceRush = unitPrice * (1 + quoteData.rush_pct / 100)
  const unitPriceRushRounded = roundToNickel(unitPriceRush)
  
  const totalPrice = roundToDollar(unitPriceRushRounded * quoteData.qty + (quoteData.shipping_charge || 0))

  // Calculate tier pricing (strictly decreasing)
  const tierPrices = {}
  const tierQuantities = quoteData.tier_quantities || [24, 48, 96, 144, 384, 768]
  const MIN_TIER_STEPDOWN = 0.05
  let previousPrice = Infinity
  
  tierQuantities.forEach(tierQty => {
    const sheetsNeededT = tierQty / effectiveYield
    const materialCostTotalT = sheetsNeededT * material.sheet_cost
    const laborTotalT = sheetsNeededT * timePerSheet * shopMinuteRate
    const totalCostT = materialCostTotalT + laborTotalT + orderLaborTotal
    const trueCostPerUnitT = totalCostT / tierQty
    
    const unitPriceT = trueCostPerUnitT / (1 - effectiveMargin / 100)
    const unitPriceTRush = unitPriceT * (1 + quoteData.rush_pct / 100)
    let unitPriceTRushRounded = roundToNickel(unitPriceTRush)
    
    // Enforce strictly decreasing
    if (unitPriceTRushRounded >= previousPrice) {
      unitPriceTRushRounded = previousPrice - MIN_TIER_STEPDOWN
      if (unitPriceTRushRounded < 0.05) {
        unitPriceTRushRounded = 0.05
      }
    }
    
    previousPrice = unitPriceTRushRounded
    const totalT = roundToDollar(unitPriceTRushRounded * tierQty)

    tierPrices[tierQty] = {
      unit: unitPriceTRushRounded,
      total: totalT
    }
  })

  // Generate quote scripts for patches
  const { quoteSMS, quoteDM, quotePhone } = generatePatchOnlyScripts(
    quoteData.qty,
    material.name,
    quoteData.patch_width_input,
    quoteData.patch_height_input,
    unitPriceRushRounded,
    totalPrice,
    tierPrices,
    quoteData.turnaround_text
  )

  return {
    shop_rate: shopRate,
    shop_minute_rate: shopMinuteRate,
    best_yield: bestYield,
    effective_yield: effectiveYield,
    material_cost_per_patch: materialCostTotal / quoteData.qty,
    labor_cost_per_patch: laborTotal / quoteData.qty,
    true_cost_per_hat: trueCostPerUnit,
    unit_price: unitPriceRushRounded,
    total_price: totalPrice,
    tier_prices_json: tierPrices,
    quote_sms: quoteSMS,
    quote_dm: quoteDM,
    quote_phone: quotePhone,
    units_label: 'patch'
  }
}

// =====================================================
// PATCH ONLY SCRIPTS GENERATOR
// =====================================================

export function generatePatchOnlyScripts(
  qty,
  materialName,
  patchWidth,
  patchHeight,
  unitPrice,
  totalPrice,
  tierPrices,
  turnaroundText
) {
  // Get first 4 tier prices for scripts
  const tierKeys = Object.keys(tierPrices).sort((a, b) => Number(a) - Number(b))
  const t24 = tierPrices[tierKeys[0]]?.unit || 0
  const t48 = tierPrices[tierKeys[1]]?.unit || 0
  const t96 = tierPrices[tierKeys[2]]?.unit || 0
  const t144 = tierPrices[tierKeys[3]]?.unit || 0

  const quoteSMS = `Quote: ${qty} ${materialName} patches ${patchWidth}×${patchHeight}. $${unitPrice}/patch = $${totalPrice}. Tiers: 24+ $${t24} | 48+ $${t48} | 96+ $${t96} | 144+ $${t144}. Turnaround ${turnaroundText}. Reply APPROVED and I'll send proof + invoice.`

  const quoteDM = `Quote for ${qty} ${materialName} patches — ${patchWidth}×${patchHeight}.
Price: $${unitPrice}/patch = $${totalPrice}.
Tiers: 24+ $${t24} | 48+ $${t48} | 96+ $${t96} | 144+ $${t144} (higher qty available).
Includes: patch production + QC + pack-out.
Turnaround: ${turnaroundText} after proof approval.
Next step: Reply APPROVED + confirm ship-to address and I'll invoice.`

  const quotePhone = `For ${qty} ${materialName} patches at ${patchWidth}×${patchHeight}, you're around $${unitPrice} each ($${totalPrice} total). That includes making the patches and QC. Turnaround is ${turnaroundText}. If you're good with it, I'll send the proof and invoice and get you on the schedule.`

  return {
    quoteSMS,
    quoteDM,
    quotePhone
  }
}

// =====================================================
// TIER PRICING COPY TEXT (for copy button)
// =====================================================

export function generateTierPricingText(tierPrices, unitsLabel = 'hat') {
  const tierKeys = Object.keys(tierPrices).sort((a, b) => Number(a) - Number(b))
  const tierParts = tierKeys.map(qty => `${qty}+ $${tierPrices[qty].unit}/${unitsLabel}`)
  return `Tier pricing: ${tierParts.join(' | ')}. Reply APPROVED to invoice.`
}

// =====================================================
// ACTIVE TIER & UPSELL CALCULATION
// =====================================================

export function getActiveTierAndUpsell(qty, tierPrices) {
  const tierKeys = Object.keys(tierPrices)
    .map(Number)
    .sort((a, b) => a - b)
  
  // Find current tier
  let activeTier = tierKeys[0]
  for (const tier of tierKeys) {
    if (qty >= tier) {
      activeTier = tier
    } else {
      break
    }
  }
  
  // Find next tier
  const currentIndex = tierKeys.indexOf(activeTier)
  const nextTier = tierKeys[currentIndex + 1]
  
  let upsellMessage = null
  if (nextTier && qty < nextTier) {
    const qtyNeeded = nextTier - qty
    const currentPrice = tierPrices[activeTier].unit
    const nextPrice = tierPrices[nextTier].unit
    const savings = (currentPrice - nextPrice).toFixed(2)
    
    upsellMessage = `Add ${qtyNeeded} more to reach next tier and save $${savings} per unit`
  }
  
  return {
    activeTier,
    nextTier,
    upsellMessage
  }
}


// =====================================================
// PROFIT FIRST ALLOCATIONS
// =====================================================

export function calculateProfitFirstAllocations(totalPrice, profitFirstSettings) {
  return {
    profit: (totalPrice * profitFirstSettings.profit_pct) / 100,
    tax: (totalPrice * profitFirstSettings.tax_pct) / 100,
    ownerPay: (totalPrice * profitFirstSettings.owner_pay_pct) / 100,
    ops: (totalPrice * profitFirstSettings.ops_pct) / 100,
    buffer: (totalPrice * profitFirstSettings.buffer_pct) / 100
  }
}
