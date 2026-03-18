'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Apple, Activity, Flame, Droplets, Info } from 'lucide-react'

export default function CycleMacrosRecommendation({ profile }) {
    const [stepsToday, setStepsToday] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile?.sex === 'female' && profile?.cycle_enabled) {
            loadSteps()
        }
    }, [profile])

    const loadSteps = async () => {
        try {
            // Get today's UTC date start in YYYY-MM-DD format based on local time
            const today = new Date()
            // Create local ISO string date
            const d = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
            const dateString = d.toISOString().split('T')[0]

            const { data } = await supabase
                .from('daily_activity')
                .select('steps')
                .eq('member_id', profile.id)
                .eq('activity_date', dateString)
                .single()

            if (data) {
                setStepsToday(data.steps || 0)
            }
        } catch (e) {
            console.log('No steps data found for today')
        } finally {
            setLoading(false)
        }
    }

    // Si no es mujer o no tiene activado el ciclo, no mostramos nada
    if (profile?.sex !== 'female' || !profile?.cycle_enabled) {
        return null
    }

    const calculatePhase = () => {
        if (!profile.cycle_start_date) return null

        const start = new Date(profile.cycle_start_date)
        start.setHours(0, 0, 0, 0)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const diffTime = Math.abs(today - start)
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        const cycleLength = profile.cycle_length_days || 28
        const periodLength = profile.period_length_days || 5

        // Current day of the cycle (1-indexed)
        const currentDay = (diffDays % cycleLength) + 1

        if (currentDay <= periodLength) return { id: 'menstrual', name: 'Menstrual', day: currentDay, color: 'text-rose-400', bg: 'bg-rose-500/10' }
        if (currentDay <= 13) return { id: 'follicular', name: 'Folicular', day: currentDay, color: 'text-pink-400', bg: 'bg-pink-500/10' }
        if (currentDay <= 16) return { id: 'ovulation', name: 'Ovulación', day: currentDay, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' }
        return { id: 'luteal', name: 'Lútea', day: currentDay, color: 'text-purple-400', bg: 'bg-purple-500/10' }
    }

    const phase = calculatePhase()

    // Calcular recomendaciones
    // Peso base orientativo, si no hay peso en perfil, usamos un promedio (ej. 65kg)
    const weight = profile.weight_kg || 65

    // Mantenimiento orientativo = weight * 30
    const baseCalories = weight * 30

    // Ajuste por pasos diarios
    let stepCalories = 0
    if (stepsToday >= 15000) stepCalories = 300
    else if (stepsToday >= 10000) stepCalories = 200
    else if (stepsToday >= 5000) stepCalories = 100

    // Ajuste y comentarios según fase
    let phaseAdjustment = 0
    let recTraining = ''
    let macroNote = ''

    if (phase?.id === 'menstrual') {
        phaseAdjustment = 0
        recTraining = 'Mantén o reduce ligeramente la intensidad. Prioriza descanso y buena hidratación.'
        macroNote = 'No es el mejor momento para un déficit agresivo.'
    } else if (phase?.id === 'follicular') {
        phaseAdjustment = 50
        recTraining = 'Mejor tolerancia al esfuerzo. Buen momento para ganar músculo y rendir alto.'
        macroNote = 'Prioriza carbohidratos alrededor del entrenamiento.'
    } else if (phase?.id === 'ovulation') {
        phaseAdjustment = 100
        recTraining = 'Pico de rendimiento de fuerza/potencia. Cuidado con ligamentos por la laxitud.'
        macroNote = 'Fase ideal para rendir alto. Mantén los carbohidratos estables.'
    } else if (phase?.id === 'luteal') {
        phaseAdjustment = 125 // Entre 100 y 150
        recTraining = 'Es normal notar más fatiga en esta fase. Prioriza buena recuperación y baja un poco la intensidad si lo necesitas.'
        macroNote = 'Aumenta la saciedad, mantén la proteína alta y equilibra los carbohidratos.'
    } else {
        // Si no hay fase calculada
        recTraining = 'Mantén la constancia en el entrenamiento.'
        macroNote = 'Ajusta la nutrición a tus objetivos de vida.'
    }

    const finalCalories = Math.round(baseCalories + stepCalories + phaseAdjustment)

    // Macros (orientativo)
    const proteinGrams = Math.round(weight * 2.0) // 2.0g/kg
    const fatGrams = Math.round(weight * 0.9) // 0.9g/kg
    const carbCalories = finalCalories - (proteinGrams * 4) - (fatGrams * 9)
    const carbGrams = Math.max(0, Math.round(carbCalories / 4))

    if (loading || !phase) return null

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden mb-6">
            <CardHeader className="pb-4 border-b border-[#2a2a2a]">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Apple className="w-5 h-5 text-rose-400" />
                            Ajuste de Bienestar
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                            Estimación nutricional según fase deportiva
                        </CardDescription>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${phase.bg} ${phase.color}`}>
                        Fase {phase.name}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-5 space-y-6">
                {/* Resumen de variables */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>Pasos hoy: <strong className="text-white">{stepsToday.toLocaleString('es-ES')}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span>Calorías: <strong className="text-white">{finalCalories} kcal</strong></span>
                    </div>
                </div>

                {/* Cajas de Macros */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-[#2a2a2a] rounded-2xl p-3 text-center transition-all hover:border-violet-500/30">
                        <p className="text-xs text-gray-500 font-medium mb-1">Proteínas</p>
                        <p className="text-xl font-black text-violet-400">{proteinGrams}g</p>
                    </div>
                    <div className="bg-black/30 border border-[#2a2a2a] rounded-2xl p-3 text-center transition-all hover:border-violet-500/30">
                        <p className="text-xs text-gray-500 font-medium mb-1">Grasas</p>
                        <p className="text-xl font-black text-amber-400">{fatGrams}g</p>
                    </div>
                    <div className="bg-black/30 border border-[#2a2a2a] rounded-2xl p-3 text-center transition-all hover:border-violet-500/30">
                        <p className="text-xs text-gray-500 font-medium mb-1">Carbohidratos</p>
                        <p className="text-xl font-black text-cyan-400">{carbGrams}g</p>
                    </div>
                </div>

                {/* Insight / Consejo */}
                <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-2xl p-4">
                    <p className="text-sm text-gray-200 leading-relaxed mb-2">
                        <strong className="text-rose-400">Enfoque Deportivo:</strong> {recTraining}
                    </p>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        {macroNote}
                    </p>
                </div>

                {/* Mandatory Warning Note */}
                <div className="flex items-start gap-2 pt-2 border-t border-[#2a2a2a]/50">
                    <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500 leading-tight">
                        <strong>Aviso Importante:</strong> La información mostrada es una estimación orientativa generada para métricas recreativas e informativas de fitness. Al no ser un dispositivo médico, no sustituye la opinión o asesoramiento de especialistas, dietistas, o nutricionistas, de acuerdo a las políticas del servicio.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
