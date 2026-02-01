'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'

export default function PatchMaterials() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  const emptyMaterial = {
    name: '',
    sheet_width: 12,
    sheet_height: 24,
    sheet_cost: 0,
    default_machine_minutes_per_sheet: 12,
    default_cleanup_minutes_per_sheet: 5
  }

  const [newMaterial, setNewMaterial] = useState(emptyMaterial)

  useEffect(() => {
    loadMaterials()
  }, [])

  async function loadMaterials() {
    try {
      const response = await fetch('/api?path=patch-materials')
      if (response.ok) {
        const data = await response.json()
        setMaterials(data)
      }
    } catch (error) {
      console.error('Error loading materials:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    try {
      const response = await fetch('/api?path=patch-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      })

      if (!response.ok) throw new Error('Failed to add material')

      toast({ title: 'Material added successfully!' })
      setNewMaterial(emptyMaterial)
      setAdding(false)
      loadMaterials()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  async function handleUpdate(id) {
    try {
      const material = materials.find(m => m.id === id)
      const response = await fetch(`/api?path=patch-materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(material)
      })

      if (!response.ok) throw new Error('Failed to update material')

      toast({ title: 'Material updated!' })
      setEditing(null)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this material?')) return

    try {
      const response = await fetch(`/api?path=patch-materials/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')

      toast({ title: 'Material deleted' })
      loadMaterials()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const updateMaterial = (id, field, value) => {
    setMaterials(prev => prev.map(m => 
      m.id === id ? { ...m, [field]: parseFloat(value) || value } : m
    ))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Patch Materials</h2>
          <p className="text-gray-600">Manage your patch material inventory</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Add New Material Form */}
      {adding && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle>Add New Material</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Standard Leatherette"
                />
              </div>
              <div className="space-y-2">
                <Label>Sheet Width (in)</Label>
                <Input
                  type="number"
                  value={newMaterial.sheet_width}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, sheet_width: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sheet Height (in)</Label>
                <Input
                  type="number"
                  value={newMaterial.sheet_height}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, sheet_height: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sheet Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newMaterial.sheet_cost}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, sheet_cost: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Machine Minutes</Label>
                <Input
                  type="number"
                  value={newMaterial.default_machine_minutes_per_sheet}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, default_machine_minutes_per_sheet: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cleanup Minutes</Label>
                <Input
                  type="number"
                  value={newMaterial.default_cleanup_minutes_per_sheet}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, default_cleanup_minutes_per_sheet: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => { setAdding(false); setNewMaterial(emptyMaterial) }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!newMaterial.name}>
                <Save className="w-4 h-4 mr-2" />
                Add Material
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      <div className="grid gap-4">
        {materials.map(material => (
          <Card key={material.id}>
            <CardContent className="pt-6">
              {editing === material.id ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={material.name}
                        onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sheet Width (in)</Label>
                      <Input
                        type="number"
                        value={material.sheet_width}
                        onChange={(e) => updateMaterial(material.id, 'sheet_width', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sheet Height (in)</Label>
                      <Input
                        type="number"
                        value={material.sheet_height}
                        onChange={(e) => updateMaterial(material.id, 'sheet_height', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sheet Cost ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={material.sheet_cost}
                        onChange={(e) => updateMaterial(material.id, 'sheet_cost', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Machine Minutes</Label>
                      <Input
                        type="number"
                        value={material.default_machine_minutes_per_sheet}
                        onChange={(e) => updateMaterial(material.id, 'default_machine_minutes_per_sheet', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cleanup Minutes</Label>
                      <Input
                        type="number"
                        value={material.default_cleanup_minutes_per_sheet}
                        onChange={(e) => updateMaterial(material.id, 'default_cleanup_minutes_per_sheet', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => { setEditing(null); loadMaterials() }}>
                      Cancel
                    </Button>
                    <Button onClick={() => handleUpdate(material.id)}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{material.name}</h3>
                    <p className="text-sm text-gray-600">
                      {material.sheet_width}×{material.sheet_height}" • ${material.sheet_cost}/sheet • 
                      {material.default_machine_minutes_per_sheet}min machine + {material.default_cleanup_minutes_per_sheet}min cleanup
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(material.id)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(material.id)}>
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
