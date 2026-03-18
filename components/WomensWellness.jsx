'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Droplets, Sparkles, Flame, Activity, Settings, Info, Battery, Utensils, Calendar } from 'lucide-react'

const phaseStyles = {
    menstrual: {
        id: 'menstrual',
        name: 'Menstrual',
        icon: Droplets,
        color: 'text-slate-300',
        bg: 'bg-slate-800',
        border: 'border-[#2a2a2a]',
        gradient: 'from-slate-800/80 to-slate-900/80',
        stateMsg: 'Fase de descanso y regeneración.',
        energy: 'Baja / Recuperación',
        energyDesc: 'El cuerpo necesita descanso. Prioriza la recuperación activa.',
        training: 'Prioriza movilidad, yoga o fuerza a baja intensidad.',
        recovery: 'Alta',
        adjustment: 0
    },
    follicular: {
        id: 'follicular',
        name: 'Folicular',
        icon: Sparkles,
        color: 'text-emerald-400',
        bg: 'bg-emerald-950',
        border: 'border-emerald-800/30',
        gradient: 'from-emerald-900/30 to-[#151515]',
        stateMsg: 'Niveles de energía en aumento.',
        energy: 'Alta / Creciente',
        energyDesc: 'Tu cuerpo suele tolerar mejor la intensidad en esta fase.',
        training: 'Buen momento para progresar en fuerza y alta intensidad.',
        recovery: 'Media-Alta',
        adjustment: 50
    },
    ovulation: {
        id: 'ovulation',
        name: 'Ovulación',
        icon: Flame,
        color: 'text-amber-400',
        bg: 'bg-amber-950',
        border: 'border-amber-800/30',
        gradient: 'from-amber-900/30 to-[#151515]',
        stateMsg: 'Pico de fuerza y rendimiento.',
        energy: 'Máxima',
        energyDesc: 'Niveles máximos de energía. Aprovecha este pico.',
        training: 'Aprovecha tu pico de fuerza, cuidando la técnica.',
        recovery: 'Media',
        adjustment: 100
    },
    luteal: {
        id: 'luteal',
        name: 'Lútea',
        icon: Activity,
        color: 'text-orange-400',
        bg: 'bg-orange-950',
        border: 'border-orange-800/30',
        gradient: 'from-orange-900/20 to-[#151515]',
        stateMsg: 'Metabolismo acelerado, preparación para el siguiente ciclo.',
        energy: 'Variable / Decreciente',
        energyDesc: 'Es normal notar más fatiga progresivamente. Aumenta la saciedad.',
        training: 'Intensidad moderada. Escucha a tu cuerpo si hay fatiga.',
        recovery: 'Media-Baja',
        adjustment: 125
    }
}

export default function WomensWellness({ profile, onUpdateProfile }) {
    const [stepsToday, setStepsToday] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showConfig, setShowConfig] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Config Form
    const [enabled, setEnabled] = useState(profile?.cycle_enabled || false)
    const [startDate, setStartDate] = useState(profile?.cycle_start_date || '')
    const [cycleLength, setCycleLength] = useState(profile?.cycle_length_days || 28)
    const [periodLength, setPeriodLength] = useState(profile?.period_length_days || 5)

    useEffect(() => {
        if (profile?.sex === 'female') {
            loadSteps()
        }
    }, [profile])

    const loadSteps = async () => {
        try {
            const today = new Date()
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

    const handleSaveConfig = async () => {
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    cycle_enabled: enabled,
                    cycle_start_date: startDate || null,
                    cycle_length_days: parseInt(cycleLength),
                    period_length_days: parseInt(periodLength)
                })
                .eq('id', profile.id)

            if (!error) {
                setShowConfig(false)
                onUpdateProfile?.()
            }
        } finally {
            setIsSaving(false)
        }
    }

    // Calculate Phase
    const getCycleInfo = () => {
        if (!profile?.cycle_start_date || !profile?.cycle_enabled) return null

        const start = new Date(profile.cycle_start_date)
        start.setHours(0, 0, 0, 0)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const diffTime = Math.abs(today - start)
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        const cLength = profile?.cycle_length_days || 28
        const pLength = profile?.period_length_days || 5

        const currentDay = (diffDays % cLength) + 1

        let phaseKey = 'luteal'
        if (currentDay <= pLength) phaseKey = 'menstrual'
        else if (currentDay <= 13) phaseKey = 'follicular'
        else if (currentDay <= 16) phaseKey = 'ovulation'

        return { day: currentDay, phase: phaseStyles[phaseKey] }
    }

    const cycleInfo = getCycleInfo()

    // Calculate Macros
    const weight = profile?.weight_kg || 65
    const baseCalories = weight * 30
    let stepCalories = 0
    if (stepsToday >= 15000) stepCalories = 300
    else if (stepsToday >= 10000) stepCalories = 200
    else if (stepsToday >= 5000) stepCalories = 100

    const phaseAdjustment = cycleInfo?.phase.adjustment || 0
    const finalCalories = Math.round(baseCalories + stepCalories + phaseAdjustment)

    const proteinGrams = Math.round(weight * 2.0)
    const fatGrams = Math.round(weight * 0.9)
    const carbCalories = finalCalories - (proteinGrams * 4) - (fatGrams * 9)
    const carbGrams = Math.max(0, Math.round(carbCalories / 4))

    if (profile?.sex !== 'female') return null

    // If not enabled or config missing, show just an onboarding card
    if (!profile?.cycle_enabled || !profile?.cycle_start_date) {
        return (
            <Card className="bg-[#111] border-[#2a2a2a] rounded-3xl overflow-hidden text-center py-16 shadow-lg">
                <Sparkles className="w-16 h-16 mx-auto text-slate-300 mb-6 opacity-80" strokeWidth={1.5} />
                <h2 className="text-3xl font-light text-white mb-3 tracking-tight">Bienestar Femenino</h2>
                <p className="text-slate-400 max-w-sm mx-auto mb-8 font-light text-base leading-relaxed">
                    Sincroniza tus entrenamientos con tu fisiología natural y optimiza tus resultados adaptando métricas a cada fase.
                </p>
                <Button onClick={() => setShowConfig(true)} className="bg-white text-black hover:bg-slate-200 rounded-2xl px-8 py-6 font-medium tracking-wide">
                    Configurar Perfil
                </Button>
                <ConfigModal
                    open={showConfig}
                    onOpenChange={setShowConfig}
                    enabled={enabled} setEnabled={setEnabled}
                    startDate={startDate} setStartDate={setStartDate}
                    cycleLength={cycleLength} setCycleLength={setCycleLength}
                    periodLength={periodLength} setPeriodLength={setPeriodLength}
                    onSave={handleSaveConfig}
                    isSaving={isSaving}
                />
            </Card>
        )
    }

    const { phase, day } = cycleInfo
    const Icon = phase.icon

    return (
        <div className="space-y-6 pb-6">
            <div className="flex items-center justify-between px-2 pt-2">
                <div>
                    <h2 className="text-2xl font-light text-white tracking-tight">Bienestar Femenino</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowConfig(true)} className="text-slate-400 hover:text-white rounded-full bg-[#1a1a1a] hover:bg-[#2a2a2a]">
                    <Settings className="w-5 h-5" />
                </Button>
            </div>

            {/* A. Card Principal */}
            <Card className={`bg-gradient-to-br ${phase.gradient} border ${phase.border} rounded-[2rem] overflow-hidden shadow-xl`}>
                <CardContent className="p-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-semibold tracking-[0.2em] uppercase mb-2">
                                Día {day} del ciclo
                            </p>
                            <h3 className={`text-4xl font-light text-white mb-2 tracking-tight`}>
                                Fase {phase.name}
                            </h3>
                            <p className={`${phase.color} text-base font-medium max-w-md opacity-90`}>
                                {phase.stateMsg}
                            </p>
                        </div>
                        <div className={`p-4 rounded-2xl bg-black/30 backdrop-blur-md`}>
                            <Icon className={`w-8 h-8 ${phase.color}`} strokeWidth={1.5} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* B. Card de Recomendaciones */}
                <Card className="bg-[#111] border-[#2a2a2a] rounded-[2rem] shadow-lg">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-slate-200 flex items-center gap-2 font-light text-lg">
                            <Utensils className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                            Nutrición Orientativa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <div className="flex justify-between items-end mb-8 pt-2">
                            <div>
                                <p className="text-slate-400 text-sm mb-1 font-light">Calorías Hoy</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-4xl font-light text-white tracking-tight">{finalCalories}</p>
                                    <span className="text-base font-light text-slate-500">kcal</span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="bg-[#1a1a1a] text-slate-400 text-[10px] px-2 py-1 rounded-md uppercase tracking-wider mb-1">Actividad</span>
                                <p className="text-slate-300 text-xs">+{stepCalories} kcal por {stepsToday} pasos</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#2a2a2a]/50 text-center">
                                <p className="text-slate-500 text-xs mb-1 font-medium">Bases</p>
                                <p className="text-xl font-light text-white">{proteinGrams}g</p>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className="h-full w-3/4 bg-slate-300 rounded-full"></div></div>
                            </div>
                            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#2a2a2a]/50 text-center">
                                <p className="text-slate-500 text-xs mb-1 font-medium">Grasas</p>
                                <p className="text-xl font-light text-white">{fatGrams}g</p>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className="h-full w-1/3 bg-slate-500 rounded-full"></div></div>
                            </div>
                            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#2a2a2a]/50 text-center">
                                <p className="text-slate-500 text-xs mb-1 font-medium">Carbos</p>
                                <p className="text-xl font-light text-white">{carbGrams}g</p>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className="h-full w-1/2 bg-slate-400 rounded-full"></div></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* C. Card de Energía / Estado */}
                <Card className="bg-[#111] border-[#2a2a2a] rounded-[2rem] shadow-lg flex flex-col justify-between">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-slate-200 flex items-center gap-2 font-light text-lg">
                            <Battery className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                            Estado y Esfuerzo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-4">
                        <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]/50">
                            <p className="text-slate-400 text-sm mb-1 font-light">Estimación de Energía</p>
                            <p className={`text-xl font-medium ${phase.color} tracking-tight`}>{phase.energy}</p>
                            <p className="text-slate-300 text-sm mt-2 font-light leading-relaxed">{phase.energyDesc}</p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]/50">
                            <p className="text-slate-400 text-sm mb-1 font-light">Enfoque de Entrenamiento</p>
                            <p className="text-white text-base font-light leading-relaxed">{phase.training}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* D. Aviso */}
            <div className="flex items-center gap-3 p-5 bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-sm opacity-80">
                <Info className="w-5 h-5 text-slate-500 shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-slate-400 font-light leading-relaxed w-full">
                    La información mostrada es orientativa y generada para propósitos de bienestar general. No sustituye el consejo médico, prescripción, diagnóstico o tratamiento de un profesional de la salud.
                </p>
            </div>

            <ConfigModal
                open={showConfig}
                onOpenChange={setShowConfig}
                enabled={enabled} setEnabled={setEnabled}
                startDate={startDate} setStartDate={setStartDate}
                cycleLength={cycleLength} setCycleLength={setCycleLength}
                periodLength={periodLength} setPeriodLength={setPeriodLength}
                onSave={handleSaveConfig}
                isSaving={isSaving}
            />
        </div>
    )
}

function ConfigModal({ open, onOpenChange, enabled, setEnabled, startDate, setStartDate, cycleLength, setCycleLength, periodLength, setPeriodLength, onSave, isSaving }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#111] border-[#2a2a2a] rounded-[2rem] max-w-sm sm:max-w-md p-8">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-light text-white tracking-tight">Configurar Ciclo</DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm font-light mt-2 leading-relaxed">
                        Ajusta los parámetros para mantener tus recomendaciones perfectamente sincronizadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-5 bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a]">
                        <div>
                            <Label className="text-white font-medium text-base">Activar Seguimiento</Label>
                            <p className="text-xs text-slate-400 mt-1 font-light">Habilitar recomendaciones dinámicas</p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} className="data-[state=checked]:bg-white" />
                    </div>

                    <div className={`space-y-5 transition-all duration-300 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-sm font-light">Fecha de inicio (último periodo)</Label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" strokeWidth={1.5} />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-12 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl h-12 font-light"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-sm font-light">Duración ciclo</Label>
                                <Input
                                    type="number"
                                    value={cycleLength}
                                    onChange={(e) => setCycleLength(e.target.value)}
                                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl h-12 px-4 font-light text-center"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-sm font-light">Duración periodo</Label>
                                <Input
                                    type="number"
                                    value={periodLength}
                                    onChange={(e) => setPeriodLength(e.target.value)}
                                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl h-12 px-4 font-light text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={onSave}
                        disabled={isSaving}
                        className="w-full bg-white text-black hover:bg-slate-200 rounded-xl h-14 font-medium tracking-wide text-base mt-4 transition-colors"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
