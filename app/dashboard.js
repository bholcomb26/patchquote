'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, Package, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Dashboard() {
  const [shopSettings, setShopSettings] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [quoteTypeFilter, setQuoteTypeFilter] = useState('all')
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [settingsRes, quotesRes] = await Promise.all([
        fetch('/api?path=shop-settings'),
        fetch('/api?path=quotes')
      ])

      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        setShopSettings(settings)
      }

      if (quotesRes.ok) {
        const quotesData = await quotesRes.json()
        setQuotes(quotesData)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateShopRate = () => {
    if (!shopSettings) return { shopRate: 0, minuteRate: 0 }
    const workableHoursMonth = shopSettings.workable_hours_per_week * 4.33
    const billableHoursMonth = workableHoursMonth * (shopSettings.billable_efficiency_pct / 100)
    if (billableHoursMonth === 0) return { shopRate: 0, minuteRate: 0 }
    const requiredMonthly = shopSettings.monthly_overhead + shopSettings.monthly_owner_pay_goal + shopSettings.monthly_profit_goal
    const shopRate = requiredMonthly / billableHoursMonth
    const minuteRate = shopRate / 60
    return { shopRate, minuteRate }
  }

  const rates = calculateShopRate()
  const paidQuotes = quotes.filter(q => q.status === 'paid')
  const thisMonthSales = paidQuotes.reduce((sum, q) => sum + (q.total_price || 0), 0)

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-gray-600">Your quotes, customers, and quick actions.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Shop Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">${rates.shopRate.toFixed(2)}/hr</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Minute Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">${rates.minuteRate.toFixed(2)}/min</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">This Month (Sales)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${thisMonthSales.toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Paid → Buckets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${thisMonthSales.toFixed(0)} moved</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No quotes yet. Create your first quote to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotes.slice(0, 10).map(quote => (
                <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium">
                      {quote.qty} patch hats • {quote.material?.name} {quote.patch_width_input}×{quote.patch_height_input}
                    </div>
                    <div className="text-sm text-gray-600">
                      {quote.customer?.name || 'No customer'} • {new Date(quote.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-bold">${quote.total_price || 0}</div>
                      <div className="text-sm text-gray-600">${quote.unit_price || 0}/hat</div>
                    </div>
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
