'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calculator, Copy, Check, DollarSign, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function QuoteBuilder() {
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [shopSettings, setShopSettings] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedScript, setCopiedScript] = useState(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    quote_type: localStorage.getItem('default_quote_type') || 'patch_press',
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
    target_margin_pct: 40,
    rush_pct: 15,
    turnaround_text: '5–7 business days',
    shipping_charge: 0,
    tier_quantities: [24, 48, 96, 144, 384, 768]
  })

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
        // Pre-fill with defaults
        if (settings) {
          setFormData(prev => ({
            ...prev,
            gap: settings.default_gap,
            border: settings.default_border,
            waste_pct: settings.default_waste_pct,
            outline_allowance: settings.outline_allowance,
            apply_minutes_per_hat: settings.default_apply_minutes_per_hat,
            proof_minutes: settings.default_proof_minutes,
            setup_minutes: settings.default_setup_minutes,
            packing_minutes: settings.default_packing_minutes,
            target_margin_pct: settings.default_target_margin_pct,
            rush_pct: settings.default_rush_pct
          }))
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Save quote type preference to localStorage
    if (field === 'quote_type') {
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
      
      // Reset form
      setFormData({
        ...formData,
        customer_id: null,
        qty: 144,
        patch_width_input: 3.25,
        patch_height_input: 2.25
      })
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

  const selectedMaterial = materials.find(m => m.id === formData.patch_material_id)
  const unitsLabel = formData.quote_type === 'patch_only' ? 'patch' : 'hat'
  
  // Calculate active tier and upsell
  const getActiveTier = () => {
    if (!results?.tier_prices_json) return null
    
    const tierKeys = Object.keys(results.tier_prices_json)
      .map(Number)
      .sort((a, b) => a - b)
    
    let activeTier = tierKeys[0]
    let nextTier = null
    
    for (let i = 0; i < tierKeys.length; i++) {
      if (formData.qty >= tierKeys[i]) {
        activeTier = tierKeys[i]
        nextTier = tierKeys[i + 1] || null
      }
    }
    
    let upsellMessage = null
    if (nextTier && formData.qty < nextTier) {
      const qtyNeeded = nextTier - formData.qty
      const currentPrice = results.tier_prices_json[activeTier].unit
      const nextPrice = results.tier_prices_json[nextTier].unit
      const savings = (currentPrice - nextPrice).toFixed(2)
      
      upsellMessage = `Add ${qtyNeeded} more to reach next tier and save $${savings} per ${unitsLabel}!`
    }
    
    return { activeTier, nextTier, upsellMessage }
  }
  
  const tierInfo = results ? getActiveTier() : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Quote Builder</h2>
        <p className="text-gray-600">Create patch hat quotes with auto-calculated yields and tier pricing</p>
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
          <p className="text-sm text-gray-600 mt-2">
            {formData.quote_type === 'patch_only' 
              ? 'Quote patches only (no hat application)' 
              : 'Quote patches with application to hats'}
          </p>
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
                    value={formData.qty}
                    onChange={(e) => updateField('qty', parseInt(e.target.value))}
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
                        {m.name} (${m.sheet_cost}/sheet)
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
                    value={formData.patch_width_input}
                    onChange={(e) => updateField('patch_width_input', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Patch Height (in)</Label>
                  <Input
                    type="number"
                    step="0.125"
                    value={formData.patch_height_input}
                    onChange={(e) => updateField('patch_height_input', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Patch Size Mode</Label>
                <Tabs value={formData.patch_size_mode} onValueChange={(v) => updateField('patch_size_mode', v)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overall">Overall (default)</TabsTrigger>
                    <TabsTrigger value="art">Art + {formData.outline_allowance}"</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* Yield Method */}
          <Card>
            <CardHeader>
              <CardTitle>Yield Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={formData.yield_method} onValueChange={(v) => updateField('yield_method', v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto">Auto-calc</TabsTrigger>
                  <TabsTrigger value="manual">Manual yield</TabsTrigger>
                </TabsList>
              </Tabs>

              {formData.yield_method === 'manual' && (
                <div className="space-y-2">
                  <Label>Manual Patches/Sheet</Label>
                  <Input
                    type="number"
                    value={formData.manual_yield || ''}
                    onChange={(e) => updateField('manual_yield', parseInt(e.target.value))}
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
                    value={formData.gap}
                    onChange={(e) => updateField('gap', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Border (in)</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.border}
                    onChange={(e) => updateField('border', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waste %</Label>
                  <Input
                    type="number"
                    value={formData.waste_pct}
                    onChange={(e) => updateField('waste_pct', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing & Hats */}
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
                    value={formData.machine_minutes_per_sheet}
                    onChange={(e) => updateField('machine_minutes_per_sheet', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cleanup min/sheet</Label>
                  <Input
                    type="number"
                    value={formData.cleanup_minutes_per_sheet}
                    onChange={(e) => updateField('cleanup_minutes_per_sheet', parseFloat(e.target.value))}
                  />
                </div>
                {formData.quote_type === 'patch_press' && (
                  <div className="space-y-2">
                    <Label>Apply min/hat</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.apply_minutes_per_hat}
                      onChange={(e) => updateField('apply_minutes_per_hat', parseFloat(e.target.value))}
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
                        value={formData.hat_unit_cost}
                        onChange={(e) => updateField('hat_unit_cost', parseFloat(e.target.value))}
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
                    value={formData.proof_minutes}
                    onChange={(e) => updateField('proof_minutes', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setup min</Label>
                  <Input
                    type="number"
                    value={formData.setup_minutes}
                    onChange={(e) => updateField('setup_minutes', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Packing min</Label>
                  <Input
                    type="number"
                    value={formData.packing_minutes}
                    onChange={(e) => updateField('packing_minutes', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Target Margin %</Label>
                  <Input
                    type="number"
                    value={formData.target_margin_pct}
                    onChange={(e) => updateField('target_margin_pct', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rush %</Label>
                  <Input
                    type="number"
                    value={formData.rush_pct}
                    onChange={(e) => updateField('rush_pct', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Charge</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.shipping_charge}
                    onChange={(e) => updateField('shipping_charge', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Turnaround Text</Label>
                <Input
                  value={formData.turnaround_text}
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
              {/* Summary */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle>Quote Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600">Unit Price</div>
                    <div className="text-3xl font-bold text-purple-600">${results.unit_price}/{unitsLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Price</div>
                    <div className="text-3xl font-bold text-blue-600">${results.total_price}</div>
                  </div>
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Best Yield:</span>
                      <span className="font-semibold">{results.best_yield} patches/sheet</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Effective Yield:</span>
                      <span className="font-semibold">{results.effective_yield.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">True Cost/{unitsLabel.charAt(0).toUpperCase() + unitsLabel.slice(1)}:</span>
                      <span className="font-semibold">${results.true_cost_per_hat.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Upsell Message */}
                  {tierInfo?.upsellMessage && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">💡 {tierInfo.upsellMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tier Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle>Tier Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(results.tier_prices_json || {}).map(([qty, prices]) => {
                      const isActive = tierInfo?.activeTier === Number(qty)
                      return (
                        <div 
                          key={qty} 
                          className={`flex justify-between items-center p-3 rounded-lg transition-all ${
                            isActive 
                              ? 'bg-purple-100 border-2 border-purple-400 shadow-md' 
                              : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{qty}+</span>
                            {isActive && (
                              <Badge className="bg-purple-600 text-white text-xs">Active</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold">${prices.unit}/{unitsLabel}</div>
                            <div className="text-sm text-gray-600">${prices.total} total</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Copy Scripts */}
              <Card>
                <CardHeader>
                  <CardTitle>Copy Scripts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">SMS</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(results.quote_sms, 'sms')}
                      >
                        {copiedScript === 'sms' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-xs bg-gray-50 p-3 rounded border max-h-24 overflow-y-auto">
                      {results.quote_sms}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">DM</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(results.quote_dm, 'dm')}
                      >
                        {copiedScript === 'dm' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-xs bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                      {results.quote_dm}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Phone</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(results.quote_phone, 'phone')}
                      >
                        {copiedScript === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-xs bg-gray-50 p-3 rounded border max-h-24 overflow-y-auto">
                      {results.quote_phone}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Tier Pricing Only</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const tierKeys = Object.keys(results.tier_prices_json).sort((a, b) => Number(a) - Number(b))
                          const tierParts = tierKeys.map(qty => `${qty}+ $${results.tier_prices_json[qty].unit}/${unitsLabel}`)
                          const tierText = `Tier pricing: ${tierParts.join(' | ')}. Reply APPROVED to invoice.`
                          copyToClipboard(tierText, 'tier')
                        }}
                      >
                        {copiedScript === 'tier' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-xs bg-blue-50 p-3 rounded border">
                      Quick tier pricing copy for follow-ups
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
