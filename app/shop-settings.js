'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save, Loader2, Info } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TIER_KEYS, formatMoney } from '@/lib/pricingEngine'

export default function ShopSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const response = await fetch('/api?path=shop-settings')
      if (response.ok) {
        const data = await response.json()
        // Initialize with defaults if needed
        setSettings({
          // Capacity
          workable_hours_per_week: 40,
          billable_efficiency_pct: 75,
          // Monthly targets
          monthly_overhead: 3000,
          monthly_owner_pay_goal: 5000,
          monthly_profit_goal: 2000,
          // Time defaults
          default_apply_minutes_per_hat: 2,
          default_proof_minutes: 5,
          default_setup_minutes: 5,
          default_packing_minutes: 5,
          // Layout defaults
          default_gap: 0.0625,
          default_border: 0.25,
          default_waste_pct: 5,
          outline_allowance: 0.125,
          // Cost-based pricing
          default_pricing_method: 'markup',
          default_markup_pct: 50,
          default_margin_pct: 40,
          setup_fee_default: 30,
          setup_waive_qty: 24,
          // Customer pass-through
          customer_markup_pct: 0,
          customer_price_baseline: 'published',
          // Published ladders
          published_ladder_patch_press: {
            '1-23': 15.00, '24-47': 12.00, '48-95': 11.00,
            '96-143': 10.00, '144-287': 9.50, '288-575': 9.00, '576+': 8.50
          },
          published_ladder_patch_only: {
            '1-23': 10.00, '24-47': 8.00, '48-95': 7.00,
            '96-143': 6.50, '144-287': 6.00, '288-575': 5.50, '576+': 5.00
          },
          ...data
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch('/api?path=shop-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Save failed')
      }

      toast({ title: 'Settings saved!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const updateNumericField = (field, value) => {
    const num = parseFloat(value)
    setSettings(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }))
  }
  
  const updateLadderField = (ladderType, tier, value) => {
    const num = parseFloat(value)
    setSettings(prev => ({
      ...prev,
      [ladderType]: {
        ...(prev?.[ladderType] || {}),
        [tier]: isNaN(num) ? 0 : num
      }
    }))
  }

  const calculateShopRate = () => {
    if (!settings) return { shopRate: 0, minuteRate: 0 }
    const workableHoursMonth = (settings.workable_hours_per_week || 40) * 4.33
    const billableHoursMonth = workableHoursMonth * ((settings.billable_efficiency_pct || 75) / 100)
    if (billableHoursMonth === 0) return { shopRate: 0, minuteRate: 0 }
    const requiredMonthly = (settings.monthly_overhead || 0) + (settings.monthly_owner_pay_goal || 0) + (settings.monthly_profit_goal || 0)
    const shopRate = requiredMonthly / billableHoursMonth
    return { shopRate, minuteRate: shopRate / 60 }
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>

  const rates = calculateShopRate()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Shop Settings</h2>
          <p className="text-gray-600">Configure rates, pricing, and published ladders</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Shop Rate Display */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Current Shop Floor Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-600">Shop Rate</div>
              <div className="text-3xl font-bold text-purple-600 tabular-nums font-mono">
                {formatMoney(rates.shopRate)}/hr
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Minute Rate</div>
              <div className="text-3xl font-bold text-blue-600 tabular-nums font-mono">
                {formatMoney(rates.minuteRate)}/min
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Targets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Owner Pay Goal ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.monthly_owner_pay_goal ?? ''}
                onChange={(e) => updateNumericField('monthly_owner_pay_goal', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Profit Goal ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.monthly_profit_goal ?? ''}
                onChange={(e) => updateNumericField('monthly_profit_goal', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Monthly Overhead ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.monthly_overhead ?? ''}
                onChange={(e) => updateNumericField('monthly_overhead', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Workable Hours/Week</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.workable_hours_per_week ?? ''}
                onChange={(e) => updateNumericField('workable_hours_per_week', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Billable Efficiency (%)</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.billable_efficiency_pct ?? ''}
                onChange={(e) => updateNumericField('billable_efficiency_pct', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Defaults */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Time Defaults (minutes)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Apply/Hat</Label>
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_apply_minutes_per_hat ?? ''}
                onChange={(e) => updateNumericField('default_apply_minutes_per_hat', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proof</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_proof_minutes ?? ''}
                onChange={(e) => updateNumericField('default_proof_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Setup</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_setup_minutes ?? ''}
                onChange={(e) => updateNumericField('default_setup_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Packing</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_packing_minutes ?? ''}
                onChange={(e) => updateNumericField('default_packing_minutes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Layout Defaults */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Layout Defaults (inches)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Gap</Label>
              <Input
                type="number"
                step="0.0625"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_gap ?? ''}
                onChange={(e) => updateNumericField('default_gap', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Border</Label>
              <Input
                type="number"
                step="0.0625"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_border ?? ''}
                onChange={(e) => updateNumericField('default_border', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Waste %</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_waste_pct ?? ''}
                onChange={(e) => updateNumericField('default_waste_pct', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outline Allow.</Label>
              <Input
                type="number"
                step="0.0625"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.outline_allowance ?? ''}
                onChange={(e) => updateNumericField('outline_allowance', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost-Based Pricing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost-Based Pricing (Wholesale)</CardTitle>
          <CardDescription>Controls the "Wholesale" price in Shop View: Cost + Markup/Margin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Method</Label>
              <Select 
                value={settings?.default_pricing_method || 'markup'} 
                onValueChange={(v) => updateField('default_pricing_method', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="markup">Markup %</SelectItem>
                  <SelectItem value="margin">Margin %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">
                {settings?.default_pricing_method === 'margin' ? 'Margin %' : 'Markup %'}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.default_pricing_method === 'margin' 
                  ? (settings?.default_margin_pct ?? 40)
                  : (settings?.default_markup_pct ?? 50)}
                onChange={(e) => updateNumericField(
                  settings?.default_pricing_method === 'margin' ? 'default_margin_pct' : 'default_markup_pct',
                  e.target.value
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Setup Fee ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.setup_fee_default ?? 30}
                onChange={(e) => updateNumericField('setup_fee_default', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Waive at Qty</Label>
              <Input
                type="number"
                inputMode="numeric"
                className="text-right tabular-nums font-mono"
                value={settings?.setup_waive_qty ?? 24}
                onChange={(e) => updateNumericField('setup_waive_qty', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Pass-Through */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Customer Pass-Through Markup
            <Info className="w-4 h-4 text-gray-400" />
          </CardTitle>
          <CardDescription>
            For distributors: adds markup on top of your baseline to show customer pricing matrix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Baseline for Customer Price</Label>
              <Select 
                value={settings?.customer_price_baseline || 'published'} 
                onValueChange={(v) => updateField('customer_price_baseline', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published Price</SelectItem>
                  <SelectItem value="wholesale">Wholesale Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Customer Markup %</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="text-right tabular-nums font-mono"
                value={settings?.customer_markup_pct ?? 0}
                onChange={(e) => updateNumericField('customer_markup_pct', e.target.value)}
              />
            </div>
            <div className="flex items-end pb-1">
              <p className="text-xs text-gray-500">
                Customer Price = {settings?.customer_price_baseline === 'wholesale' ? 'Wholesale' : 'Published'} × (1 + {settings?.customer_markup_pct || 0}%)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Published Price Ladders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Published Price Ladders (Customer-Facing)</CardTitle>
          <CardDescription>Fixed tier prices shown to customers in quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="patch-press">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="patch-press">Patch + Press ($/hat)</TabsTrigger>
              <TabsTrigger value="patch-only">Patch Only ($/patch)</TabsTrigger>
            </TabsList>

            <TabsContent value="patch-press">
              <div className="grid grid-cols-7 gap-2">
                {TIER_KEYS.map(tier => (
                  <div key={tier} className="space-y-1">
                    <Label className="text-xs font-semibold text-center block">{tier}</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <Input
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        className="pl-6 text-right tabular-nums font-mono text-sm"
                        value={settings?.published_ladder_patch_press?.[tier] ?? ''}
                        onChange={(e) => updateLadderField('published_ladder_patch_press', tier, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="patch-only">
              <div className="grid grid-cols-7 gap-2">
                {TIER_KEYS.map(tier => (
                  <div key={tier} className="space-y-1">
                    <Label className="text-xs font-semibold text-center block">{tier}</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <Input
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        className="pl-6 text-right tabular-nums font-mono text-sm"
                        value={settings?.published_ladder_patch_only?.[tier] ?? ''}
                        onChange={(e) => updateLadderField('published_ladder_patch_only', tier, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
