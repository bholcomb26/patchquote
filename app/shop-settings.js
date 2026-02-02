'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Tier ranges matching calculations.js
const TIER_KEYS = ['1-23', '24-47', '48-95', '96-143', '144-287', '288-575', '576+']

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
        setSettings(data)
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

      if (!response.ok) throw new Error('Save failed')

      toast({ title: 'Settings saved successfully!' })
      window.location.reload()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: parseFloat(value) || value }))
  }
  
  const updateLadderField = (ladderType, tier, value) => {
    setSettings(prev => ({
      ...prev,
      [ladderType]: {
        ...(prev[ladderType] || {}),
        [tier]: parseFloat(value) || 0
      }
    }))
  }
  
  // Initialize default settings if they don't exist
  useEffect(() => {
    if (settings && !settings.published_ladder_patch_press) {
      setSettings(prev => ({
        ...prev,
        // Cost-based pricing defaults
        default_pricing_method: prev.default_pricing_method || 'markup',
        default_markup_pct: prev.default_markup_pct || 50,
        default_margin_pct: prev.default_margin_pct || 40,
        setup_fee_default: prev.setup_fee_default || 30,
        setup_waive_qty: prev.setup_waive_qty || 24,
        // Published ladders - Patch + Press
        published_ladder_patch_press: {
          '1-23': 15.00,
          '24-47': 12.00,
          '48-95': 11.00,
          '96-143': 10.00,
          '144-287': 9.50,
          '288-575': 9.00,
          '576+': 8.50
        },
        // Published ladders - Patch Only
        published_ladder_patch_only: {
          '1-23': 10.00,
          '24-47': 8.00,
          '48-95': 7.00,
          '96-143': 6.50,
          '144-287': 6.00,
          '288-575': 5.50,
          '576+': 5.00
        }
      }))
    }
  }, [settings])

  const calculateShopRate = () => {
    if (!settings) return { shopRate: 0, minuteRate: 0 }
    const workableHoursMonth = (settings.workable_hours_per_week || 40) * 4.33
    const billableHoursMonth = workableHoursMonth * ((settings.billable_efficiency_pct || 75) / 100)
    if (billableHoursMonth === 0) return { shopRate: 0, minuteRate: 0 }
    const requiredMonthly = (settings.monthly_overhead || 0) + (settings.monthly_owner_pay_goal || 0) + (settings.monthly_profit_goal || 0)
    const shopRate = requiredMonthly / billableHoursMonth
    const minuteRate = shopRate / 60
    return { shopRate, minuteRate }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  const rates = calculateShopRate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Shop Settings</h2>
          <p className="text-gray-600">Configure shop rates, pricing defaults, and published price ladders</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Computed Rates */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle>Current Shop Floor Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-600">Shop Rate</div>
              <div className="text-4xl font-bold text-purple-600 tabular-nums">${rates.shopRate.toFixed(2)}/hr</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Minute Rate</div>
              <div className="text-4xl font-bold text-blue-600 tabular-nums">${rates.minuteRate.toFixed(2)}/min</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Targets */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Owner Pay Goal ($)</Label>
              <Input
                type="number"
                value={settings?.monthly_owner_pay_goal || ''}
                onChange={(e) => updateField('monthly_owner_pay_goal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Profit Goal ($)</Label>
              <Input
                type="number"
                value={settings?.monthly_profit_goal || ''}
                onChange={(e) => updateField('monthly_profit_goal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Overhead ($)</Label>
              <Input
                type="number"
                value={settings?.monthly_overhead || ''}
                onChange={(e) => updateField('monthly_overhead', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Workable Hours per Week</Label>
              <Input
                type="number"
                value={settings?.workable_hours_per_week || ''}
                onChange={(e) => updateField('workable_hours_per_week', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Billable Efficiency (%)</Label>
              <Input
                type="number"
                value={settings?.billable_efficiency_pct || ''}
                onChange={(e) => updateField('billable_efficiency_pct', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Time Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Apply Minutes per Hat</Label>
              <Input
                type="number"
                step="0.5"
                value={settings?.default_apply_minutes_per_hat || ''}
                onChange={(e) => updateField('default_apply_minutes_per_hat', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Proof Minutes</Label>
              <Input
                type="number"
                value={settings?.default_proof_minutes || ''}
                onChange={(e) => updateField('default_proof_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Setup Minutes</Label>
              <Input
                type="number"
                value={settings?.default_setup_minutes || ''}
                onChange={(e) => updateField('default_setup_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Packing Minutes</Label>
              <Input
                type="number"
                value={settings?.default_packing_minutes || ''}
                onChange={(e) => updateField('default_packing_minutes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Layout Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Layout & Yield Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gap (in)</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings?.default_gap || ''}
                  onChange={(e) => updateField('default_gap', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Border (in)</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings?.default_border || ''}
                  onChange={(e) => updateField('default_border', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Waste %</Label>
                <Input
                  type="number"
                  value={settings?.default_waste_pct || ''}
                  onChange={(e) => updateField('default_waste_pct', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Outline Allowance</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings?.outline_allowance || ''}
                  onChange={(e) => updateField('outline_allowance', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost-Based Pricing Defaults */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cost-Based Pricing Defaults</CardTitle>
            <p className="text-sm text-gray-600">These settings control the "Wholesale" price shown in Shop View (cost + markup/margin)</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Pricing Method</Label>
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
              <div className="space-y-2">
                <Label>{settings?.default_pricing_method === 'margin' ? 'Default Margin %' : 'Default Markup %'}</Label>
                <Input
                  type="number"
                  value={settings?.default_pricing_method === 'margin' 
                    ? (settings?.default_margin_pct || 40)
                    : (settings?.default_markup_pct || 50)}
                  onChange={(e) => updateField(
                    settings?.default_pricing_method === 'margin' ? 'default_margin_pct' : 'default_markup_pct',
                    e.target.value
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Setup Fee Default ($)</Label>
                <Input
                  type="number"
                  value={settings?.setup_fee_default || 30}
                  onChange={(e) => updateField('setup_fee_default', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Setup Waive at Qty</Label>
                <Input
                  type="number"
                  value={settings?.setup_waive_qty || 24}
                  onChange={(e) => updateField('setup_waive_qty', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {settings?.default_pricing_method === 'margin'
                ? 'Margin: Wholesale = Cost ÷ (1 - Margin%)'
                : 'Markup: Wholesale = Cost × (1 + Markup%)'}
            </p>
          </CardContent>
        </Card>

        {/* Published Price Ladders */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Published Price Ladders (Customer-Facing)</CardTitle>
            <p className="text-sm text-gray-600">These are the fixed prices shown to customers and used in quote scripts</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="patch-press">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="patch-press">Patch + Press</TabsTrigger>
                <TabsTrigger value="patch-only">Patch Only</TabsTrigger>
              </TabsList>

              {/* Patch + Press Ladder */}
              <TabsContent value="patch-press" className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {TIER_KEYS.map(tier => (
                    <div key={tier} className="space-y-1">
                      <Label className="text-xs font-semibold text-center block">{tier}</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <Input
                          type="number"
                          step="0.25"
                          className="pl-5 text-center tabular-nums"
                          value={settings?.published_ladder_patch_press?.[tier] || ''}
                          onChange={(e) => updateLadderField('published_ladder_patch_press', tier, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Price per hat (patch + application)</p>
              </TabsContent>

              {/* Patch Only Ladder */}
              <TabsContent value="patch-only" className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {TIER_KEYS.map(tier => (
                    <div key={tier} className="space-y-1">
                      <Label className="text-xs font-semibold text-center block">{tier}</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <Input
                          type="number"
                          step="0.25"
                          className="pl-5 text-center tabular-nums"
                          value={settings?.published_ladder_patch_only?.[tier] || ''}
                          onChange={(e) => updateLadderField('published_ladder_patch_only', tier, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Price per patch (no application)</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
