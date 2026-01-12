'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  UtensilsCrossed, Coffee, Sun, Moon, Apple, ChefHat, Clock, Flame,
  RefreshCw, Edit2, X, Check, Search, Loader2, Calendar, Target
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Días de la semana
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Configuración de slots de comida
const MEAL_SLOTS = {
  breakfast: { label: 'Desayuno', icon: Coffee, color: 'from-amber-500/20 to-orange-500/20', percent: 25 },
  lunch: { label: 'Comida', icon: Sun, color: 'from-green-500/20 to-emerald-500/20', percent: 35 },
  dinner: { label: 'Cena', icon: Moon, color: 'from-blue-500/20 to-indigo-500/20', percent: 30 },
  snack: { label: 'Snack', icon: Apple, color: 'from-purple-500/20 to-pink-500/20', percent: 10 }
}

// Componente de tarjeta de receta individual
function RecipeCard({ item, recipe, onEdit, canEdit = false }) {
  const slot = MEAL_SLOTS[item.meal_slot] || MEAL_SLOTS.snack
  const SlotIcon = slot.icon

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br ${slot.color} border border-white/5 transition-all hover:border-white/10 group`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <SlotIcon className="w-4 h-4 text-white/70" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{recipe?.name || 'Sin receta'}</p>
            {recipe?.calories && (
              <p className="text-gray-400 text-xs flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {recipe.calories} kcal
                {recipe.protein_g && <span className="ml-2">• {recipe.protein_g}g prot</span>}
              </p>
            )}
          </div>
        </div>
        {canEdit && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="opacity-0 group-hover:opacity-100 h-7 w-7 text-gray-400 hover:text-white transition-all"
            onClick={onEdit}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      {item.notes && (
        <p className="text-xs text-gray-500 mt-2 italic">📝 {item.notes}</p>
      )}
    </div>
  )
}

// Componente vista de día
function DayColumn({ dayIndex, items, recipes, canEdit, onEditItem }) {
  const dayName = DAYS[dayIndex - 1]
  const dayItems = items.filter(i => i.day_index === dayIndex)
  
  const getRecipe = (recipeId) => recipes.find(r => r.id === recipeId)

  return (
    <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 min-w-[200px]">
      <h4 className="text-white font-semibold text-center mb-3 pb-2 border-b border-white/10">
        {dayName}
      </h4>
      <div className="space-y-2">
        {Object.keys(MEAL_SLOTS).map(slot => {
          const item = dayItems.find(i => i.meal_slot === slot)
          if (!item) return null
          
          return (
            <RecipeCard
              key={`${dayIndex}-${slot}`}
              item={item}
              recipe={getRecipe(item.recipe_id)}
              canEdit={canEdit}
              onEdit={() => onEditItem(item)}
            />
          )
        })}
        {dayItems.length === 0 && (
          <p className="text-gray-500 text-xs text-center py-4">Sin comidas</p>
        )}
      </div>
    </div>
  )
}

// Modal para editar/cambiar receta
function EditRecipeModal({ isOpen, onClose, item, allRecipes, onSave }) {
  const [selectedRecipe, setSelectedRecipe] = useState(item?.recipe_id || '')
  const [notes, setNotes] = useState(item?.notes || '')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const slot = item ? MEAL_SLOTS[item.meal_slot] : null
  const filteredRecipes = allRecipes.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    setSaving(true)
    await onSave(item.id, selectedRecipe, notes)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-violet-400" />
            Cambiar Receta - {slot?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar receta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border-white/10 pl-10 text-white"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  selectedRecipe === recipe.id 
                    ? 'bg-violet-600/30 border border-violet-500/50' 
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white text-sm font-medium">{recipe.name}</p>
                    <p className="text-gray-400 text-xs">{recipe.category}</p>
                  </div>
                  {recipe.calories && (
                    <span className="text-xs text-gray-400">{recipe.calories} kcal</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Notas (opcional)</label>
            <Textarea
              placeholder="Instrucciones especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white/5 border-white/10 text-white text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-white/10 text-gray-300">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!selectedRecipe || saving}
              className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Componente principal - Vista para MEMBER
export function MemberRecipePlan({ userId }) {
  const [plan, setPlan] = useState(null)
  const [items, setItems] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadPlan()
  }, [userId])

  const loadPlan = async () => {
    try {
      // Cargar plan activo
      const { data: planData } = await supabase
        .from('member_recipe_plans')
        .select('*, diet:diet_templates(name)')
        .eq('member_id', userId)
        .eq('status', 'active')
        .order('week_start', { ascending: false })
        .limit(1)
        .single()

      if (planData) {
        setPlan(planData)
        
        // Cargar items del plan
        const { data: itemsData } = await supabase
          .from('member_recipe_plan_items')
          .select('*')
          .eq('plan_id', planData.id)
          .order('day_index')

        // Cargar recetas
        const { data: recipesData } = await supabase
          .from('recipes')
          .select('*')
        
        setItems(itemsData || [])
        setRecipes(recipesData || [])
      }
    } catch (error) {
      console.error('Error loading plan:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-white/5 rounded-3xl">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-white/5 rounded-3xl">
        <CardContent className="p-8 text-center">
          <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-white font-bold text-lg mb-2">Sin plan de recetas</h3>
          <p className="text-gray-500">Tu entrenador aún no ha generado tu plan semanal de recetas.</p>
        </CardContent>
      </Card>
    )
  }

  const weekStart = new Date(plan.week_start)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-white/5 rounded-3xl overflow-hidden">
      <CardHeader className="border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-violet-400" />
              Plan de Recetas Semanal
            </CardTitle>
            <CardDescription className="text-gray-500 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {plan.diet?.name && <span>• {plan.diet.name}</span>}
            </CardDescription>
          </div>
          {plan.target_calories && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{plan.target_calories}</p>
              <p className="text-xs text-gray-500">kcal/día</p>
            </div>
          )}
        </div>

        {/* Macros objetivo */}
        {plan.target_protein_g && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-blue-500/10 rounded-xl p-3 text-center">
              <p className="text-blue-400 text-lg font-bold">{plan.target_protein_g}g</p>
              <p className="text-xs text-gray-500">Proteína</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-3 text-center">
              <p className="text-amber-400 text-lg font-bold">{plan.target_carbs_g}g</p>
              <p className="text-xs text-gray-500">Carbos</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-3 text-center">
              <p className="text-purple-400 text-lg font-bold">{plan.target_fat_g}g</p>
              <p className="text-xs text-gray-500">Grasas</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5, 6, 7].map(dayIndex => (
            <DayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              items={items}
              recipes={recipes}
              canEdit={false}
            />
          ))}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
          {Object.entries(MEAL_SLOTS).map(([key, slot]) => {
            const SlotIcon = slot.icon
            return (
              <div key={key} className="flex items-center gap-2 text-xs text-gray-400">
                <SlotIcon className="w-3 h-3" />
                <span>{slot.label} ({slot.percent}%)</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal - Vista para TRAINER/ADMIN (con edición)
export function TrainerRecipePlanEditor({ memberId, memberName, trainerId }) {
  const [plan, setPlan] = useState(null)
  const [items, setItems] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const { toast } = useToast()

  useEffect(() => {
    loadPlan()
    loadAllRecipes()
  }, [memberId])

  const loadPlan = async () => {
    try {
      const { data: planData } = await supabase
        .from('member_recipe_plans')
        .select('*, diet:diet_templates(name, calories, protein_g, carbs_g, fat_g)')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .order('week_start', { ascending: false })
        .limit(1)
        .single()

      if (planData) {
        setPlan(planData)
        
        const { data: itemsData } = await supabase
          .from('member_recipe_plan_items')
          .select('*')
          .eq('plan_id', planData.id)
          .order('day_index')
        
        setItems(itemsData || [])
      }
    } catch (error) {
      console.error('Error loading plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllRecipes = async () => {
    const { data } = await supabase.from('recipes').select('*').order('category')
    setRecipes(data || [])
  }

  const generatePlan = async () => {
    setGenerating(true)
    try {
      // Obtener dieta asignada al socio
      const { data: memberDiet } = await supabase
        .from('member_diets')
        .select('*, diet:diet_templates(*)')
        .eq('member_id', memberId)
        .single()

      if (!memberDiet?.diet) {
        toast({ title: 'Error', description: 'El socio no tiene dieta asignada', variant: 'destructive' })
        setGenerating(false)
        return
      }

      // Calcular lunes de esta semana
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - today.getDay() + 1)
      const weekStart = monday.toISOString().split('T')[0]

      // Archivar plan anterior si existe
      if (plan) {
        await supabase
          .from('member_recipe_plans')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', plan.id)
      }

      // Crear nuevo plan
      const { data: newPlan, error: planError } = await supabase
        .from('member_recipe_plans')
        .insert([{
          member_id: memberId,
          trainer_id: trainerId,
          diet_template_id: memberDiet.diet.id,
          week_start: weekStart,
          target_calories: memberDiet.diet.calories,
          target_protein_g: memberDiet.diet.protein_g,
          target_carbs_g: memberDiet.diet.carbs_g,
          target_fat_g: memberDiet.diet.fat_g,
          status: 'active'
        }])
        .select()
        .single()

      if (planError) throw planError

      // Obtener recetas de la dieta
      const { data: dietRecipes } = await supabase
        .from('diet_recipes')
        .select('*, recipe:recipes(*)')
        .eq('diet_template_id', memberDiet.diet.id)

      // Organizar recetas por categoría
      const recipesBySlot = {
        breakfast: (dietRecipes || []).filter(dr => dr.recipe?.category === 'breakfast').map(dr => dr.recipe),
        lunch: (dietRecipes || []).filter(dr => dr.recipe?.category === 'lunch').map(dr => dr.recipe),
        dinner: (dietRecipes || []).filter(dr => dr.recipe?.category === 'dinner').map(dr => dr.recipe),
        snack: (dietRecipes || []).filter(dr => dr.recipe?.category === 'snack').map(dr => dr.recipe)
      }

      // Si faltan recetas en alguna categoría, usar globales
      for (const slot of Object.keys(recipesBySlot)) {
        if (recipesBySlot[slot].length === 0) {
          const globalRecipes = recipes.filter(r => r.category === slot)
          recipesBySlot[slot] = globalRecipes
        }
      }

      // Generar items para 7 días
      const newItems = []
      for (let day = 1; day <= 7; day++) {
        for (const [slot, slotRecipes] of Object.entries(recipesBySlot)) {
          if (slotRecipes.length > 0) {
            // Seleccionar receta aleatoria (en producción usar lógica de macros)
            const randomRecipe = slotRecipes[Math.floor(Math.random() * slotRecipes.length)]
            newItems.push({
              plan_id: newPlan.id,
              day_index: day,
              meal_slot: slot,
              recipe_id: randomRecipe.id
            })
          }
        }
      }

      // Insertar items
      if (newItems.length > 0) {
        await supabase.from('member_recipe_plan_items').insert(newItems)
      }

      toast({ title: '¡Plan generado!', description: `Plan semanal creado con ${newItems.length} comidas` })
      loadPlan()

    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const updateItem = async (itemId, newRecipeId, newNotes) => {
    try {
      const { error } = await supabase
        .from('member_recipe_plan_items')
        .update({ recipe_id: newRecipeId, notes: newNotes })
        .eq('id', itemId)

      if (error) throw error
      
      toast({ title: 'Receta actualizada' })
      loadPlan()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold">Plan de Recetas - {memberName}</h3>
          <p className="text-gray-500 text-sm">
            {plan ? `Semana del ${new Date(plan.week_start).toLocaleDateString('es-ES')}` : 'Sin plan activo'}
          </p>
        </div>
        <Button
          onClick={generatePlan}
          disabled={generating}
          className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {plan ? 'Regenerar Plan' : 'Generar Plan'}
        </Button>
      </div>

      {plan ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5, 6, 7].map(dayIndex => (
            <DayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              items={items}
              recipes={recipes}
              canEdit={true}
              onEditItem={setEditingItem}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">No hay plan activo. Genera uno para empezar.</p>
        </div>
      )}

      {/* Modal de edición */}
      <EditRecipeModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        allRecipes={recipes}
        onSave={updateItem}
      />
    </div>
  )
}

export default { MemberRecipePlan, TrainerRecipePlanEditor }
