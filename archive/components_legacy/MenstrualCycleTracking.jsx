'use client'

import { useState, useEffect } from 'react'
import { Calendar, Droplets, Flame, Sparkles, Activity, Info, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'

export default function MenstrualCycleTracking({ profile, onUpdate }) {
    const [enabled, setEnabled] = useState(profile?.cycle_enabled || false)
    const [startDate, setStartDate] = useState(profile?.cycle_start_date || '')
    const [cycleLength, setCycleLength] = useState(profile?.cycle_length_days || 28)
    const [loading, setLoading] = useState(false)

    // Calcular fase actual
    const calculatePhase = () => {
        if (!startDate) return null
        const start = new Date(startDate)
        const today = new Date()
        const diffTime = Math.abs(today - start)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) % (cycleLength || 28)

        if (diffDays <= 5) return { name: 'Menstrual', icon: Droplets, color: 'text-rose-400', training: 'Baja intensidad, movilidad, yoga.', tips: 'Hidratación extra y descanso.' }
        if (diffDays <= 12) return { name: 'Folicular', icon: Sparkles, color: 'text-pink-400', training: 'Alta intensidad, fuerza máxima.', tips: 'Buen momento para entrenar fuerza.' }
        if (diffDays <= 15) return { name: 'Ovulación', icon: Flame, color: 'text-fuchsia-400', training: 'Pico de fuerza, cuidado con técnica.', tips: 'Aprovecha tu energía máxima.' }
        return { name: 'Lútea', icon: Activity, color: 'text-purple-400', training: 'Intensidad moderada, cardio estable.', tips: 'Mejora recuperación y sueño.' }
    }

    const phase = calculatePhase()

    const handleSave = async () => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    cycle_enabled: enabled,
                    cycle_start_date: startDate || null,
                    cycle_length_days: parseInt(cycleLength)
                })
                .eq('id', profile.id)

            if (!error) {
                onUpdate?.()
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-rose-500" />
                        Seguimiento de Bienestar
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="cycle-mode" className="text-xs text-gray-500">Activo</Label>
                        <Switch id="cycle-mode" checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                </div>
                <CardDescription className="text-gray-500">
                    Ajustes de entrenamiento según tu fase de bienestar
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {enabled ? (
                    <>
                        {phase && (
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-xl bg-black/40 ${phase.color}`}>
                                            <phase.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Fase Actual</p>
                                            <h4 className="text-xl font-bold text-white">{phase.name}</h4>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-black/40 p-3 rounded-xl">
                                        <p className="text-xs text-rose-400 font-semibold mb-1 uppercase">Entrenamiento</p>
                                        <p className="text-gray-300 text-sm">{phase.training}</p>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-xl border border-rose-500/10">
                                        <p className="text-xs text-fuchsia-400 font-semibold mb-1 uppercase">Sugerencia</p>
                                        <p className="text-gray-300 text-sm">{phase.tips}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label className="text-gray-400 text-xs">Último periodo</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-black/50 border-[#2a2a2a] text-white rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400 text-xs">Días de ciclo (aprox)</Label>
                                <Input
                                    type="number"
                                    value={cycleLength}
                                    onChange={(e) => setCycleLength(e.target.value)}
                                    className="bg-black/50 border-[#2a2a2a] text-white rounded-xl"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold rounded-xl py-6 shadow-lg shadow-rose-500/20"
                        >
                            {loading ? 'Guardando...' : 'Actualizar Configuración'}
                        </Button>

                        <div className="flex items-start gap-2 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                            <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                <strong>Aviso Importante:</strong> Esta herramienta está diseñada exclusivamente con fines de fitness y bienestar recreativo. No es un dispositivo médico, ni sustituye el diagnóstico, pronóstico, tratamiento o consejo de un profesional de la salud. Funciones de uso exclusivo para ajustes deportivos.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="py-10 text-center space-y-4">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                            <Droplets className="w-8 h-8 text-rose-500" />
                        </div>
                        <div className="max-w-xs mx-auto">
                            <p className="text-white font-medium">Sincroniza tu Bienestar</p>
                            <p className="text-gray-500 text-sm mt-1">Recibe ajustes en tus entrenamientos basados en las fases naturales de tu cuerpo (uso deportivo).</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setEnabled(true)}
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-xl"
                        >
                            Empezar ahora
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
