'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  const emptyCustomer = { name: '', email: '', phone: '', notes: '' }
  const [newCustomer, setNewCustomer] = useState(emptyCustomer)

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    try {
      const response = await fetch('/api?path=customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    try {
      const response = await fetch('/api?path=customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      })

      if (!response.ok) throw new Error('Failed to add customer')

      toast({ title: 'Customer added successfully!' })
      setNewCustomer(emptyCustomer)
      setAdding(false)
      loadCustomers()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  async function handleUpdate(id) {
    try {
      const customer = customers.find(c => c.id === id)
      const response = await fetch(`/api?path=customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      })

      if (!response.ok) throw new Error('Failed to update customer')

      toast({ title: 'Customer updated!' })
      setEditing(null)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this customer?')) return

    try {
      const response = await fetch(`/api?path=customers/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')

      toast({ title: 'Customer deleted' })
      loadCustomers()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const updateCustomer = (id, field, value) => {
    setCustomers(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="text-gray-600">Manage your customer list</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Add New Customer Form */}
      {adding && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle>Add New Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="555-1234"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => { setAdding(false); setNewCustomer(emptyCustomer) }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!newCustomer.name}>
                <Save className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customers List */}
      <div className="grid gap-4">
        {customers.map(customer => (
          <Card key={customer.id}>
            <CardContent className="pt-6">
              {editing === customer.id ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={customer.name}
                        onChange={(e) => updateCustomer(customer.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={customer.email || ''}
                        onChange={(e) => updateCustomer(customer.id, 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={customer.phone || ''}
                        onChange={(e) => updateCustomer(customer.id, 'phone', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={customer.notes || ''}
                        onChange={(e) => updateCustomer(customer.id, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => { setEditing(null); loadCustomers() }}>
                      Cancel
                    </Button>
                    <Button onClick={() => handleUpdate(customer.id)}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{customer.name}</h3>
                    <p className="text-sm text-gray-600">
                      {customer.email && `${customer.email} • `}
                      {customer.phone && customer.phone}
                    </p>
                    {customer.notes && <p className="text-sm text-gray-500 mt-1">{customer.notes}</p>}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(customer.id)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(customer.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
