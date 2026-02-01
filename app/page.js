'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, DollarSign, FileText, Settings, Users, Package, Plus, LogOut, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

// Import all pages as components
import OnboardingWizard from './onboarding-wizard'
import Dashboard from './dashboard'
import ShopSettings from './shop-settings'
import PatchMaterials from './patch-materials'
import Customers from './customers-page'
import QuoteBuilder from './quote-builder'
import FinishedHatPricing from './finished-hat-pricing'
import ProfitFirst from './profit-first'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [shopSettings, setShopSettings] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const { toast } = useToast()

  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        if (session?.user) {
          loadShopSettings()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user || null)
    if (session?.user) {
      await loadShopSettings()
    }
    setLoading(false)
  }

  async function loadShopSettings() {
    try {
      const response = await fetch('/api?path=shop-settings')
      if (response.ok) {
        const data = await response.json()
        setShopSettings(data)
      }
    } catch (error) {
      console.error('Error loading shop settings:', error)
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthLoading(true)

    try {
      const endpoint = authMode === 'signin' ? 'auth/signin' : 'auth/signup'
      const response = await fetch(`/api?path=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Authentication failed')
      }

      toast({
        title: authMode === 'signin' ? 'Welcome back!' : 'Account created!',
        description: authMode === 'signin' ? 'Successfully signed in' : 'Successfully created your account'
      })

      // Refresh to get new session
      window.location.reload()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    await fetch('/api?path=auth/signout', { method: 'POST' })
    await supabase.auth.signOut()
    setUser(null)
    setShopSettings(null)
    setCurrentPage('dashboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Auth screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-purple-600 p-4 rounded-2xl">
                <Calculator className="w-12 h-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Patch Hat QuoteKit
            </CardTitle>
            <CardDescription className="text-base">
              Professional quoting tool for patch hat decorators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={setAuthMode}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {authMode === 'signin' ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    authMode === 'signin' ? 'Sign In' : 'Create Account'
                  )}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show onboarding if no shop settings
  if (!shopSettings) {
    return <OnboardingWizard onComplete={loadShopSettings} />
  }

  // Main app with navigation
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Patch Hat QuoteKit</h1>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {[
              { id: 'dashboard', label: 'Overview', icon: DollarSign },
              { id: 'quote-builder', label: 'Quote Builder', icon: Plus },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'materials', label: 'Materials', icon: Package },
              { id: 'shop-settings', label: 'Shop Settings', icon: Settings },
              { id: 'profit-first', label: 'Profit First', icon: FileText }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  currentPage === id
                    ? 'bg-purple-100 text-purple-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'quote-builder' && <QuoteBuilder />}
        {currentPage === 'customers' && <Customers />}
        {currentPage === 'materials' && <PatchMaterials />}
        {currentPage === 'shop-settings' && <ShopSettings />}
        {currentPage === 'profit-first' && <ProfitFirst />}
      </main>
    </div>
  )
}
