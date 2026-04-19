'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Apple, Plus, Trash2, Clock, UtensilsCrossed,
    Flame, Target, Zap, Star, Save, X, ChevronRight,
    ChevronLeft, Info, LoaderCircle as Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useSignedUrl } from '@/hooks/useStorage'

export function DietBuilder({ trainerId, existingDiet, onSave, onCancel }) {
    const [step, setStep] = useState(1) // 1: Basic & Macros, 2: Meals
    const [name, setName] = useState(existingDiet?.name || '')
    const [calories, setCalories] = useState(existingDiet?.calories || '')
    const [protein, setProtein] = useState(existingDiet?.protein_g || '')
    const [carbs, setCarbs] = useState(existingDiet?.carbs_g || '')
    const [fat, setFat] = useState(existingDiet?.fat_g || '')
    const [goalTag, setGoalTag] = useState(existingDiet?.goal_tag || 'maintain')
    const [levelTag, setLevelTag] = useState(existingDiet?.level_tag || 'intermediate')

    // Parse content for meals
    const initialMeals = (() => {
        try {
            if (existingDiet?.content) {
                const parsed = JSON.parse(existingDiet.content)
                if (parsed && parsed.meals) return parsed.meals
            }
        } catch (e) {
            console.warn("Content is not JSON, treating as text")
        }
        return [{ id: Date.now(), hour: '08:00', name: 'Desayuno', dishes: '' }]
    })()

    const [meals, setMeals] = useState(initialMeals)
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const handleAddMeal = () => {
        setMeals([...meals, { id: Date.now(), hour: '12:00', name: 'Nueva Comida', dishes: '' }])
    }

    const handleRemoveMeal = (id) => {
        setMeals(meals.filter(m => m.id !== id))
    }

    const handleUpdateMeal = (id, field, value) => {
        setMeals(meals.map(m => m.id === id ? { ...m, [field]: value } : m))
    }

    const handleFinalSave = async () => {
        if (!name) return toast({ title: "Falta el nombre" })

        setLoading(true)
        try {
            const dietData = {
                trainer_id: trainerId,
                name,
                calories: parseInt(calories) || 0,
                protein_g: parseInt(protein) || 0,
                carbs_g: parseInt(carbs) || 0,
                fat_g: parseInt(fat) || 0,
                goal_tag: goalTag,
                level_tag: levelTag,
                content: JSON.stringify({ meals }) // Structured JSON
            }

            let result;
            if (existingDiet?.id) {
                result = await supabase.from('diet_templates').update(dietData).eq('id', existingDiet.id)
            } else {
                result = await supabase.from('diet_templates').insert([dietData])
            }

            if (result.error) throw result.error

            toast({ title: existingDiet?.id ? "Dieta actualizada" : "Dieta creada" })
            onSave?.()
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#111112] text-white">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1a1b]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Apple className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Constructor de Dieta</h2>
                        <p className="text-xs text-gray-500 uppercase font-black tracking-widest">
                            Paso {step} de 2: {step === 1 ? 'Macros y Metas' : 'Plan de Comidas'}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full hover:bg-white/5">
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {step === 1 && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest border-l-2 border-green-500 pl-3">Información General</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-400">Nombre de la Plantilla</Label>
                                    <Input
                                        value={name} onChange={e => setName(e.target.value)}
                                        placeholder="Ej: Definición Summer 2026"
                                        className="bg-black/50 border-white/10 rounded-2xl h-12 focus:border-green-500/50"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-400">Objetivo</Label>
                                        <Select value={goalTag} onValueChange={setGoalTag}>
                                            <SelectTrigger className="bg-black/50 border-white/10 rounded-2xl h-12">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#1a1a1a] border-white/10">
                                                <SelectItem value="fat_loss">Pérdida de Grasa</SelectItem>
                                                <SelectItem value="maintain">Mantenimiento</SelectItem>
                                                <SelectItem value="muscle_gain">Ganancia Muscular</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-400">Nivel</Label>
                                        <Select value={levelTag} onValueChange={setLevelTag}>
                                            <SelectTrigger className="bg-black/50 border-white/10 rounded-2xl h-12">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#1a1a1a] border-white/10">
                                                <SelectItem value="beginner">Principiante</SelectItem>
                                                <SelectItem value="intermediate">Intermedio</SelectItem>
                                                <SelectItem value="advanced">Avanzado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Macros */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest border-l-2 border-green-500 pl-3">Objetivos Nutricionales (Macros)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-orange-400">
                                        <Flame className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase">Energía</span>
                                    </div>
                                    <Input
                                        type="number" value={calories} onChange={e => setCalories(e.target.value)}
                                        placeholder="0" className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0"
                                    />
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">kcal totales</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-blue-400">
                                        <Target className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase">Proteína</span>
                                    </div>
                                    <Input
                                        type="number" value={protein} onChange={e => setProtein(e.target.value)}
                                        placeholder="0" className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0"
                                    />
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">gramos</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-yellow-500">
                                        <Zap className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase">Carbos</span>
                                    </div>
                                    <Input
                                        type="number" value={carbs} onChange={e => setCarbs(e.target.value)}
                                        placeholder="0" className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0"
                                    />
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">gramos</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-purple-400">
                                        <Star className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase">Grasas</span>
                                    </div>
                                    <Input
                                        type="number" value={fat} onChange={e => setFat(e.target.value)}
                                        placeholder="0" className="bg-transparent border-none text-2xl font-bold p-0 h-auto focus-visible:ring-0"
                                    />
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">gramos</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* Meals List */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest border-l-2 border-green-500 pl-3">Distribución de Comidas</h3>
                            <Button onClick={handleAddMeal} variant="outline" className="rounded-2xl border-green-500/20 text-green-400 hover:bg-green-500/10">
                                <Plus className="w-4 h-4 mr-2" /> Añadir Comida
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {meals.map((meal, index) => (
                                <Card key={meal.id} className="bg-black/40 border-white/5 rounded-3xl overflow-hidden group">
                                    <CardContent className="p-0">
                                        <div className="flex flex-col md:flex-row">
                                            {/* Time & Title Sidebar */}
                                            <div className="md:w-48 bg-white/5 p-6 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-white/5">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Hora</Label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400/50" />
                                                        <Input
                                                            type="time" value={meal.hour}
                                                            onChange={e => handleUpdateMeal(meal.id, 'hour', e.target.value)}
                                                            className="bg-black/50 border-white/10 rounded-xl pl-9 h-10 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Título</Label>
                                                    <Input
                                                        value={meal.name}
                                                        onChange={e => handleUpdateMeal(meal.id, 'name', e.target.value)}
                                                        placeholder="Desayuno..."
                                                        className="bg-black/50 border-white/10 rounded-xl h-10 text-xs font-bold"
                                                    />
                                                </div>
                                            </div>

                                            {/* Dishes Area */}
                                            <div className="flex-1 p-6 relative">
                                                <Label className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-2 block">Platos Recomendados / Alimentos</Label>
                                                <Textarea
                                                    value={meal.dishes}
                                                    onChange={e => handleUpdateMeal(meal.id, 'dishes', e.target.value)}
                                                    placeholder="Ej: 150g de Pollo + 200g Arroz + Ensalada verde..."
                                                    className="bg-black/20 border-white/5 rounded-2xl min-h-[100px] text-sm focus:border-green-500/30 resize-none"
                                                />
                                                <button
                                                    onClick={() => handleRemoveMeal(meal.id)}
                                                    className="absolute top-4 right-4 text-gray-700 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {meals.length === 0 && (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/2">
                                <UtensilsCrossed className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500">No hay comidas añadidas aún.</p>
                                <Button onClick={handleAddMeal} variant="link" className="text-green-500 mt-2">Crear primera comida</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Navigation */}
            <div className="p-6 border-t border-white/5 bg-[#1a1a1b] flex items-center justify-between">
                <div>
                    {step === 2 && (
                        <Button variant="ghost" onClick={() => setStep(1)} className="rounded-2xl text-gray-400">
                            <ChevronLeft className="w-4 h-4 mr-2" /> Atrás
                        </Button>
                    )}
                </div>
                <div className="flex gap-3">
                    {step === 1 ? (
                        <Button
                            onClick={() => setStep(2)}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 rounded-2xl h-12"
                        >
                            Siguiente: Comidas <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinalSave}
                            disabled={loading}
                            className="bg-gradient-to-r from-green-600 to-teal-600 hover:opacity-90 text-white font-bold px-10 rounded-2xl h-12 shadow-lg shadow-green-500/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {existingDiet?.id ? 'Guardar Cambios' : 'Finalizar y Crear'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function DietViewer({ dietId }) {
    const [diet, setDiet] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (dietId) loadDiet()
    }, [dietId])

    const loadDiet = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('diet_templates')
            .select('*')
            .eq('id', dietId)
            .single()

        if (data) {
            try {
                const parsed = JSON.parse(data.content)
                setDiet({ ...data, meals: parsed.meals || [] })
            } catch (e) {
                setDiet({ ...data, meals: [], rawContent: data.content })
            }
        }
        setLoading(false)
    }

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
    if (!diet) return <div className="py-20 text-center text-gray-500 italic">No se encontró la dieta.</div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Summary Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-orange-500/10 p-4 rounded-[24px] border border-orange-500/20 text-center">
                    <Flame className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">{diet.calories}</p>
                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-tighter">Calorías</p>
                </div>
                <div className="bg-blue-500/10 p-4 rounded-[24px] border border-blue-500/20 text-center">
                    <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">{diet.protein_g}g</p>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Proteína</p>
                </div>
                <div className="bg-yellow-500/10 p-4 rounded-[24px] border border-yellow-500/20 text-center">
                    <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">{diet.carbs_g}g</p>
                    <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-tighter">Carbos</p>
                </div>
                <div className="bg-purple-500/10 p-4 rounded-[24px] border border-purple-500/20 text-center">
                    <Star className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">{diet.fat_g}g</p>
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Grasas</p>
                </div>
            </div>

            {/* Timeline of Meals */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Horario y Platos
                </h3>

                <div className="space-y-0 relative border-l border-white/5 ml-3 pl-8">
                    {diet.meals?.map((meal, idx) => (
                        <div key={idx} className="relative pb-8 last:pb-0">
                            {/* Dot */}
                            <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-black border-2 border-green-500 flex items-center justify-center shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-green-400 font-black text-sm">{meal.hour}</span>
                                    <h4 className="text-lg font-bold text-white">{meal.name}</h4>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-5 border border-white/5 transition-all hover:border-green-500/20 group">
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <UtensilsCrossed className="w-5 h-5 text-gray-600 group-hover:text-green-500/50 transition-colors" />
                                        </div>
                                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                                            {meal.dishes || 'Sin platos especificados'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(!diet.meals || diet.meals.length === 0) && diet.rawContent && (
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Descripción de la Dieta</h4>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{diet.rawContent}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Note */}
            <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10 flex gap-3">
                <Info className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed italic">
                    Recuerda que estas macros son un objetivo diario. Intenta ser lo más preciso posible con los pesos de los alimentos para maximizar tus resultados.
                </p>
            </div>
        </div>
    )
}
