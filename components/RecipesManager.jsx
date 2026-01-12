'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  UtensilsCrossed, Search, Flame, Clock, Users, Plus, Edit2, Trash2,
  Coffee, Sun, Moon, Apple, ChefHat, Loader2, ImagePlus, X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Iconos por categoría
const categoryIcons = {
  breakfast: { icon: Coffee, label: 'Desayuno', color: 'from-amber-500 to-orange-500' },
  lunch: { icon: Sun, label: 'Comida', color: 'from-green-500 to-emerald-500' },
  dinner: { icon: Moon, label: 'Cena', color: 'from-blue-500 to-indigo-500' },
  snack: { icon: Apple, label: 'Snack', color: 'from-purple-500 to-pink-500' },
  any: { icon: UtensilsCrossed, label: 'Cualquiera', color: 'from-gray-500 to-gray-600' }
}

// Tarjeta de receta
function RecipeCard({ recipe, onEdit, onDelete, canEdit = false }) {
  const [showDetail, setShowDetail] = useState(false)
  const category = categoryIcons[recipe.category] || categoryIcons.any
  const CategoryIcon = category.icon

  return (
    <>
      <div 
        className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all cursor-pointer group"
        onClick={() => setShowDetail(true)}
      >
        {/* Imagen */}
        <div className="aspect-video bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] relative overflow-hidden">
          {recipe.image_url ? (
            <img 
              src={recipe.image_url} 
              alt={recipe.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CategoryIcon className="w-12 h-12 text-gray-700" />
            </div>
          )}
          
          {/* Badge categoría */}
          <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg bg-gradient-to-r ${category.color} text-white text-xs font-semibold`}>
            {category.label}
          </div>

          {/* Botones edición */}
          {canEdit && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
                onClick={(e) => { e.stopPropagation(); onEdit(recipe); }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 bg-black/50 hover:bg-red-600 text-white"
                onClick={(e) => { e.stopPropagation(); onDelete(recipe.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-white font-semibold truncate">{recipe.name}</h3>
          <p className="text-gray-500 text-sm line-clamp-2 mt-1">{recipe.description}</p>
          
          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            {recipe.calories && (
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                {recipe.calories} kcal
              </span>
            )}
            {recipe.prep_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recipe.prep_time_minutes + (recipe.cook_time_minutes || 0)} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {recipe.servings}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-violet-400" />
              {recipe.name}
            </DialogTitle>
          </DialogHeader>

          {recipe.image_url && (
            <img 
              src={recipe.image_url} 
              alt={recipe.name}
              className="w-full aspect-video object-cover rounded-xl"
            />
          )}

          <div className="space-y-4">
            {/* Macros */}
            {recipe.calories && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                  <p className="text-orange-400 font-bold">{recipe.calories}</p>
                  <p className="text-xs text-gray-500">kcal</p>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <p className="text-blue-400 font-bold">{recipe.protein_g || 0}g</p>
                  <p className="text-xs text-gray-500">Prot</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                  <p className="text-amber-400 font-bold">{recipe.carbs_g || 0}g</p>
                  <p className="text-xs text-gray-500">Carbs</p>
                </div>
                <div className="bg-purple-500/10 rounded-xl p-3 text-center">
                  <p className="text-purple-400 font-bold">{recipe.fat_g || 0}g</p>
                  <p className="text-xs text-gray-500">Grasas</p>
                </div>
              </div>
            )}

            {/* Descripción */}
            {recipe.description && (
              <div>
                <h4 className="text-white font-semibold mb-2">Descripción</h4>
                <p className="text-gray-400 text-sm">{recipe.description}</p>
              </div>
            )}

            {/* Instrucciones */}
            {recipe.instructions && (
              <div>
                <h4 className="text-white font-semibold mb-2">Instrucciones</h4>
                <p className="text-gray-400 text-sm whitespace-pre-wrap">{recipe.instructions}</p>
              </div>
            )}

            {/* Tiempos */}
            <div className="flex gap-4 text-sm">
              {recipe.prep_time_minutes && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  Prep: {recipe.prep_time_minutes} min
                </div>
              )}
              {recipe.cook_time_minutes && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Flame className="w-4 h-4" />
                  Cocción: {recipe.cook_time_minutes} min
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Modal crear/editar receta
function RecipeFormModal({ isOpen, onClose, recipe = null, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    category: 'lunch',
    prep_time_minutes: '',
    cook_time_minutes: '',
    servings: '1',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    image_url: ''
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name || '',
        description: recipe.description || '',
        instructions: recipe.instructions || '',
        category: recipe.category || 'lunch',
        prep_time_minutes: recipe.prep_time_minutes?.toString() || '',
        cook_time_minutes: recipe.cook_time_minutes?.toString() || '',
        servings: recipe.servings?.toString() || '1',
        calories: recipe.calories?.toString() || '',
        protein_g: recipe.protein_g?.toString() || '',
        carbs_g: recipe.carbs_g?.toString() || '',
        fat_g: recipe.fat_g?.toString() || '',
        image_url: recipe.image_url || ''
      })
      setImagePreview(recipe.image_url || '')
    } else {
      setFormData({
        name: '',
        description: '',
        instructions: '',
        category: 'lunch',
        prep_time_minutes: '',
        cook_time_minutes: '',
        servings: '1',
        calories: '',
        protein_g: '',
        carbs_g: '',
        fat_g: '',
        image_url: ''
      })
      setImagePreview('')
    }
    setImageFile(null)
  }, [recipe, isOpen])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    setFormData(prev => ({ ...prev, image_url: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      let imageUrl = formData.image_url

      // Subir imagen si hay una nueva
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `recipe_${Date.now()}.${fileExt}`
        const filePath = `recipes/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('recipe_images')
          .upload(filePath, imageFile)

        if (uploadError) {
          // Si el bucket no existe, usar URL pública directamente
          console.warn('Upload error, using placeholder:', uploadError)
        } else {
          const { data: urlData } = supabase.storage
            .from('recipe_images')
            .getPublicUrl(filePath)
          imageUrl = urlData.publicUrl
        }
      }

      const recipeData = {
        name: formData.name,
        description: formData.description || null,
        instructions: formData.instructions || null,
        category: formData.category,
        prep_time_minutes: formData.prep_time_minutes ? parseInt(formData.prep_time_minutes) : null,
        cook_time_minutes: formData.cook_time_minutes ? parseInt(formData.cook_time_minutes) : null,
        servings: formData.servings ? parseInt(formData.servings) : 1,
        calories: formData.calories ? parseInt(formData.calories) : null,
        protein_g: formData.protein_g ? parseFloat(formData.protein_g) : null,
        carbs_g: formData.carbs_g ? parseFloat(formData.carbs_g) : null,
        fat_g: formData.fat_g ? parseFloat(formData.fat_g) : null,
        image_url: imageUrl || null
      }

      await onSave(recipeData, recipe?.id)
      onClose()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-violet-400" />
            {recipe ? 'Editar Receta' : 'Nueva Receta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Imagen */}
          <div>
            <Label className="text-gray-400 text-sm">Foto de la receta</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full aspect-video object-cover rounded-xl"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-violet-500/50 transition-colors">
                  <ImagePlus className="w-10 h-10 text-gray-600 mb-2" />
                  <span className="text-sm text-gray-500">Subir imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Nombre y categoría */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la receta"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Categoría</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">🌅 Desayuno</SelectItem>
                  <SelectItem value="lunch">☀️ Comida</SelectItem>
                  <SelectItem value="dinner">🌙 Cena</SelectItem>
                  <SelectItem value="snack">🍎 Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <Label className="text-gray-400 text-sm">Descripción</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Breve descripción..."
              className="bg-white/5 border-white/10 text-white mt-1"
              rows={2}
            />
          </div>

          {/* Macros */}
          <div>
            <Label className="text-gray-400 text-sm mb-2 block">Información Nutricional (por porción)</Label>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData(prev => ({ ...prev, calories: e.target.value }))}
                  placeholder="Calorías"
                  className="bg-white/5 border-white/10 text-white text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block text-center">kcal</span>
              </div>
              <div>
                <Input
                  type="number"
                  value={formData.protein_g}
                  onChange={(e) => setFormData(prev => ({ ...prev, protein_g: e.target.value }))}
                  placeholder="Proteína"
                  className="bg-white/5 border-white/10 text-white text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block text-center">g prot</span>
              </div>
              <div>
                <Input
                  type="number"
                  value={formData.carbs_g}
                  onChange={(e) => setFormData(prev => ({ ...prev, carbs_g: e.target.value }))}
                  placeholder="Carbos"
                  className="bg-white/5 border-white/10 text-white text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block text-center">g carbs</span>
              </div>
              <div>
                <Input
                  type="number"
                  value={formData.fat_g}
                  onChange={(e) => setFormData(prev => ({ ...prev, fat_g: e.target.value }))}
                  placeholder="Grasas"
                  className="bg-white/5 border-white/10 text-white text-sm"
                />
                <span className="text-xs text-gray-500 mt-1 block text-center">g grasas</span>
              </div>
            </div>
          </div>

          {/* Tiempos */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">Prep (min)</Label>
              <Input
                type="number"
                value={formData.prep_time_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, prep_time_minutes: e.target.value }))}
                placeholder="15"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Cocción (min)</Label>
              <Input
                type="number"
                value={formData.cook_time_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, cook_time_minutes: e.target.value }))}
                placeholder="20"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Porciones</Label>
              <Input
                type="number"
                value={formData.servings}
                onChange={(e) => setFormData(prev => ({ ...prev, servings: e.target.value }))}
                placeholder="1"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          </div>

          {/* Instrucciones */}
          <div>
            <Label className="text-gray-400 text-sm">Instrucciones</Label>
            <Textarea
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Paso a paso de la preparación..."
              className="bg-white/5 border-white/10 text-white mt-1"
              rows={4}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-gray-300">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {recipe ? 'Guardar Cambios' : 'Crear Receta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Galería de recetas para MEMBER (solo lectura)
export function RecipesGallery() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('category')
      .order('name')
    setRecipes(data || [])
    setLoading(false)
  }

  const filteredRecipes = (recipes || []).filter(r => {
    const matchesSearch = (r?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r?.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || r?.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar recetas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border-white/10 pl-10 text-white"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white w-full sm:w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="breakfast">🌅 Desayuno</SelectItem>
            <SelectItem value="lunch">☀️ Comida</SelectItem>
            <SelectItem value="dinner">🌙 Cena</SelectItem>
            <SelectItem value="snack">🍎 Snack</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de recetas */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} canEdit={false} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500">No se encontraron recetas</p>
        </div>
      )}
    </div>
  )
}

// Gestión de recetas para TRAINER/ADMIN (CRUD completo)
export function RecipesManager({ userId }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const { toast } = useToast()

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  const handleSave = async (recipeData, recipeId = null) => {
    try {
      if (recipeId) {
        // Actualizar
        const { error } = await supabase
          .from('recipes')
          .update(recipeData)
          .eq('id', recipeId)
        if (error) throw error
        toast({ title: 'Receta actualizada' })
      } else {
        // Crear nueva
        const { error } = await supabase
          .from('recipes')
          .insert([{ ...recipeData, created_by: userId }])
        if (error) throw error
        toast({ title: 'Receta creada' })
      }
      loadRecipes()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      throw error
    }
  }

  const handleDelete = async (recipeId) => {
    if (!confirm('¿Eliminar esta receta?')) return
    
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
      if (error) throw error
      toast({ title: 'Receta eliminada' })
      loadRecipes()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const filteredRecipes = (recipes || []).filter(r => {
    const matchesSearch = (r?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || r?.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con botón crear */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar recetas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border-white/10 pl-10 text-white"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="breakfast">Desayuno</SelectItem>
              <SelectItem value="lunch">Comida</SelectItem>
              <SelectItem value="dinner">Cena</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={() => { setEditingRecipe(null); setShowForm(true); }}
          className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Receta
        </Button>
      </div>

      {/* Grid de recetas */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(recipe => (
            <RecipeCard 
              key={recipe.id} 
              recipe={recipe} 
              canEdit={true}
              onEdit={(r) => { setEditingRecipe(r); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/[0.02] rounded-2xl border border-white/5">
          <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 mb-4">No hay recetas creadas</p>
          <Button 
            onClick={() => { setEditingRecipe(null); setShowForm(true); }}
            className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear primera receta
          </Button>
        </div>
      )}

      {/* Modal form */}
      <RecipeFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingRecipe(null); }}
        recipe={editingRecipe}
        onSave={handleSave}
      />
    </div>
  )
}

export default { RecipesGallery, RecipesManager, RecipeCard }
