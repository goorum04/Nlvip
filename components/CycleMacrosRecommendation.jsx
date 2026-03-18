'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Apple, Activity, Flame, Droplets, Info } from 'lucide-react'

export default function CycleMacrosRecommendation({ profile }) {
    const [macrosData, setMacrosData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile?.sex === 'female' && profile?.cycle_enabled) {
            loadMacrosData()
        }
    }, [profile])

    const loadMacrosData = async () => {
        try {
            const today = new Date()
            const dateString = today.toISOString().split('T')[0]

            const { data, error } = await supabase.rpc('rpc_get_daily_macros_summary', { p_date: dateString })

            if (data) {
                setMacrosData(data)
            }
        } catch (e) {
            console.error('Error loading unified macros:', e)
        } finally {
            setLoading(false)
        }
    }

    if (!profile?.sex === 'female' || !profile?.cycle_enabled || loading || !macrosData) {
        return null
    }

    const { assigned: finalMacros, phase, activity } = macrosData
    const stepsToday = activity?.steps || 0
    const finalCalories = finalMacros?.calories || 0
    const proteinGrams = finalMacros?.protein_g || 0
    const fatGrams = finalMacros?.fat_g || 0
    const carbGrams = finalMacros?.carbs_g || 0

    // Ajuste y comentarios según fase
    let recTraining = ''
    let macroNote = ''

    if (phase?.id === 'menstrual') {
        recTraining = 'Mantén o reduce ligeramente la intensidad. Prioriza descanso y buena hidratación.'
        macroNote = 'No es el mejor momento para un déficit agresivo.'
    } else if (phase?.id === 'follicular') {
        recTraining = 'Mejor tolerancia al esfuerzo. Buen momento para ganar músculo y rendir alto.'
        macroNote = 'Prioriza carbohidratos alrededor del entrenamiento.'
    } else if (phase?.id === 'ovulation') {
        recTraining = 'Pico de rendimiento de fuerza/potencia. Cuidado con ligamentos por la laxitud.'
        macroNote = 'Fase ideal para rendir alto. Mantén los carbohidratos estables.'
    } else if (phase?.id === 'luteal') {
        recTraining = 'Es normal notar más fatiga en esta fase. Prioriza buena recuperación y baja un poco la intensidad si lo necesitas.'
        macroNote = 'Aumento natural de energía: El sistema ha incrementado tus calorías un poco para esta fase.'
    } else {
        recTraining = 'Mantén la constancia en el entrenamiento.'
        macroNote = 'Ajusta la nutrición a tus objetivos de vida.'
    }

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
