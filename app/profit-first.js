'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'

export default function ProfitFirst() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const response = await fetch('/api?path=profit-first-settings')
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
    const total = settings.profit_pct + settings.tax_pct + settings.owner_pay_pct + settings.ops_pct + settings.buffer_pct
    if (total !== 100) {
      toast({ title: 'Error', description: 'Percentages must sum to 100%', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api?path=profit-first-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) throw new Error('Save failed')

      toast({ title: 'Settings saved successfully!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: parseFloat(value) || 0 }))
  }

  if (loading) return <div>Loading...</div>
  if (!settings) return <div>No settings found</div>

  const total = settings.profit_pct + settings.tax_pct + settings.owner_pay_pct + settings.ops_pct + settings.buffer_pct

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Profit First Settings</h2>
          <p className="text-gray-600">Configure bucket allocation percentages</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Card className={total !== 100 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm text-gray-600">Total Allocation</div>
            <div className={`text-4xl font-bold ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
              {total}%
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {total === 100 ? '✓ Perfect allocation!' : `⚠️ Must equal 100% (currently ${total > 100 ? 'over' : 'under'} by ${Math.abs(100 - total)}%)`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profit %</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={settings.profit_pct}
              onChange={(e) => updateField('profit_pct', e.target.value)}
            />
            <p className="text-sm text-gray-600 mt-2">Money set aside for true profit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax %</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={settings.tax_pct}
              onChange={(e) => updateField('tax_pct', e.target.value)}
            />
            <p className="text-sm text-gray-600 mt-2">Set aside for taxes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Pay %</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={settings.owner_pay_pct}
              onChange={(e) => updateField('owner_pay_pct', e.target.value)}
            />
            <p className="text-sm text-gray-600 mt-2">Your compensation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ops %</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={settings.ops_pct}
              onChange={(e) => updateField('ops_pct', e.target.value)}
            />
            <p className="text-sm text-gray-600 mt-2">Operating expenses</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Buffer %</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={settings.buffer_pct}
              onChange={(e) => updateField('buffer_pct', e.target.value)}
            />
            <p className="text-sm text-gray-600 mt-2">Emergency buffer</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
