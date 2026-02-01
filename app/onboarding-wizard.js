'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    monthly_owner_pay_goal: 2400,
    monthly_profit_goal: 1000,
    monthly_overhead: 750,
    workable_hours_per_week: 30,
    billable_efficiency_pct: 70,
    default_apply_minutes_per_hat: 2.0,
    default_border: 0.25,
    default_gap: 0.0625,
    default_waste_pct: 5,
    outline_allowance: 0.125,
    default_target_margin_pct: 40,
    default_rush_pct: 15,
    default_proof_minutes: 5,
    default_setup_minutes: 5,
    default_packing_minutes: 5,
    tax_reserve_pct: 10
  })

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }))
  }

  const calculateShopRate = () => {
    const workableHoursMonth = formData.workable_hours_per_week * 4.33
    const billableHoursMonth = workableHoursMonth * (formData.billable_efficiency_pct / 100)
    if (billableHoursMonth === 0) return { shopRate: 0, minuteRate: 0 }
    const requiredMonthly = formData.monthly_overhead + formData.monthly_owner_pay_goal + formData.monthly_profit_goal
    const shopRate = requiredMonthly / billableHoursMonth
    const minuteRate = shopRate / 60
    return { shopRate: shopRate.toFixed(2), minuteRate: minuteRate.toFixed(2) }
  }

  async function handleComplete() {
    setLoading(true)
    try {
      const response = await fetch('/api?path=onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopSettings: formData,
          profitFirstSettings: {
            profit_pct: 5,
            tax_pct: 10,
            owner_pay_pct: 35,
            ops_pct: 45,
            buffer_pct: 5
          }
        })
      })

      if (!response.ok) throw new Error('Setup failed')

      toast({
        title: 'Setup complete!',
        description: 'Your shop is ready to start quoting'
      })

      onComplete()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 6) * 100
  const rates = calculateShopRate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl">Onboarding Wizard</CardTitle>
            <span className="text-sm text-gray-500">Step {step} of 6</span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardDescription className="mt-4">
            6 quick steps. Set your shop floor once — then quote confidently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Monthly Targets */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 1: Monthly Targets</h3>
              <div className="space-y-2">
                <Label>Owner Pay Goal (monthly)</Label>
                <Input
                  type="number"
                  value={formData.monthly_owner_pay_goal}
                  onChange={(e) => updateField('monthly_owner_pay_goal', e.target.value)}
                  placeholder="2400"
                />
              </div>
              <div className="space-y-2">
                <Label>Profit Goal (monthly)</Label>
                <Input
                  type="number"
                  value={formData.monthly_profit_goal}
                  onChange={(e) => updateField('monthly_profit_goal', e.target.value)}
                  placeholder="1000"
                />
              </div>
            </div>
          )}

          {/* Step 2: Overhead */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 2: Overhead</h3>
              <div className="space-y-2">
                <Label>Monthly Overhead ($)</Label>
                <Input
                  type="number"
                  value={formData.monthly_overhead}
                  onChange={(e) => updateField('monthly_overhead', e.target.value)}
                  placeholder="750"
                />
                <p className="text-sm text-gray-500">Rent, utilities, insurance, etc.</p>
              </div>
            </div>
          )}

          {/* Step 3: Capacity */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 3: Capacity</h3>
              <div className="space-y-2">
                <Label>Workable Hours per Week</Label>
                <Input
                  type="number"
                  value={formData.workable_hours_per_week}
                  onChange={(e) => updateField('workable_hours_per_week', e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label>Billable Efficiency (%)</Label>
                <Input
                  type="number"
                  value={formData.billable_efficiency_pct}
                  onChange={(e) => updateField('billable_efficiency_pct', e.target.value)}
                  placeholder="70"
                />
                <p className="text-sm text-gray-500">Typical: 70% (accounts for admin time)</p>
              </div>
            </div>
          )}

          {/* Step 4: Apply Time */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 4: Apply Time</h3>
              <div className="space-y-2">
                <Label>Minutes to Apply Each Patch</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.default_apply_minutes_per_hat}
                  onChange={(e) => updateField('default_apply_minutes_per_hat', e.target.value)}
                  placeholder="2.0"
                />
                <p className="text-sm text-gray-500">Average time to apply one patch to one hat</p>
              </div>
            </div>
          )}

          {/* Step 5: Layout Defaults */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 5: Layout Defaults</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Border (inches)</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.default_border}
                    onChange={(e) => updateField('default_border', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gap (inches)</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.default_gap}
                    onChange={(e) => updateField('default_gap', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waste %</Label>
                  <Input
                    type="number"
                    value={formData.default_waste_pct}
                    onChange={(e) => updateField('default_waste_pct', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outline Allowance</Label>
                  <Input
                    type="number"
                    step="0.0625"
                    value={formData.outline_allowance}
                    onChange={(e) => updateField('outline_allowance', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Ready */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in-50 duration-500">
              <h3 className="text-lg font-semibold">Step 6: Ready!</h3>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                <h4 className="font-semibold mb-4 text-lg">Your Shop Floor Rate:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Shop Rate ($/hr)</p>
                    <p className="text-3xl font-bold text-purple-600">${rates.shopRate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Minute Rate ($/min)</p>
                    <p className="text-3xl font-bold text-blue-600">${rates.minuteRate}</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">What you'll get:</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Shop Rate ($/hr) and Shop Minute Rate ($/min)</li>
                  <li>• Patch yield auto-calc or manual yield override</li>
                  <li>• Quote + tier table + copy/paste scripts</li>
                  <li>• Profit-first bucket allocations</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {step < 6 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading}>
                {loading ? 'Setting up...' : (
                  <>
                    Complete Setup
                    <Check className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
