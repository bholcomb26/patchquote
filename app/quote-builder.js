'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calculator, Copy, Check, DollarSign, Loader2, Package, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'

// Format money helper
const formatMoney = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$0.00'
  return '$' + (Math.round(value * 100) / 100).toFixed(2)
}

export default function QuoteBuilder() {
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [shopSettings, setShopSettings] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedScript, setCopiedScript] = useState(null)
  const [viewMode, setViewMode] = useState('shop') // 'shop' or 'customer'
  const { toast } = useToast()

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
    turnaround_text: '5–7 business days',
    shipping_charge: 0
  })

  // Load saved quote_type from localStorage on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedQuoteType = localStorage.getItem('default_quote_type')
      if (savedQuoteType) {
        setFormData(prev => ({ ...prev, quote_type: savedQuoteType }))
      }
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [materialsRes, customersRes, settingsRes] = await Promise.all([
        fetch('/api?path=patch-materials'),
        fetch('/api?path=customers'),
        fetch('/api?path=shop-settings')
      ])

      if (materialsRes.ok) {
        const mats = await materialsRes.json()
        setMaterials(mats)
        if (mats.length > 0 && !formData.patch_material_id) {
          updateField('patch_material_id', mats[0].id)
        }
      }

      if (customersRes.ok) {
        const custs = await customersRes.json()
        setCustomers(custs)
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        setShopSettings(settings)
        if (settings) {
          setFormData(prev => ({
            ...prev,
            gap: settings.default_gap || prev.gap,
            border: settings.default_border || prev.border,
            waste_pct: settings.default_waste_pct || prev.waste_pct,
            outline_allowance: settings.outline_allowance || prev.outline_allowance,
            apply_minutes_per_hat: settings.default_apply_minutes_per_hat || prev.apply_minutes_per_hat,
            proof_minutes: settings.default_proof_minutes || prev.proof_minutes,
            setup_minutes: settings.default_setup_minutes || prev.setup_minutes,
            packing_minutes: settings.default_packing_minutes || prev.packing_minutes
          }))
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (field === 'quote_type' && typeof window !== 'undefined') {
      localStorage.setItem('default_quote_type', value)
    }
  }

  async function handleCalculate() {
    if (!formData.patch_material_id) {
      toast({ title: 'Error', description: 'Please select a material', variant: 'destructive' })
      return
    }

    setCalculating(true)
    try {
      const response = await fetch('/api?path=quotes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Calculation failed')

      const data = await response.json()
      setResults(data)
      toast({ title: 'Quote calculated!', description: 'Review results below' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setCalculating(false)
    }
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
      setResults(null)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = async (text, scriptType) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedScript(scriptType)
      toast({ title: 'Copied to clipboard!' })
      setTimeout(() => setCopiedScript(null), 2000)
    } catch (error) {
      toast({ title: 'Failed to copy', variant: 'destructive' })
    }
  }

  const unitsLabel = formData.quote_type === 'patch_only' ? 'patch' : 'hat'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Quote Builder</h2>
          <p className="text-gray-600">Create quotes with tier pricing</p>
        </div>
        {/* View Mode Toggle */}
        <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-2">
          <button
            onClick={() => setViewMode('shop')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'shop' ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            Shop View
          </button>
          <button
            onClick={() => setViewMode('customer')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'customer' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <EyeOff className="w-4 h-4" />
            Customer View
          </button>
        </div>
      </div>

      {/* Quote Type Toggle */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <Label className="text-base font-semibold mb-3 block">Quote Type</Label>
          <Tabs value={formData.quote_type} onValueChange={(v) => updateField('quote_type', v)}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="patch_press">
                <Package className="w-4 h-4 mr-2" />
                Patch + Press
              </TabsTrigger>
              <TabsTrigger value="patch_only">
                <DollarSign className="w-4 h-4 mr-2" />
                Patch Only
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Details */}
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer (optional)</Label>
                  <Select value={formData.customer_id || 'none'} onValueChange={(v) => updateField('customer_id', v === 'none' ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No customer</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity ({formData.quote_type === 'patch_only' ? 'patches' : 'hats'})</Label>
                  <Input
                    type="number"
                    value={formData.qty || ''}
                    onChange={(e) => updateField('qty', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={formData.patch_material_id} onValueChange={(v) => updateField('patch_material_id', v)}>
                  <SelectTrigger>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patch Width (in)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    value={formData.patch_width_input || ''}
                    onChange={(e) => updateField('patch_width_input', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Patch Height (in)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    value={formData.patch_height_input || ''}
                    onChange={(e) => updateField('patch_height_input', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yield Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Yield Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={formData.yield_method} onValueChange={(v) => updateField('yield_method', v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto">Auto-calc</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>
              </Tabs>

              {formData.yield_method === 'manual' && (
                <div className="space-y-2">
                  <Label>Patches per Sheet</Label>
                  <Input
                    type="number"
                    value={formData.manual_yield || ''}
                    onChange={(e) => updateField('manual_yield', parseInt(e.target.value) || null)}
                    placeholder="Enter patches per sheet"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Gap (in)</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.gap || ''}
                    onChange={(e) => updateField('gap', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Border (in)</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.border || ''}
                    onChange={(e) => updateField('border', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waste %</Label>
                  <Input
                    type="number"
                    value={formData.waste_pct || ''}
                    onChange={(e) => updateField('waste_pct', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing & Hats (Shop View Only) */}
          {viewMode === 'shop' && (
            <Card>
              <CardHeader>
                <CardTitle>{formData.quote_type === 'patch_only' ? 'Timing' : 'Timing + Hats'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`grid gap-4 ${formData.quote_type === 'patch_only' ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                  <div className="space-y-2">
                    <Label>Machine min/sheet</Label>
                    <Input
                      type="number"
                      value={formData.machine_minutes_per_sheet || ''}
                      onChange={(e) => updateField('machine_minutes_per_sheet', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cleanup min/sheet</Label>
                    <Input
                      type="number"
                      value={formData.cleanup_minutes_per_sheet || ''}
                      onChange={(e) => updateField('cleanup_minutes_per_sheet', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {formData.quote_type === 'patch_press' && (
                    <div className="space-y-2">
                      <Label>Apply min/hat</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.apply_minutes_per_hat || ''}
                        onChange={(e) => updateField('apply_minutes_per_hat', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>

                {formData.quote_type === 'patch_press' && (
                  <>
                    <div className="space-y-2">
                      <Label>Hats Supplied By</Label>
                      <Tabs value={formData.hats_supplied_by} onValueChange={(v) => updateField('hats_supplied_by', v)}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="customer">Customer</TabsTrigger>
                          <TabsTrigger value="us">Us</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {formData.hats_supplied_by === 'us' && (
                      <div className="space-y-2">
                        <Label>Hat Unit Cost ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.hat_unit_cost || ''}
                          onChange={(e) => updateField('hat_unit_cost', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Proof min</Label>
                    <Input
                      type="number"
                      value={formData.proof_minutes || ''}
                      onChange={(e) => updateField('proof_minutes', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Setup min</Label>
                    <Input
                      type="number"
                      value={formData.setup_minutes || ''}
                      onChange={(e) => updateField('setup_minutes', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Packing min</Label>
                    <Input
                      type="number"
                      value={formData.packing_minutes || ''}
                      onChange={(e) => updateField('packing_minutes', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Turnaround */}
          <Card>
            <CardHeader>
              <CardTitle>Turnaround</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Turnaround Text</Label>
                <Input
                  value={formData.turnaround_text || ''}
                  onChange={(e) => updateField('turnaround_text', e.target.value)}
                  placeholder="5–7 business days"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleCalculate} disabled={calculating} className="w-full" size="lg">
            {calculating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-5 h-5 mr-2" />
                Calculate Quote
              </>
            )}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {results ? (
            <>
              {/* Main Price Summary */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle>Quote Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Published Price - Always Shown */}
                  <div className="text-center pb-4 border-b">
                    <div className="text-sm text-gray-600 mb-1">Published Price</div>
                    <div className="text-4xl font-bold text-purple-600 tabular-nums">
                      {formatMoney(results.publishedPricePerPiece)}/{unitsLabel}
                    </div>
                  </div>

                  {/* Shop View: Show Cost & Wholesale */}
                  {viewMode === 'shop' && (
                    <div className="grid grid-cols-2 gap-4 py-4 border-b">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">True Cost</div>
                        <div className="text-xl font-semibold text-red-600 tabular-nums">
                          {formatMoney(results.trueCostPerPiece)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Wholesale ({results.pricingMethod === 'margin' ? `${results.marginPct}% margin` : `${results.markupPct}% markup`})</div>
                        <div className="text-xl font-semibold text-orange-600 tabular-nums">
                          {formatMoney(results.costBasedWholesalePerPiece)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Shop View: Profit Analysis */}
                  {viewMode === 'shop' && (
                    <div className="grid grid-cols-2 gap-4 py-4 border-b">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Profit/Piece</div>
                        <div className={`text-xl font-semibold tabular-nums ${results.profitPerPiece >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoney(results.profitPerPiece)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Actual Margin</div>
                        <div className={`text-xl font-semibold tabular-nums ${results.marginPctActual >= 20 ? 'text-green-600' : 'text-amber-600'}`}>
                          {results.marginPctActual?.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal ({formData.qty} × {formatMoney(results.publishedPricePerPiece)}):</span>
                      <span className="font-semibold tabular-nums">{formatMoney(results.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Setup Fee:</span>
                      <span className={`font-semibold tabular-nums ${!results.setupFee ? 'text-green-600' : ''}`}>
                        {!results.setupFee ? 'Waived' : formatMoney(results.setupFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-blue-600 tabular-nums">{formatMoney(results.totalPrice)}</span>
                    </div>
                  </div>

                  {/* Shop View: Yield Info */}
                  {viewMode === 'shop' && (
                    <div className="pt-4 border-t space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Best Yield:</span>
                        <span className="font-medium tabular-nums">{results.bestYield} patches/sheet</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Effective Yield:</span>
                        <span className="font-medium tabular-nums">{results.effectiveYield?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sheets Needed:</span>
                        <span className="font-medium tabular-nums">{results.costBreakdown?.sheetsNeeded}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tier Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle>Tier Pricing</CardTitle>
                  <p className="text-sm text-gray-600">
                    {viewMode === 'shop' ? 'Published prices with cost breakdown' : 'Volume discounts available'}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.tierMatrix?.map((tier) => (
                      <div 
                        key={tier.key}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          tier.isActive 
                            ? 'bg-purple-50 border-purple-500 shadow-md' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold min-w-[60px] ${tier.isActive ? 'text-purple-700' : 'text-gray-700'}`}>
                              {tier.label}
                            </span>
                            {tier.isActive && (
                              <Badge className="bg-purple-600 text-white text-xs">Active</Badge>
                            )}
                            {tier.warning && viewMode === 'shop' && (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold tabular-nums ${tier.isActive ? 'text-purple-600' : 'text-gray-900'}`}>
                              {formatMoney(tier.publishedPerPiece)}/{unitsLabel}
                            </div>
                            {/* Shop View: Show cost details */}
                            {viewMode === 'shop' && (
                              <div className="text-xs text-gray-500 space-x-2 tabular-nums">
                                <span className="text-red-600">Cost: {formatMoney(tier.trueCostPerPiece)}</span>
                                <span className="text-orange-600">WS: {formatMoney(tier.wholesalePerPiece)}</span>
                                <span className={tier.profitPerPiece >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  +{formatMoney(tier.profitPerPiece)} ({tier.marginPct?.toFixed(0)}%)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {formData.qty >= (shopSettings?.setup_waive_qty || 24) && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">✓ Setup fee waived for orders of {shopSettings?.setup_waive_qty || 24}+</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Copy Scripts */}
              <Card>
                <CardHeader>
                  <CardTitle>Quote Scripts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: 'sms', label: 'SMS', text: results.quote_sms },
                    { key: 'dm', label: 'DM', text: results.quote_dm },
                    { key: 'phone', label: 'Phone', text: results.quote_phone }
                  ].map(script => (
                    <div key={script.key}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold">{script.label}</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(script.text, script.key)}
                        >
                          {copiedScript === script.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="text-xs bg-gray-50 p-3 rounded border max-h-24 overflow-y-auto break-words">
                        {script.text}
                      </div>
                    </div>
                  ))}

                  {/* Tier Pricing Quick Copy */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Tier Pricing Only</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const tierText = results.tierMatrix
                            ?.map(t => `${t.label} ${formatMoney(t.publishedPerPiece)}`)
                            .join(' | ')
                          copyToClipboard(`Tier pricing: ${tierText}. Reply APPROVED to invoice.`, 'tier')
                        }}
                      >
                        {copiedScript === 'tier' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-xs bg-blue-50 p-3 rounded border">
                      Quick tier pricing for follow-ups
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Actions */}
              <div className="space-y-2">
                <Button onClick={() => handleSave('draft')} disabled={saving} className="w-full" variant="outline">
                  Save as Draft
                </Button>
                <Button onClick={() => handleSave('sent')} disabled={saving} className="w-full">
                  Mark as Sent
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Fill in the form and click Calculate to see results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
