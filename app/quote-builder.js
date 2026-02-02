'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calculator, Copy, Check, DollarSign, Loader2, Package, Eye, EyeOff, Save, ChevronDown, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// ============================================
// PRICING ENGINE - Cost-Based Only
// ============================================

function roundToCents(n) {
  if (n === null || n === undefined || isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function formatMoney(n) {
  const rounded = roundToCents(n)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded)
}

function formatPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.0%'
  return `${roundToCents(n).toFixed(1)}%`
}

const TIER_RANGES = [
  { key: '1-23', rangeLabel: '1–23', startQty: 1, endQty: 23 },
  { key: '24-47', rangeLabel: '24–47', startQty: 24, endQty: 47 },
  { key: '48-95', rangeLabel: '48–95', startQty: 48, endQty: 95 },
  { key: '96-143', rangeLabel: '96–143', startQty: 96, endQty: 143 },
  { key: '144-287', rangeLabel: '144–287', startQty: 144, endQty: 287 },
  { key: '288-575', rangeLabel: '288–575', startQty: 288, endQty: 575 },
  { key: '576+', rangeLabel: '576+', startQty: 576, endQty: null }
]

function getTierForQty(qty) {
  for (const tier of TIER_RANGES) {
    if (tier.endQty === null) {
      if (qty >= tier.startQty) return tier
    } else {
      if (qty >= tier.startQty && qty <= tier.endQty) return tier
    }
  }
  return TIER_RANGES[TIER_RANGES.length - 1]
}

function calculateShopRate(shopSettings) {
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

function calculateCostAtQty(qty, params) {
  const { 
    material, 
    patchesPerSheet,
    wastePct,
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

  // Apply waste to get effective yield
  const effectiveYield = patchesPerSheet * (1 - (wastePct || 0) / 100)
  
  // Sheets needed (ceiling)
  const sheets = Math.ceil(qty / Math.max(effectiveYield, 1))
  
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
  const costPerPiece = roundToCents(totalCost / qty)

  return { 
    qty, 
    sheets, 
    effectiveYield: roundToCents(effectiveYield),
    materialCost, 
    blankCost, 
    timeMins: roundToCents(timeMins), 
    laborCost, 
    totalCost, 
    costPerPiece 
  }
}

// Calculate wholesale (net) price from cost using markup or margin
function calculateWholesale(costPerPiece, pricingMethod, markupPct, marginPct) {
  let wholesalePerPiece
  if (pricingMethod === 'margin') {
    const margin = Math.min((marginPct || 40) / 100, 0.99)
    wholesalePerPiece = costPerPiece / (1 - margin)
  } else {
    const markup = (markupPct || 50) / 100
    wholesalePerPiece = costPerPiece * (1 + markup)
  }
  return roundToCents(wholesalePerPiece)
}

function computeQuote(quoteInputs, shopSettings, material) {
  const quoteType = quoteInputs.quote_type || 'patch_press'
  const qty = quoteInputs.qty || 144
  const patchesPerSheet = quoteInputs.patches_per_sheet || 12

  const shopRatePerHour = calculateShopRate(shopSettings)

  const costParams = {
    material,
    patchesPerSheet,
    wastePct: quoteInputs.waste_pct || 5,
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

  // ACTIVE QUANTITY - Calculate cost and wholesale
  const activeBreakdown = calculateCostAtQty(qty, costParams)
  const activeTier = getTierForQty(qty)
  const activeWholesalePerPiece = calculateWholesale(activeBreakdown.costPerPiece, pricingMethod, markupPct, marginPct)
  const activeProfitPerPiece = roundToCents(activeWholesalePerPiece - activeBreakdown.costPerPiece)
  const activeMarginPct = activeWholesalePerPiece > 0 ? roundToCents((activeProfitPerPiece / activeWholesalePerPiece) * 100) : 0
  const activeSetupFee = qty >= setupWaiveQty ? 0 : setupFeeDefault
  
  // Totals based on wholesale price (what you charge the customer)
  const activeSubtotal = roundToCents(activeWholesalePerPiece * qty)
  const activeTotal = roundToCents(activeSubtotal + activeSetupFee)

  // TIER MATRIX (recompute cost at each tier start qty)
  const tiers = TIER_RANGES.map(tier => {
    const tierBreakdown = calculateCostAtQty(tier.startQty, costParams)
    const wholesalePerPiece = calculateWholesale(tierBreakdown.costPerPiece, pricingMethod, markupPct, marginPct)
    const profitPerPiece = roundToCents(wholesalePerPiece - tierBreakdown.costPerPiece)
    const marginPctVal = wholesalePerPiece > 0 ? roundToCents((profitPerPiece / wholesalePerPiece) * 100) : 0
    const setupFeeApplied = tier.startQty >= setupWaiveQty ? 0 : setupFeeDefault

    return {
      key: tier.key,
      rangeLabel: tier.rangeLabel,
      startQty: tier.startQty,
      endQty: tier.endQty,
      isActive: tier.key === activeTier.key,
      // Cost (what it costs you)
      costPerPiece: tierBreakdown.costPerPiece,
      // Wholesale/Net (what you charge)
      wholesalePerPiece,
      // Profit
      profitPerPiece,
      marginPct: marginPctVal,
      setupFeeApplied
    }
  })

  // SCRIPTS - Use wholesale price for customer-facing scripts
  const unitLabel = quoteType === 'patch_only' ? 'patch' : 'hat'
  const unitLabelPlural = quoteType === 'patch_only' ? 'patches' : 'hats'
  const materialName = material?.name || 'Leatherette'
  const patchSize = `${quoteInputs.patch_width || 3.25}×${quoteInputs.patch_height || 2.25}`
  const turnaround = quoteInputs.turnaround_text || '5–7 business days'
  const tierPricesText = tiers.slice(1, 5).map(t => `${t.rangeLabel} ${formatMoney(t.wholesalePerPiece)}`).join(' | ')

  const quoteSMS = `Quote: ${qty} ${unitLabelPlural} w/ ${materialName} patch ${patchSize}. ${formatMoney(activeWholesalePerPiece)}/${unitLabel} = ${formatMoney(activeTotal)}. Tiers: ${tierPricesText}. Turnaround ${turnaround}. Reply APPROVED and I'll send proof + invoice.`
  const quoteDM = `Quote for ${qty} ${unitLabelPlural} — ${materialName} patch ${patchSize}.\nPrice: ${formatMoney(activeWholesalePerPiece)}/${unitLabel} = ${formatMoney(activeTotal)}.\nTiers: ${tierPricesText}.\nTurnaround: ${turnaround} after proof approval.\nReply APPROVED + ship-to address and I'll invoice.`
  const quotePhone = `For ${qty} ${unitLabelPlural} with a ${patchSize} ${materialName} patch, you're around ${formatMoney(activeWholesalePerPiece)} each (${formatMoney(activeTotal)} total). Turnaround is ${turnaround}. Reply APPROVED to start.`

  return {
    active: {
      qty,
      tier: activeTier,
      // Cost (Shop View primary)
      costPerPiece: activeBreakdown.costPerPiece,
      // Wholesale/Net (Customer View primary)
      wholesalePerPiece: activeWholesalePerPiece,
      // Profit analysis
      profitPerPiece: activeProfitPerPiece,
      marginPct: activeMarginPct,
      // Totals (based on wholesale)
      setupFeeApplied: activeSetupFee,
      subtotal: activeSubtotal,
      total: activeTotal,
      breakdown: activeBreakdown
    },
    tiers,
    scripts: { sms: quoteSMS, dm: quoteDM, phone: quotePhone },
    settings: { pricingMethod, markupPct, marginPct, patchesPerSheet, shopRatePerHour }
  }
}

// ============================================
// QUOTE BUILDER COMPONENT
// ============================================

export default function QuoteBuilder() {
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [shopSettings, setShopSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedScript, setCopiedScript] = useState(null)
  const [viewMode, setViewMode] = useState('shop') // 'shop' = Cost view, 'customer' = Wholesale/Net view
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    quote_type: 'patch_press',
    customer_id: null,
    qty: 144,
    patch_material_id: '',
    patch_width: 3.25,
    patch_height: 2.25,
    patches_per_sheet: 12,
    waste_pct: 5,
    machine_minutes_per_sheet: 12,
    cleanup_minutes_per_sheet: 5,
    hats_supplied_by: 'customer',
    hat_unit_cost: 0,
    apply_minutes_per_hat: 2.0,
    proof_minutes: 5,
    setup_minutes: 5,
    packing_minutes: 5,
    turnaround_text: '5–7 business days'
  })

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, cRes, sRes] = await Promise.all([
          fetch('/api?path=patch-materials'),
          fetch('/api?path=customers'),
          fetch('/api?path=shop-settings')
        ])

        let mats = [], custs = [], settings = null

        if (mRes.ok) mats = await mRes.json()
        if (cRes.ok) custs = await cRes.json()
        if (sRes.ok) settings = await sRes.json()

        setMaterials(Array.isArray(mats) ? mats : [])
        setCustomers(Array.isArray(custs) ? custs : [])
        setShopSettings(settings)

        const savedQuoteType = typeof window !== 'undefined' ? localStorage.getItem('default_quote_type') : null
        
        setFormData(prev => ({
          ...prev,
          quote_type: savedQuoteType || prev.quote_type,
          patch_material_id: mats[0]?.id || '',
          waste_pct: settings?.default_waste_pct ?? prev.waste_pct,
          apply_minutes_per_hat: settings?.default_apply_minutes_per_hat ?? prev.apply_minutes_per_hat,
          proof_minutes: settings?.default_proof_minutes ?? prev.proof_minutes,
          setup_minutes: settings?.default_setup_minutes ?? prev.setup_minutes,
          packing_minutes: settings?.default_packing_minutes ?? prev.packing_minutes
        }))

        setLoading(false)
      } catch (error) {
        console.error('Load error:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // RECALCULATE
  const recalculate = useCallback(() => {
    if (!formData.patch_material_id) return
    const material = materials.find(m => m.id === formData.patch_material_id)
    if (!material) return

    try {
      const result = computeQuote(formData, shopSettings, material)
      setResults(result)
    } catch (error) {
      console.error('Calc error:', error)
    }
  }, [formData, shopSettings, materials])

  // Auto-recalculate
  useEffect(() => {
    if (!loading) recalculate()
  }, [formData, loading, recalculate])

  const updateField = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      if (field === 'quote_type' && typeof window !== 'undefined') {
        localStorage.setItem('default_quote_type', value)
      }
      return newData
    })
  }

  async function handleSave(status = 'draft') {
    setSaving(true)
    try {
      const response = await fetch('/api?path=quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, status })
      })
      if (!response.ok) throw new Error('Save failed')
      toast({ title: 'Quote saved!', description: `Status: ${status}` })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedScript(key)
      toast({ title: 'Copied!' })
      setTimeout(() => setCopiedScript(null), 2000)
    } catch (e) {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const unitLabel = formData.quote_type === 'patch_only' ? 'patch' : 'hat'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Quote Builder</h2>
          <p className="text-sm text-gray-600">Auto-calculates as you type</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={recalculate}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recalc
          </Button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('shop')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                viewMode === 'shop' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" /> Shop (Cost)
            </button>
            <button
              onClick={() => setViewMode('customer')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                viewMode === 'customer' ? 'bg-white shadow text-blue-700' : 'text-gray-600'
              }`}
            >
              <EyeOff className="w-3 h-3" /> Customer (Net)
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* LEFT: Inputs */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quote Type + Qty */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-sm">Quote Type</Label>
                  <Tabs value={formData.quote_type} onValueChange={(v) => updateField('quote_type', v)} className="mt-1">
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="patch_press" className="text-xs">
                        <Package className="w-3 h-3 mr-1" /> Patch+Press
                      </TabsTrigger>
                      <TabsTrigger value="patch_only" className="text-xs">
                        <DollarSign className="w-3 h-3 mr-1" /> Patch Only
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="w-28">
                  <Label className="text-sm">Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="mt-1 text-right tabular-nums font-mono"
                    value={formData.qty || ''}
                    onChange={(e) => updateField('qty', parseInt(e.target.value) || 0)}
                  />
                </div>
                {formData.quote_type === 'patch_press' && (
                  <div className="w-32">
                    <Label className="text-sm">Hats By</Label>
                    <Select value={formData.hats_supplied_by} onValueChange={(v) => updateField('hats_supplied_by', v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="us">Us</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.quote_type === 'patch_press' && formData.hats_supplied_by === 'us' && (
                  <div className="w-28">
                    <Label className="text-sm">Hat Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 text-right tabular-nums font-mono"
                      value={formData.hat_unit_cost || ''}
                      onChange={(e) => updateField('hat_unit_cost', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm">Customer (optional)</Label>
                <Select value={formData.customer_id || 'none'} onValueChange={(v) => updateField('customer_id', v === 'none' ? null : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No customer —</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Material + Yield */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Material & Yield</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Material</Label>
                <Select value={formData.patch_material_id} onValueChange={(v) => updateField('patch_material_id', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select material" /></SelectTrigger>
                  <SelectContent>
                    {materials.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({formatMoney(m.sheet_cost)}/sheet)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Patches per Sheet</Label>
                  <p className="text-xs text-gray-500 mb-1">How many patches fit on one sheet</p>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="text-right tabular-nums font-mono text-lg"
                    value={formData.patches_per_sheet || ''}
                    onChange={(e) => updateField('patches_per_sheet', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label className="text-sm">Waste %</Label>
                  <p className="text-xs text-gray-500 mb-1">Account for defects</p>
                  <Input
                    type="number"
                    className="text-right tabular-nums font-mono"
                    value={formData.waste_pct || ''}
                    onChange={(e) => updateField('waste_pct', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <Label className="text-xs text-gray-500">Patch Width (for scripts)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.patch_width || ''}
                    onChange={(e) => updateField('patch_width', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Patch Height (for scripts)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.patch_height || ''}
                    onChange={(e) => updateField('patch_height', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Time Settings</CardTitle>
                  <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Machine min/sheet</Label>
                      <Input type="number" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.machine_minutes_per_sheet || ''}
                        onChange={(e) => updateField('machine_minutes_per_sheet', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Cleanup min/sheet</Label>
                      <Input type="number" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.cleanup_minutes_per_sheet || ''}
                        onChange={(e) => updateField('cleanup_minutes_per_sheet', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  {formData.quote_type === 'patch_press' && (
                    <div className="w-40">
                      <Label className="text-xs">Apply min/hat</Label>
                      <Input type="number" step="0.5" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.apply_minutes_per_hat || ''}
                        onChange={(e) => updateField('apply_minutes_per_hat', parseFloat(e.target.value) || 0)} />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Proof min</Label>
                      <Input type="number" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.proof_minutes || ''}
                        onChange={(e) => updateField('proof_minutes', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Setup min</Label>
                      <Input type="number" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.setup_minutes || ''}
                        onChange={(e) => updateField('setup_minutes', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Packing min</Label>
                      <Input type="number" className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.packing_minutes || ''}
                        onChange={(e) => updateField('packing_minutes', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Turnaround */}
          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm">Turnaround</Label>
              <Input className="mt-1" value={formData.turnaround_text || ''} onChange={(e) => updateField('turnaround_text', e.target.value)} />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Results */}
        <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start space-y-4">
          {results ? (
            <>
              {/* ========== SHOP VIEW (COST) ========== */}
              {viewMode === 'shop' && (
                <>
                  <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Shop View - Your Costs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Primary: Per Patch COST */}
                      <div className="text-center py-3 border-b">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Per {unitLabel} Cost</div>
                        <div className="text-4xl font-bold text-red-600 tabular-nums font-mono">
                          {formatMoney(results.active.costPerPiece)}
                        </div>
                        <div className="text-xs text-gray-500">your true cost</div>
                      </div>

                      {/* Cost breakdown */}
                      <div className="space-y-1 text-sm border-b pb-3">
                        <div className="flex justify-between text-gray-600">
                          <span>Material ({results.active.breakdown.sheets} sheets × {formatMoney(materials.find(m => m.id === formData.patch_material_id)?.sheet_cost || 7)})</span>
                          <span className="tabular-nums font-mono">{formatMoney(results.active.breakdown.materialCost)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Labor ({results.active.breakdown.timeMins} min × {formatMoney(results.settings.shopRatePerHour)}/hr)</span>
                          <span className="tabular-nums font-mono">{formatMoney(results.active.breakdown.laborCost)}</span>
                        </div>
                        {results.active.breakdown.blankCost > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>Blanks ({formData.qty} × {formatMoney(formData.hat_unit_cost)})</span>
                            <span className="tabular-nums font-mono">{formatMoney(results.active.breakdown.blankCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 border-t">
                          <span>Total Cost ({formData.qty} units)</span>
                          <span className="tabular-nums font-mono text-red-600">{formatMoney(results.active.breakdown.totalCost)}</span>
                        </div>
                      </div>

                      {/* Wholesale comparison */}
                      <div className="grid grid-cols-2 gap-2 text-center py-2 border-b">
                        <div>
                          <div className="text-xs text-gray-500">Wholesale/Net Price</div>
                          <div className="text-xl font-semibold text-blue-600 tabular-nums font-mono">
                            {formatMoney(results.active.wholesalePerPiece)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            ({results.settings.pricingMethod === 'margin' ? `${results.settings.marginPct}% margin` : `${results.settings.markupPct}% markup`})
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Profit/Piece</div>
                          <div className="text-xl font-semibold text-green-600 tabular-nums font-mono">
                            {formatMoney(results.active.profitPerPiece)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            ({formatPct(results.active.marginPct)} margin)
                          </div>
                        </div>
                      </div>

                      {/* Yield info */}
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Patches/Sheet:</span>
                          <span className="tabular-nums font-mono">{formData.patches_per_sheet}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective Yield:</span>
                          <span className="tabular-nums font-mono">{results.active.breakdown.effectiveYield}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shop Rate:</span>
                          <span className="tabular-nums font-mono">{formatMoney(results.settings.shopRatePerHour)}/hr</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SHOP Tier Matrix - Shows COST per tier */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Cost by Tier</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {results.tiers.map(tier => (
                        <div key={tier.key} className={`p-2 rounded border-2 ${tier.isActive ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold w-16 ${tier.isActive ? 'text-red-700' : 'text-gray-700'}`}>{tier.rangeLabel}</span>
                              {tier.isActive && <Badge className="bg-red-600 text-[10px] px-1 py-0">Active</Badge>}
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold tabular-nums font-mono ${tier.isActive ? 'text-red-600' : 'text-gray-900'}`}>
                                {formatMoney(tier.costPerPiece)}
                              </div>
                              <div className="text-[10px] text-gray-500 tabular-nums font-mono">
                                <span className="text-blue-600">Net: {formatMoney(tier.wholesalePerPiece)}</span>
                                <span className="text-green-600 ml-2">+{formatMoney(tier.profitPerPiece)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* ========== CUSTOMER VIEW (NET/WHOLESALE) ========== */}
              {viewMode === 'customer' && (
                <>
                  <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Customer View - Net Pricing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Primary: Wholesale/Net Price */}
                      <div className="text-center py-3 border-b">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Net Price</div>
                        <div className="text-4xl font-bold text-blue-600 tabular-nums font-mono">
                          {formatMoney(results.active.wholesalePerPiece)}
                        </div>
                        <div className="text-xs text-gray-500">per {unitLabel}</div>
                      </div>

                      {/* Totals */}
                      <div className="space-y-1 pt-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal ({formData.qty} × {formatMoney(results.active.wholesalePerPiece)})</span>
                          <span className="tabular-nums font-mono">{formatMoney(results.active.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Setup Fee</span>
                          <span className={`tabular-nums font-mono ${results.active.setupFeeApplied === 0 ? 'text-green-600' : ''}`}>
                            {results.active.setupFeeApplied === 0 ? 'Waived' : formatMoney(results.active.setupFeeApplied)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                          <span>Total</span>
                          <span className="text-blue-600 tabular-nums font-mono">{formatMoney(results.active.total)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CUSTOMER Tier Matrix - Shows WHOLESALE/NET price per tier */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Net Pricing by Tier</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {results.tiers.map(tier => (
                        <div key={tier.key} className={`p-2 rounded border-2 ${tier.isActive ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold w-16 ${tier.isActive ? 'text-blue-700' : 'text-gray-700'}`}>{tier.rangeLabel}</span>
                              {tier.isActive && <Badge className="bg-blue-600 text-[10px] px-1 py-0">Active</Badge>}
                            </div>
                            <span className={`text-lg font-bold tabular-nums font-mono ${tier.isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                              {formatMoney(tier.wholesalePerPiece)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Scripts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quote Scripts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { key: 'sms', label: 'SMS', text: results.scripts.sms },
                    { key: 'dm', label: 'DM', text: results.scripts.dm },
                    { key: 'phone', label: 'Phone', text: results.scripts.phone }
                  ].map(s => (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-medium">{s.label}</Label>
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copyToClipboard(s.text, s.key)}>
                          {copiedScript === s.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <div className="text-[10px] bg-gray-50 p-2 rounded border max-h-16 overflow-y-auto break-words leading-tight">
                        {s.text}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleSave('draft')} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Draft
                </Button>
                <Button className="flex-1" onClick={() => handleSave('sent')} disabled={saving}>
                  Mark Sent
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Calculator className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a material to see pricing</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
