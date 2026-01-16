'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Camera, Upload, Loader2, Check, X, Flame, Beef, Wheat, Droplets,
  Plus, Trash2, UtensilsCrossed, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

// Componente de barra de progreso de macros
function MacroProgressBar({ label, icon: Icon, consumed, total, color, unit = 'g' }) {
  const percent = total > 0 ? Math.min((consumed / total) * 100, 100) : 0
  const remaining = total - consumed
  const isOver = remaining < 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-gray-400">{label}</span>
        </div>
        <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-white'}`}>
          {consumed.toFixed(0)}/{total}{unit}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : color.replace('text-', 'bg-')}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`text-xs ${isOver ? 'text-red-400' : 'text-gray-500'}`}>
        {isOver ? `${Math.abs(remaining).toFixed(0)}${unit} de más` : `${remaining.toFixed(0)}${unit} restantes`}
      </p>
    </div>
  )
}

// Componente principal
export default function FoodTracker({ userId }) {
  const [macrosSummary, setMacrosSummary] = useState(null)
  const [foodLogs, setFoodLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [editableAnalysis, setEditableAnalysis] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  
  const fileInputRef = useRef(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load macros summary
      const { data: summary } = await supabase.rpc('rpc_get_daily_macros_summary')
      if (summary) setMacrosSummary(summary)

      // Load food logs
      const { data: logs } = await supabase.rpc('rpc_get_daily_food_logs')
      if (logs) setFoodLogs(logs)
    } catch (err) {
      console.error('Error loading food data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Por favor selecciona una imagen', variant: 'destructive' })
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1]
      await analyzeFood(base64)
    }
    reader.readAsDataURL(file)
  }

  const analyzeFood = async (imageBase64) => {
    setAnalyzing(true)
    setShowCamera(false)
    
    try {
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setAnalysis(data.analysis)
      setEditableAnalysis({
        food_name: data.analysis.food_name || '',
        description: data.analysis.description || '',
        calories: data.analysis.calories || 0,
        protein_g: data.analysis.protein_g || 0,
        carbs_g: data.analysis.carbs_g || 0,
        fat_g: data.analysis.fat_g || 0,
        meal_type: 'other'
      })

    } catch (err) {
      console.error('Analysis error:', err)
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveFood = async () => {
    if (!editableAnalysis) return
    setSaving(true)

    try {
      const { data, error } = await supabase.rpc('rpc_log_food', {
        p_food_name: editableAnalysis.food_name,
        p_calories: parseInt(editableAnalysis.calories) || 0,
        p_protein_g: parseFloat(editableAnalysis.protein_g) || 0,
        p_carbs_g: parseFloat(editableAnalysis.carbs_g) || 0,
        p_fat_g: parseFloat(editableAnalysis.fat_g) || 0,
        p_meal_type: editableAnalysis.meal_type,
        p_description: editableAnalysis.description
      })

      if (error) throw error

      toast({ title: '¡Comida registrada!' })
      setAnalysis(null)
      setEditableAnalysis(null)
      loadData() // Reload data
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFood = async (id) => {
    try {
      await supabase.rpc('rpc_delete_food_log', { p_id: id })
      toast({ title: 'Comida eliminada' })
      loadData()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const cancelAnalysis = () => {
    setAnalysis(null)
    setEditableAnalysis(null)
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </CardContent>
      </Card>
    )
  }

  const assigned = macrosSummary?.assigned || { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 }
  const consumed = macrosSummary?.consumed || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  return (
    <div className="space-y-4">
      {/* Resumen de macros del día */}
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 via-red-600/10 to-pink-600/10"></div>
          <CardHeader className="relative pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-orange-400" />
              Macros de Hoy
            </CardTitle>
          </CardHeader>
        </div>
        
        <CardContent className="p-5 space-y-4">
          {/* Calorías principales */}
          <div className="text-center py-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl">
              <Flame className="w-6 h-6 text-orange-400" />
              <span className="text-3xl font-bold text-white">{consumed.calories}</span>
              <span className="text-gray-400">/ {assigned.calories} kcal</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {assigned.calories - consumed.calories > 0 
                ? `Te quedan ${assigned.calories - consumed.calories} kcal`
                : `${Math.abs(assigned.calories - consumed.calories)} kcal de más`}
            </p>
          </div>

          {/* Barras de progreso */}
          <div className="grid gap-3">
            <MacroProgressBar 
              label="Proteína" 
              icon={Beef} 
              consumed={consumed.protein_g} 
              total={assigned.protein_g}
              color="text-red-400"
            />
            <MacroProgressBar 
              label="Carbohidratos" 
              icon={Wheat} 
              consumed={consumed.carbs_g} 
              total={assigned.carbs_g}
              color="text-amber-400"
            />
            <MacroProgressBar 
              label="Grasas" 
              icon={Droplets} 
              consumed={consumed.fat_g} 
              total={assigned.fat_g}
              color="text-blue-400"
            />
          </div>

          {/* Botón para añadir comida */}
          {!analysis && !analyzing && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-14 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-2xl shadow-lg shadow-orange-500/20"
            >
              <Camera className="w-5 h-5 mr-2" />
              Fotografiar Comida
            </Button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Estado: Analizando */}
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse"></div>
                <Loader2 className="w-8 h-8 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
              </div>
              <p className="text-gray-400">Analizando tu comida...</p>
            </div>
          )}

          {/* Resultado del análisis - EDITABLE */}
          {editableAnalysis && !analyzing && (
            <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">Resultado del análisis</h4>
                {analysis?.confidence && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    analysis.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                    analysis.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {analysis.confidence === 'high' ? 'Alta confianza' :
                     analysis.confidence === 'medium' ? 'Confianza media' : 'Baja confianza'}
                  </span>
                )}
              </div>

              {/* Campos editables */}
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-400 text-xs">Nombre de la comida</Label>
                  <Input
                    value={editableAnalysis.food_name}
                    onChange={(e) => setEditableAnalysis({...editableAnalysis, food_name: e.target.value})}
                    className="bg-white/5 border-white/10 text-white rounded-xl mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-xs flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" /> Calorías
                    </Label>
                    <Input
                      type="number"
                      value={editableAnalysis.calories}
                      onChange={(e) => setEditableAnalysis({...editableAnalysis, calories: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs flex items-center gap-1">
                      <Beef className="w-3 h-3 text-red-400" /> Proteína (g)
                    </Label>
                    <Input
                      type="number"
                      value={editableAnalysis.protein_g}
                      onChange={(e) => setEditableAnalysis({...editableAnalysis, protein_g: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs flex items-center gap-1">
                      <Wheat className="w-3 h-3 text-amber-400" /> Carbos (g)
                    </Label>
                    <Input
                      type="number"
                      value={editableAnalysis.carbs_g}
                      onChange={(e) => setEditableAnalysis({...editableAnalysis, carbs_g: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Grasas (g)
                    </Label>
                    <Input
                      type="number"
                      value={editableAnalysis.fat_g}
                      onChange={(e) => setEditableAnalysis({...editableAnalysis, fat_g: e.target.value})}
                      className="bg-white/5 border-white/10 text-white rounded-xl mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400 text-xs">Tipo de comida</Label>
                  <select
                    value={editableAnalysis.meal_type}
                    onChange={(e) => setEditableAnalysis({...editableAnalysis, meal_type: e.target.value})}
                    className="w-full mt-1 bg-white/5 border border-white/10 text-white rounded-xl p-2.5"
                  >
                    <option value="breakfast">🌅 Desayuno</option>
                    <option value="lunch">☀️ Comida</option>
                    <option value="dinner">🌙 Cena</option>
                    <option value="snack">🍎 Snack</option>
                    <option value="other">🍽️ Otro</option>
                  </select>
                </div>
              </div>

              {analysis?.notes && (
                <p className="text-xs text-gray-500 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {analysis.notes}
                </p>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={cancelAnalysis}
                  variant="outline"
                  className="flex-1 border-white/10 text-gray-400 hover:bg-white/5 rounded-xl"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveFood}
                  disabled={saving || !editableAnalysis.food_name}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de comidas del día */}
      {foodLogs.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl">
          <CardHeader className="pb-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between"
            >
              <CardTitle className="text-white text-base flex items-center gap-2">
                Comidas de hoy ({foodLogs.length})
              </CardTitle>
              {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
          </CardHeader>
          
          {showHistory && (
            <CardContent className="pt-0 space-y-2">
              {foodLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{log.food_name}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{log.calories} kcal</span>
                      <span>{log.protein_g}g P</span>
                      <span>{log.carbs_g}g C</span>
                      <span>{log.fat_g}g G</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFood(log.id)}
                    className="text-red-400 hover:bg-red-500/10 rounded-lg h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
