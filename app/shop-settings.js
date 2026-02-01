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
      window.location.reload() // Refresh to update rates everywhere
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
        ...prev[ladderType],
        [tier]: parseFloat(value) || 0
      }
    }))
  }
  
  // Initialize default pricing ladders if they don't exist
  useEffect(() => {
    if (settings && !settings.default_pricing_mode) {
      setSettings(prev => ({
        ...prev,
        default_pricing_mode: 'profit',
        setup_fee_default: 30,
        setup_waive_qty: 12,
        min_tier_stepdown: 0.05,
        fixed_ladder_patch_press: { "24": 12.00, "48": 11.50, "96": 11.00, "144": 10.50, "384": 10.00, "768": 9.50 },
        fixed_ladder_patch_only: { "24": 8.00, "48": 7.50, "96": 7.00, "144": 6.50, "384": 6.00, "768": 5.50 },
        profit_multipliers_patch_press: { "24": 1.00, "48": 0.92, "96": 0.85, "144": 0.80, "384": 0.72, "768": 0.65 },
        profit_multipliers_patch_only: { "24": 1.00, "48": 0.92, "96": 0.85, "144": 0.80, "384": 0.72, "768": 0.65 },
        default_profit_anchor_patch_press: 3.00,
        default_profit_anchor_patch_only: 2.00
      }))
    }
  }, [settings])

  const calculateShopRate = () => {
    if (!settings) return { shopRate: 0, minuteRate: 0 }
    const workableHoursMonth = settings.workable_hours_per_week * 4.33
    const billableHoursMonth = workableHoursMonth * (settings.billable_efficiency_pct / 100)
    if (billableHoursMonth === 0) return { shopRate: 0, minuteRate: 0 }
    const requiredMonthly = settings.monthly_overhead + settings.monthly_owner_pay_goal + settings.monthly_profit_goal
    const shopRate = requiredMonthly / billableHoursMonth
    const minuteRate = shopRate / 60
    return { shopRate, minuteRate }
  }

  if (loading) return <div>Loading...</div>

  const rates = calculateShopRate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Shop Settings</h2>
          <p className="text-gray-600">Configure your shop floor rates and defaults</p>
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
              <div className="text-4xl font-bold text-purple-600">${rates.shopRate.toFixed(2)}/hr</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Minute Rate</div>
              <div className="text-4xl font-bold text-blue-600">${rates.minuteRate.toFixed(2)}/min</div>
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
                value={settings.monthly_owner_pay_goal}
                onChange={(e) => updateField('monthly_owner_pay_goal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Profit Goal ($)</Label>
              <Input
                type="number"
                value={settings.monthly_profit_goal}
                onChange={(e) => updateField('monthly_profit_goal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Overhead ($)</Label>
              <Input
                type="number"
                value={settings.monthly_overhead}
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
                value={settings.workable_hours_per_week}
                onChange={(e) => updateField('workable_hours_per_week', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Billable Efficiency (%)</Label>
              <Input
                type="number"
                value={settings.billable_efficiency_pct}
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
                value={settings.default_apply_minutes_per_hat}
                onChange={(e) => updateField('default_apply_minutes_per_hat', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Proof Minutes</Label>
              <Input
                type="number"
                value={settings.default_proof_minutes}
                onChange={(e) => updateField('default_proof_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Setup Minutes</Label>
              <Input
                type="number"
                value={settings.default_setup_minutes}
                onChange={(e) => updateField('default_setup_minutes', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Packing Minutes</Label>
              <Input
                type="number"
                value={settings.default_packing_minutes}
                onChange={(e) => updateField('default_packing_minutes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Layout Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Layout & Pricing Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gap (in)</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings.default_gap}
                  onChange={(e) => updateField('default_gap', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Border (in)</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings.default_border}
                  onChange={(e) => updateField('default_border', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Waste %</Label>
                <Input
                  type="number"
                  value={settings.default_waste_pct}
                  onChange={(e) => updateField('default_waste_pct', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Outline Allowance</Label>
                <Input
                  type="number"
                  step="0.0625"
                  value={settings.outline_allowance}
                  onChange={(e) => updateField('outline_allowance', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Margin %</Label>
                <Input
                  type="number"
                  value={settings.default_target_margin_pct}
                  onChange={(e) => updateField('default_target_margin_pct', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rush %</Label>
                <Input
                  type="number"
                  value={settings.default_rush_pct}
                  onChange={(e) => updateField('default_rush_pct', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing System Configuration */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Pricing System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Default Pricing Mode</Label>
              <Select 
                value={settings.default_pricing_mode || 'profit'} 
                onValueChange={(v) => updateField('default_pricing_mode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit">Profit-Based (Recalculates cost at each tier)</SelectItem>
                  <SelectItem value="fixed">Fixed (Set exact prices per tier)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {settings.default_pricing_mode === 'fixed' 
                  ? 'Fixed mode uses pre-set prices you define below.' 
                  : 'Profit mode calculates cost at each tier, then adds profit × multiplier.'}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Setup Fee Default</Label>
                <Input
                  type="number"
                  value={settings.setup_fee_default || 30}
                  onChange={(e) => updateField('setup_fee_default', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Setup Waive at Qty</Label>
                <Input
                  type="number"
                  value={settings.setup_waive_qty || 12}
                  onChange={(e) => updateField('setup_waive_qty', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Tier Step-Down ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.min_tier_stepdown || 0.05}
                  onChange={(e) => updateField('min_tier_stepdown', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Ladders */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Pricing Ladders</CardTitle>
            <p className="text-sm text-gray-600">Configure pricing for each quote type and tier</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="patch-press">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="patch-press">Patch + Press</TabsTrigger>
                <TabsTrigger value="patch-only">Patch Only</TabsTrigger>
              </TabsList>

              {/* Patch + Press Ladders */}
              <TabsContent value="patch-press" className="space-y-6">
                {settings.default_pricing_mode === 'fixed' ? (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Fixed Prices ($/unit)</Label>
                    <div className="grid grid-cols-6 gap-3">
                      {['24', '48', '96', '144', '384', '768'].map(tier => (
                        <div key={tier} className="space-y-2">
                          <Label className="text-sm">{tier}+</Label>
                          <Input
                            type="number"
                            step="0.50"
                            value={settings.fixed_ladder_patch_press?.[tier] || 0}
                            onChange={(e) => updateLadderField('fixed_ladder_patch_press', tier, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">These are the exact $/hat prices shown in quotes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Default Profit Anchor ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={settings.default_profit_anchor_patch_press || 3.00}
                        onChange={(e) => updateField('default_profit_anchor_patch_press', e.target.value)}
                      />
                      <p className="text-xs text-gray-500">Target profit at 24+ tier (users can override per quote)</p>
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-4 block">Profit Multipliers</Label>
                      <div className="grid grid-cols-6 gap-3">
                        {['24', '48', '96', '144', '384', '768'].map(tier => (
                          <div key={tier} className="space-y-2">
                            <Label className="text-sm">{tier}+</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={settings.profit_multipliers_patch_press?.[tier] || 1.00}
                              onChange={(e) => updateLadderField('profit_multipliers_patch_press', tier, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Profit = anchor × multiplier. Lower multipliers give volume discounts.</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Patch Only Ladders */}
              <TabsContent value="patch-only" className="space-y-6">
                {settings.default_pricing_mode === 'fixed' ? (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">Fixed Prices ($/patch)</Label>
                    <div className="grid grid-cols-6 gap-3">
                      {['24', '48', '96', '144', '384', '768'].map(tier => (
                        <div key={tier} className="space-y-2">
                          <Label className="text-sm">{tier}+</Label>
                          <Input
                            type="number"
                            step="0.50"
                            value={settings.fixed_ladder_patch_only?.[tier] || 0}
                            onChange={(e) => updateLadderField('fixed_ladder_patch_only', tier, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">These are the exact $/patch prices shown in quotes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Default Profit Anchor ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={settings.default_profit_anchor_patch_only || 2.00}
                        onChange={(e) => updateField('default_profit_anchor_patch_only', e.target.value)}
                      />
                      <p className="text-xs text-gray-500">Target profit at 24+ tier (users can override per quote)</p>
                    </div>
                    <div>
                      <Label className="text-base font-semibold mb-4 block">Profit Multipliers</Label>
                      <div className="grid grid-cols-6 gap-3">
                        {['24', '48', '96', '144', '384', '768'].map(tier => (
                          <div key={tier} className="space-y-2">
                            <Label className="text-sm">{tier}+</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={settings.profit_multipliers_patch_only?.[tier] || 1.00}
                              onChange={(e) => updateLadderField('profit_multipliers_patch_only', tier, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Profit = anchor × multiplier. Lower multipliers give volume discounts.</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
