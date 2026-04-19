'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dumbbell, Apple, Plus, Trash2, Pencil as Edit, LoaderCircle as Loader2,
    ChevronRight, Target, Zap, Flame, Star, Search
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AdminContentTab({
    workoutTemplates,
    dietTemplates,
    onRefresh,
    onCreateWorkout,
    onCreateDiet,
    onDeleteWorkout,
    onDeleteDiet,
    onEditWorkout,
    onEditDiet
}) {
    const [activeSubTab, setActiveSubTab] = useState('workouts')
    const [searchTerm, setSearchTerm] = useState('')

    const filteredWorkouts = workoutTemplates.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredDiets = dietTemplates.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1a1a1a] p-4 rounded-3xl border border-white/5">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 w-full sm:w-auto">
                    <button
                        onClick={() => setActiveSubTab('workouts')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'workouts' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Dumbbell className="w-4 h-4" /> Entrenamientos
                    </button>
                    <button
                        onClick={() => setActiveSubTab('diets')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'diets' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Apple className="w-4 h-4" /> Nutrición
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder="Buscar plantillas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-black/40 border-white/10 text-white rounded-2xl h-11"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Creation Form Column */}
                <div className="lg:col-span-1">
                    <Card className="bg-white/5 border-white/10 rounded-3xl p-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                            {activeSubTab === 'workouts' ? <Dumbbell className="w-8 h-8 text-violet-400" /> : <Apple className="w-8 h-8 text-green-400" />}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            Nueva {activeSubTab === 'workouts' ? 'Rutina' : 'Dieta'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6 px-4">
                            Crea una nueva plantilla para asignar rápidamente a tus socios.
                        </p>
                        <Button
                            onClick={() => activeSubTab === 'workouts' ? onCreateWorkout?.() : onCreateDiet?.()}
                            className={`w-full py-6 rounded-2xl font-bold transition-all ${activeSubTab === 'workouts' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-green-600 hover:bg-green-500'}`}
                        >
                            <Plus className="w-5 h-5 mr-2" /> Empezar Constructor
                        </Button>
                    </Card>
                </div>

                {/* Templates List Column */}
                <div className="lg:col-span-2 space-y-4">
                    {activeSubTab === 'workouts' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredWorkouts.map(w => (
                                <Card key={w.id} className="bg-[#1a1a1a] border-white/5 rounded-2xl hover:border-violet-500/30 transition-all group overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-white text-lg">{w.name}</CardTitle>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => onEditWorkout?.(w)} className="text-gray-500 hover:text-violet-400">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDeleteWorkout?.(w.id)} className="text-gray-500 hover:text-red-400">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CardDescription className="line-clamp-2">{w.description || 'Sin descripción'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {w.trainer?.name || 'Sistema'}</span>
                                            <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full font-bold">PLANTILLA</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {filteredWorkouts.length === 0 && <EmptyState message="No hay plantillas de entrenamiento" />}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredDiets.map(d => (
                                <Card key={d.id} className="bg-[#1a1a1a] border-white/5 rounded-2xl hover:border-green-500/30 transition-all overflow-hidden">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-white text-lg">{d.name}</CardTitle>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => onEditDiet?.(d)} className="text-gray-500 hover:text-green-400">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDeleteDiet?.(d.id)} className="text-gray-500 hover:text-red-400">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-orange-500/10 p-2 rounded-xl text-center">
                                                <p className="text-lg font-bold text-white">{d.calories}</p>
                                                <p className="text-[10px] text-orange-400 font-bold uppercase">kcal</p>
                                            </div>
                                            <div className="bg-blue-500/10 p-2 rounded-xl text-center">
                                                <p className="text-lg font-bold text-white">{d.protein_g}g</p>
                                                <p className="text-[10px] text-blue-400 font-bold uppercase">Prot</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <span className="text-xs text-gray-600">Por {d.trainer?.name || 'Admin'}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-600" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {filteredDiets.length === 0 && <EmptyState message="No hay plantillas de dieta" />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function WorkoutCreationCard({ onSubmit }) {
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit?.({ name, description: desc })
        setName(''); setDesc('')
    }

    return (
        <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl sticky top-6">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-violet-400" /> Nueva Rutina
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Nombre del Programa</Label>
                        <Input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="Ej: Full Body - Definición"
                            className="bg-black/50 border-white/10 text-white rounded-xl"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-400">Descripción Corta</Label>
                        <Textarea
                            value={desc} onChange={e => setDesc(e.target.value)}
                            placeholder="Objetivos, días por semana..."
                            className="bg-black/50 border-white/10 text-white rounded-xl min-h-[100px]"
                        />
                    </div>
                    <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-6 font-bold mt-2">
                        Crear Plantilla
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

function DietCreationCard({ onSubmit }) {
    const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', content: '' })

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit?.(form)
        setForm({ name: '', calories: '', protein: '', carbs: '', fat: '', content: '' })
    }

    return (
        <Card className="bg-[#1a1a1a] border-green-500/20 rounded-3xl sticky top-6">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-400" /> Nueva Dieta
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Nombre de la Dieta</Label>
                        <Input
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Ej: Dieta Keto 2000"
                            className="bg-black/50 border-white/10 text-white rounded-xl"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-[10px] text-gray-500 uppercase font-bold">Calorías</Label>
                            <Input type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} className="bg-black/50 border-white/10 rounded-xl" required />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] text-gray-500 uppercase font-bold">Proteína (g)</Label>
                            <Input type="number" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })} className="bg-black/50 border-white/10 rounded-xl" required />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] text-gray-500 uppercase font-bold">Carbos (g)</Label>
                            <Input type="number" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })} className="bg-black/50 border-white/10 rounded-xl" required />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] text-gray-500 uppercase font-bold">Grasas (g)</Label>
                            <Input type="number" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} className="bg-black/50 border-white/10 rounded-xl" required />
                        </div>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-6 font-bold mt-2">
                        Crear Plantilla
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

function EmptyState({ message }) {
    return (
        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-dashed border-white/5">
            <Search className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500">{message}</p>
        </div>
    )
}
