'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calculator, Copy, Check, Package } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function FinishedHatPricing() {
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [calculating, setCalculating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedScript, setCopiedScript] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    customer_id: null,
    hat_name: '',
    buy_qty: 48,
    hat_unit_cost: 0,
    shipping_per_hat: 0,
    patch_cost_per_hat: 0,
    apply_minutes_per_hat: 2.0,
    proof_minutes: 5,
    setup_minutes: 5,
    packing_minutes: 5,
    pricing_method: 'margin',
    target_margin_pct: 40,
    markup_multiplier: 2.0,
    tier_quantities: [12, 24, 48, 96, 144, 288, 384, 768]
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [quotesRes, customersRes] = await Promise.all([
        fetch('/api?path=finished-hat-quotes'),
        fetch('/api?path=customers')
      ])

      if (quotesRes.ok) {
        const data = await quotesRes.json()
        setQuotes(data)
      }

      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleCalculate() {
    setCalculating(true)
    try {
      const response = await fetch('/api?path=finished-hat-quotes/calculate', {
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
    try {
      const response = await fetch('/api?path=finished-hat-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, status })
      })

      if (!response.ok) throw new Error('Save failed')

      toast({ title: 'Quote saved!', description: `Status: ${status}` })
      setShowForm(false)
      setResults(null)
      loadData()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedScript(true)
      toast({ title: 'Copied to clipboard!' })
      setTimeout(() => setCopiedScript(false), 2000)
    } catch (error) {
      toast({ title: 'Failed to copy', variant: 'destructive' })
    }
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">New Finished Hat Quote</h2>
            <p className="text-gray-600">Calculate pricing for finished hats with patches applied</p>
          </div>
          <Button variant="outline" onClick={() => { setShowForm(false); setResults(null) }}>
            Back to List
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <div className="lg:col-span-2 space-y-6">
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
                    <Label>Hat Name</Label>
                    <Input
                      value={formData.hat_name}
                      onChange={(e) => updateField('hat_name', e.target.value)}
                      placeholder="Richardson 112"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Buy Quantity</Label>
                  <Input
                    type="number"
                    value={formData.buy_qty}
                    onChange={(e) => updateField('buy_qty', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hat Unit Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.hat_unit_cost}
                      onChange={(e) => updateField('hat_unit_cost', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping per Hat ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.shipping_per_hat}
                      onChange={(e) => updateField('shipping_per_hat', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Patch Cost per Hat ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.patch_cost_per_hat}
                    onChange={(e) => updateField('patch_cost_per_hat', parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-gray-500">Can pull from patch quote or enter manually</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Labor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Apply min/hat</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.apply_minutes_per_hat}
                      onChange={(e) => updateField('apply_minutes_per_hat', parseFloat(e.target.value))}
                    />
                  </div>
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

            <Card>
              <CardHeader>
                <CardTitle>Pricing Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={formData.pricing_method} onValueChange={(v) => updateField('pricing_method', v)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="margin">Margin %</TabsTrigger>
                    <TabsTrigger value="markup">Markup ×</TabsTrigger>
                  </TabsList>
                </Tabs>

                {formData.pricing_method === 'margin' ? (
                  <div className="space-y-2">
                    <Label>Target Margin %</Label>
                    <Input
                      type="number"
                      value={formData.target_margin_pct}
                      onChange={(e) => updateField('target_margin_pct', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-gray-500">40% margin = price at 1.67× cost</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Markup Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.markup_multiplier}
                      onChange={(e) => updateField('markup_multiplier', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-gray-500">2.0× = double your cost</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleCalculate} disabled={calculating} className="w-full" size="lg">
              <Calculator className="w-5 h-5 mr-2" />
              {calculating ? 'Calculating...' : 'Calculate Quote'}
            </Button>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {results ? (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
                  <CardHeader>
                    <CardTitle>Pricing Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-600">Unit Price</div>
                      <div className="text-3xl font-bold text-green-600">${results.unit_price}/hat</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Price</div>
                      <div className="text-3xl font-bold text-blue-600">${results.total_price}</div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">True Cost/Hat:</span>
                        <span className="font-semibold">${results.true_cost_per_hat.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tier Pricing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(results.tier_prices_json || {}).map(([qty, prices]) => (
                        <div key={qty} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{qty}+</span>
                          <div className="text-right">
                            <div className="font-bold">${prices.unit}/hat</div>
                            <div className="text-sm text-gray-600">${prices.total} total</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Tier Quote Script</CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(results.tier_quote_text)}
                      >
                        {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                      {results.tier_quote_text}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Button onClick={() => handleSave('draft')} className="w-full" variant="outline">
                    Save as Draft
                  </Button>
                  <Button onClick={() => handleSave('sent')} className="w-full">
                    Mark as Sent
                  </Button>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Fill in the form and click Calculate</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Finished Hat Pricing</h2>
          <p className="text-gray-600">Price finished hats with patches already applied</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Package className="w-4 h-4 mr-2" />
          New Finished Hat Quote
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">No finished hat quotes yet</p>
            <Button onClick={() => setShowForm(true)}>Create Your First Quote</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map(quote => (
            <Card key={quote.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{quote.hat_name}</h3>
                    <p className="text-sm text-gray-600">
                      {quote.buy_qty} hats • {quote.customer?.name || 'No customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">${quote.total_price}</div>
                    <div className="text-sm text-gray-600">${quote.unit_price}/hat</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
