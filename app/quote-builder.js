'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calculator, Copy, Check, DollarSign, Loader2, Package, Eye, EyeOff, AlertTriangle, Save, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { computeQuote, formatMoney, formatPct, TIER_RANGES } from '@/lib/pricingEngine'

export default function QuoteBuilder() {
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [shopSettings, setShopSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'
  const [results, setResults] = useState(null)
  const [copiedScript, setCopiedScript] = useState(null)
  const [viewMode, setViewMode] = useState('shop') // 'shop' | 'customer'
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()
  const saveTimeoutRef = useRef(null)
  const lastSavedRef = useRef(null)

  const [formData, setFormData] = useState({
    quote_type: 'patch_press',
    customer_id: null,
    qty: 144,
    patch_material_id: '',
    patch_width_input: 3.25,
    patch_height_input: 2.25,
    patch_size_mode: 'overall',
    outline_allowance: 0.125,
    gap: 0.0625,
    border: 0.25,
    waste_pct: 5,
    yield_method: 'auto',
    manual_yield: null,
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

  // Load quote type preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('default_quote_type')
      if (saved) setFormData(prev => ({ ...prev, quote_type: saved }))
    }
  }, [])

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [mRes, cRes, sRes] = await Promise.all([
        fetch('/api?path=patch-materials'),
        fetch('/api?path=customers'),
        fetch('/api?path=shop-settings')
      ])

      let mats = [], custs = [], settings = null

      if (mRes.ok) {
        mats = await mRes.json()
        setMaterials(mats)
      }
      if (cRes.ok) {
        custs = await cRes.json()
        setCustomers(custs)
      }
      if (sRes.ok) {
        settings = await sRes.json()
        setShopSettings(settings)
      }

      // Set defaults from shop settings
      if (settings) {
        setFormData(prev => ({
          ...prev,
          patch_material_id: prev.patch_material_id || (mats[0]?.id || ''),
          gap: settings.default_gap ?? prev.gap,
          border: settings.default_border ?? prev.border,
          waste_pct: settings.default_waste_pct ?? prev.waste_pct,
          outline_allowance: settings.outline_allowance ?? prev.outline_allowance,
          apply_minutes_per_hat: settings.default_apply_minutes_per_hat ?? prev.apply_minutes_per_hat,
          proof_minutes: settings.default_proof_minutes ?? prev.proof_minutes,
          setup_minutes: settings.default_setup_minutes ?? prev.setup_minutes,
          packing_minutes: settings.default_packing_minutes ?? prev.packing_minutes
        }))
      } else if (mats.length > 0) {
        setFormData(prev => ({ ...prev, patch_material_id: mats[0].id }))
      }

      setDataLoaded(true)
    } catch (error) {
      console.error('Error loading data:', error)
      setDataLoaded(true)
    }
  }

  // Update field helper
  const updateField = useCallback((field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Save quote type preference
      if (field === 'quote_type' && typeof window !== 'undefined') {
        localStorage.setItem('default_quote_type', value)
      }
      
      return newData
    })
  }, [])

  // Auto-calculate on form changes
  useEffect(() => {
    if (!dataLoaded || !formData.patch_material_id || !shopSettings) return

    const material = materials.find(m => m.id === formData.patch_material_id)
    if (!material) return

    try {
      const result = computeQuote(formData, shopSettings, material)
      setResults(result)
    } catch (error) {
      console.error('Calculation error:', error)
    }
  }, [formData, shopSettings, materials, dataLoaded])

  // Auto-save with debounce
  useEffect(() => {
    if (!results || !dataLoaded) return

    // Check if values actually changed
    const currentHash = JSON.stringify({ ...formData, results: results.active })
    if (lastSavedRef.current === currentHash) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSaveStatus('saving')

    // Debounced save after 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Auto-save as draft (optional - uncomment if you want actual saves)
        // await fetch('/api?path=quotes', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ ...formData, status: 'draft' })
        // })
        lastSavedRef.current = currentHash
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (error) {
        setSaveStatus(null)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [results, formData, dataLoaded])

  // Manual save
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

  // Copy to clipboard
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
  const selectedMaterial = materials.find(m => m.id === formData.patch_material_id)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Quote Builder</h2>
          <p className="text-sm text-gray-600">Auto-calculates as you type</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Save Status */}
          {saveStatus && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              {saveStatus === 'saving' ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Calculating...</>
              ) : (
                <><Check className="w-3 h-3 text-green-500" /> Updated</>
              )}
            </span>
          )}
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('shop')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'shop' ? 'bg-white shadow text-purple-700' : 'text-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" /> Shop
            </button>
            <button
              onClick={() => setViewMode('customer')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'customer' ? 'bg-white shadow text-blue-700' : 'text-gray-600'
              }`}
            >
              <EyeOff className="w-3 h-3" /> Customer
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* LEFT: Inputs (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quote Type + Qty + Hats */}
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
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="us">Us</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.quote_type === 'patch_press' && formData.hats_supplied_by === 'us' && (
                  <div className="w-28">
                    <Label className="text-sm">Hat Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
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
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No customer —</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Material + Patch Size + Yield */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-sm">Material</Label>
                <Select value={formData.patch_material_id} onValueChange={(v) => updateField('patch_material_id', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({formatMoney(m.sheet_cost)}/sheet)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Width (in)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    inputMode="decimal"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.patch_width_input || ''}
                    onChange={(e) => updateField('patch_width_input', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Height (in)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    inputMode="decimal"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.patch_height_input || ''}
                    onChange={(e) => updateField('patch_height_input', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Waste %</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.waste_pct || ''}
                    onChange={(e) => updateField('waste_pct', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Yield Method</Label>
                  <Select value={formData.yield_method} onValueChange={(v) => updateField('yield_method', v)}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.yield_method === 'manual' && (
                <div className="w-40">
                  <Label className="text-xs">Patches/Sheet</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="mt-1 text-right tabular-nums font-mono text-sm"
                    value={formData.manual_yield || ''}
                    onChange={(e) => updateField('manual_yield', parseInt(e.target.value) || null)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced (collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Advanced Settings</CardTitle>
                  <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Gap (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.gap || ''}
                        onChange={(e) => updateField('gap', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Border (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.border || ''}
                        onChange={(e) => updateField('border', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Machine min</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.machine_minutes_per_sheet || ''}
                        onChange={(e) => updateField('machine_minutes_per_sheet', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cleanup min</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.cleanup_minutes_per_sheet || ''}
                        onChange={(e) => updateField('cleanup_minutes_per_sheet', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  {formData.quote_type === 'patch_press' && (
                    <div className="w-32">
                      <Label className="text-xs">Apply min/hat</Label>
                      <Input
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.apply_minutes_per_hat || ''}
                        onChange={(e) => updateField('apply_minutes_per_hat', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Proof min</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.proof_minutes || ''}
                        onChange={(e) => updateField('proof_minutes', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Setup min</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.setup_minutes || ''}
                        onChange={(e) => updateField('setup_minutes', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Packing min</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="mt-1 text-right tabular-nums font-mono text-sm"
                        value={formData.packing_minutes || ''}
                        onChange={(e) => updateField('packing_minutes', parseFloat(e.target.value) || 0)}
                      />
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
              <Input
                className="mt-1"
                value={formData.turnaround_text || ''}
                onChange={(e) => updateField('turnaround_text', e.target.value)}
                placeholder="5–7 business days"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Results (2 cols, sticky) */}
        <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start space-y-4">
          {results ? (
            <>
              {/* Main Pricing Summary */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quote Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Published Price - Big */}
                  <div className="text-center py-2 border-b">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Published Price</div>
                    <div className="text-4xl font-bold text-purple-600 tabular-nums font-mono">
                      {results.display.publishedPerPiece}
                    </div>
                    <div className="text-xs text-gray-500">per {unitLabel}</div>
                  </div>

                  {/* Shop View: Cost + Wholesale + Profit */}
                  {viewMode === 'shop' && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-center py-2 border-b">
                        <div>
                          <div className="text-xs text-gray-500">True Cost</div>
                          <div className="text-lg font-semibold text-red-600 tabular-nums font-mono">
                            {results.display.costPerPiece}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Wholesale</div>
                          <div className="text-lg font-semibold text-orange-600 tabular-nums font-mono">
                            {results.display.wholesalePerPiece}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center py-2 border-b">
                        <div>
                          <div className="text-xs text-gray-500">Profit/Piece</div>
                          <div className={`text-lg font-semibold tabular-nums font-mono ${
                            results.active.profitPerPiece >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {results.display.profitPerPiece}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Actual Margin</div>
                          <div className={`text-lg font-semibold tabular-nums font-mono ${
                            results.active.marginPct >= 20 ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {results.display.marginPct}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Totals */}
                  <div className="space-y-1 pt-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="tabular-nums font-mono">{results.display.subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Setup Fee</span>
                      <span className={`tabular-nums font-mono ${results.active.setupFeeApplied === 0 ? 'text-green-600' : ''}`}>
                        {results.display.setupFee}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total</span>
                      <span className="text-blue-600 tabular-nums font-mono">{results.display.total}</span>
                    </div>
                  </div>

                  {/* Shop View: Yield Info */}
                  {viewMode === 'shop' && (
                    <div className="text-xs text-gray-500 pt-2 border-t space-y-0.5">
                      <div className="flex justify-between">
                        <span>Best Yield:</span>
                        <span className="tabular-nums font-mono">{results.display.bestYield}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sheets:</span>
                        <span className="tabular-nums font-mono">{results.display.sheets}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tier Matrix */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {viewMode === 'shop' ? 'Tier Pricing (Shop View)' : 'Volume Pricing'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {viewMode === 'shop' ? (
                    // SHOP VIEW: Show published + cost + wholesale + profit
                    results.tiers.map(tier => (
                      <div
                        key={tier.key}
                        className={`p-2 rounded border-2 transition ${
                          tier.isActive ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold w-16 ${tier.isActive ? 'text-purple-700' : 'text-gray-700'}`}>
                              {tier.rangeLabel}
                            </span>
                            {tier.isActive && <Badge className="bg-purple-600 text-[10px] px-1 py-0">Active</Badge>}
                            {tier.hasWarning && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold tabular-nums font-mono ${tier.isActive ? 'text-purple-600' : 'text-gray-900'}`}>
                              {formatMoney(tier.publishedPerPiece)}
                            </div>
                            <div className="text-[10px] text-gray-500 tabular-nums font-mono space-x-1">
                              <span className="text-red-600">C:{formatMoney(tier.costPerPiece)}</span>
                              <span className="text-orange-600">W:{formatMoney(tier.wholesalePerPiece)}</span>
                              <span className={tier.profitPerPiece >= 0 ? 'text-green-600' : 'text-red-600'}>
                                P:{formatMoney(tier.profitPerPiece)} ({formatPct(tier.marginPct)})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    // CUSTOMER VIEW: Show customer pricing matrix
                    <>
                      {shopSettings?.customer_markup_pct > 0 ? (
                        // With customer pass-through
                        results.customerView.tiers.map(tier => (
                          <div
                            key={tier.key}
                            className={`p-2 rounded border-2 transition ${
                              tier.isActive ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold w-16 ${tier.isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                                  {tier.rangeLabel}
                                </span>
                                {tier.isActive && <Badge className="bg-blue-600 text-[10px] px-1 py-0">Active</Badge>}
                              </div>
                              <div className="text-right">
                                <div className={`text-lg font-bold tabular-nums font-mono ${tier.isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                                  {formatMoney(tier.customerPricePerPiece)}
                                </div>
                                <div className="text-[10px] text-green-600 tabular-nums font-mono">
                                  Your profit: {formatMoney(tier.customerProfitPerPiece)}/{unitLabel}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        // No customer markup - just show published
                        results.tiers.map(tier => (
                          <div
                            key={tier.key}
                            className={`p-2 rounded border-2 transition ${
                              tier.isActive ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-semibold ${tier.isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                                {tier.rangeLabel}
                              </span>
                              <span className={`text-lg font-bold tabular-nums font-mono ${tier.isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                                {formatMoney(tier.publishedPerPiece)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                  
                  {formData.qty >= (shopSettings?.setup_waive_qty || 24) && (
                    <div className="text-xs text-green-700 bg-green-50 p-2 rounded mt-2">
                      ✓ Setup fee waived for {shopSettings?.setup_waive_qty || 24}+ qty
                    </div>
                  )}
                </CardContent>
              </Card>

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

              {/* Save Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleSave('draft')} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Draft
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
