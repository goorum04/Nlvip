'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
    Baby, Heart, Milk, Timer, Plus, TrendingUp,
    Clock, Loader2, ChevronLeft, ChevronRight,
    Droplets, BarChart3, AlertCircle, Sparkles, Settings
} from 'lucide-react'

// =============================================================
// LIFE STAGE SELECTOR — Selector de etapa de vida
// =============================================================
export function LifeStageSelector({ userId, profile, onUpdate }) {
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const stages = [
        { value: 'cycle', emoji: '🌸', label: 'Ciclo', desc: 'Seguimiento menstrual' },
        { value: 'pregnant', emoji: '🤰', label: 'Embarazo', desc: 'Gestación' },
        { value: 'postpartum', emoji: '👶', label: 'Postparto', desc: '0-12 meses' },
        { value: 'lactating', emoji: '🤱', label: 'Lactancia', desc: 'Control de tomas' },
    ]

    const handleSelect = async (stage) => {
        if (profile?.life_stage === stage) return
        setSaving(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: userId,
                    updates: { life_stage: stage, updated_at: new Date().toISOString() }
                })
            })
            const data = await res.json()
            const error = data.error

            if (error) throw error
            onUpdate?.({ ...profile, life_stage: stage })
            toast({ title: `✅ Modo ${stages.find(s => s.value === stage)?.label} activado` })
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-[#0B0B0B]/40 backdrop-blur-xl border-white/5 rounded-[2.5rem]">
            <CardHeader className="p-6 pb-2">
                <CardTitle className="text-xs font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Etapa Actual
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-wrap">
                    {stages.map(stage => (
                        <button
                            key={stage.value}
                            onClick={() => handleSelect(stage.value)}
                            disabled={saving}
                            className={`group relative flex-shrink-0 flex items-center gap-3 p-3 px-5 rounded-2xl border transition-all duration-500 overflow-hidden ${profile?.life_stage === stage.value
                                ? 'bg-white/10 border-white/20 shadow-lg'
                                : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                }`}
                        >
                            {profile?.life_stage === stage.value && (
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-pink-500/20 opacity-50 animate-pulse-gentle" />
                            )}
                            <div className="relative z-10 flex items-center gap-2">
                                <span className={`text-xl transition-transform duration-500 group-hover:scale-110 ${profile?.life_stage === stage.value ? 'scale-110' : ''}`}>
                                    {stage.emoji}
                                </span>
                                <div>
                                    <div className={`text-[10px] font-black tracking-tight uppercase ${profile?.life_stage === stage.value ? 'text-white' : 'text-white/40'}`}>
                                        {stage.label}
                                    </div>
                                    <div className="text-[8px] text-white/20 font-bold uppercase tracking-tighter hidden sm:block">
                                        {stage.desc}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

// =============================================================
// PREGNANCY MODE — Modo Embarazo
// =============================================================
export function PregnancyMode({ userId, profile, onUpdate, onThemeChange }) {
    const [showConfig, setShowConfig] = useState(false)
    const [dueDate, setDueDate] = useState(profile?.due_date || '')
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const getPregnancyWeek = () => {
        if (!profile?.due_date) return null
        const due = new Date(profile.due_date)
        const today = new Date()
        const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
        const daysPregnant = 280 - daysUntilDue
        return Math.max(1, Math.min(42, Math.floor(daysPregnant / 7)))
    }

    const week = getPregnancyWeek()

    const getWeekInfo = (w) => {
        if (!w) return null
        if (w <= 12) return { trimester: 1, emoji: '🌱', desc: 'Primer trimestre — Desarrollo inicial', exercise: 'Caminar, yoga prenatal suave, natación' }
        if (w <= 27) return { trimester: 2, emoji: '🌸', desc: 'Segundo trimestre — Etapa de energía', exercise: 'Yoga prenatal, pilates adaptado, natación, caminar' }
        return { trimester: 3, emoji: '🌺', desc: 'Tercer trimestre — Preparación', exercise: 'Caminar suave, ejercicios de suelo pélvico, respiración' }
    }

    const info = getWeekInfo(week)

    // Notify theme change
    useEffect(() => {
        if (onThemeChange) {
            onThemeChange('pregnant')
        }
    }, [onThemeChange])

    const handleSave = async () => {
        if (!dueDate) return
        setSaving(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: userId,
                    updates: { due_date: dueDate, updated_at: new Date().toISOString() }
                })
            })
            const data = await res.json()
            const error = data.error
            if (error) throw error
            onUpdate?.({ ...profile, due_date: dueDate })
            toast({ title: '✅ Fecha guardada' })
            setShowConfig(false)
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-[#0B0B0B]/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] shadow-2xl">
            <div className="relative p-8">
                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-transparent opacity-50 header-gradient" />
                
                <div className="relative">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/10">
                                <Baby className="w-7 h-7 text-rose-400 animate-bounce-slow" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Embarazo Elite</span>
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    {week ? `Semana ${week}` : 'Configuración'}
                                </h3>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowConfig(true)}
                            className="rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 border border-white/5"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>

                    {info && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-white/5 rounded-[1.5rem] p-4 border border-white/5">
                                <span className="text-4xl">{info.emoji}</span>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Estado Actual</p>
                                    <p className="text-sm text-white/80 font-medium leading-relaxed">{info.desc}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] text-white/30 font-black uppercase tracking-tighter italic">{week}/40 semanas</span>
                                    <span className="text-xs font-black text-rose-400 capitalize">Trimestre {info.trimester}</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/5 p-0.5">
                                    <div
                                        className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                                        style={{ width: `${Math.min(100, ((week || 0) / 40) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {info && (
                <CardContent className="p-6 bg-white/[0.02] border-t border-white/5 space-y-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-2">Entrenamiento Seguro</p>
                        <p className="text-xs text-white/70 font-medium leading-relaxed">{info.exercise}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-rose-400/60 uppercase tracking-widest mb-1 italic">Evitar</p>
                            <p className="text-[10px] text-white/40 leading-tight">Esfuerzos hiperpresivos y saltos.</p>
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mb-1 italic">Hidratación</p>
                            <p className="text-[10px] text-white/40 leading-tight">+300ml extra diarios.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-white/[0.01] rounded-2xl border border-white/5">
                        <AlertCircle className="w-4 h-4 text-white/10 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-white/20 italic leading-relaxed">
                            Consulta siempre con tu especialista antes de entrenar. Esta guía es exclusivamente informativa.
                        </p>
                    </div>
                </CardContent>
            )}

            {!info && (
                <CardContent className="p-4">
                    <Button
                        onClick={() => setShowConfig(true)}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl"
                    >
                        <Baby className="w-4 h-4 mr-2" />
                        Introducir fecha probable de parto
                    </Button>
                </CardContent>
            )}

            <Dialog open={showConfig} onOpenChange={() => setShowConfig(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Baby className="w-5 h-5 text-rose-400" /> Fecha probable de parto
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-gray-300">Fecha probable de parto (FPP)</Label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="mt-2 bg-gray-800 border-gray-700 text-white rounded-xl"
                        />
                        <p className="text-xs text-gray-500 mt-2">Puedes obtenerla en tu primera ecografía o calculándola desde la última menstruación.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfig(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !dueDate} className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// =============================================================
// POSTPARTUM MODE — Modo Postparto
// =============================================================
export function PostpartumMode({ userId, profile, onUpdate, onThemeChange }) {
    const [showConfig, setShowConfig] = useState(false)
    const [birthDate, setBirthDate] = useState(profile?.postpartum_date || '')
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const getPostpartumWeeks = () => {
        if (!profile?.postpartum_date) return null
        const birth = new Date(profile.postpartum_date)
        const today = new Date()
        const days = Math.floor((today - birth) / (1000 * 60 * 60 * 24))
        return Math.floor(days / 7)
    }

    const weeks = getPostpartumWeeks()

    const getPhase = (w) => {
        if (w === null) return null
        if (w < 1) return { label: 'Primeros días', color: 'from-violet-500/20 to-pink-500/10', exercises: ['Solo descanso', 'Respiración diafragmática', 'Contracciones suaves del suelo pélvico'], warnings: ['No hacer ningún esfuerzo físico', 'Reposo absoluto 24-48h'] }
        if (w <= 6) return { label: `Semanas 1-6`, color: 'from-rose-500/20 to-orange-500/10', exercises: ['Caminar suave 10-15 min', 'Ejercicios de Kegel', 'Respiración hipopresiva'], warnings: ['Sin abdominales convencionales', 'Sin correr ni saltar', 'Sin cargas pesadas'] }
        if (w <= 12) return { label: `Semanas 6-12`, color: 'from-orange-500/20 to-amber-500/10', exercises: ['Pilates postparto', 'Hipopresivos', 'Caminar 30 min', 'Inicio fuerza suave'], warnings: ['Evitar si hay diástasis sin tratar', 'Consultar fisioterapeuta suelo pélvico'] }
        return { label: `Semanas 12+`, color: 'from-green-500/20 to-teal-500/10', exercises: ['Entrenamiento de fuerza progresivo', 'Cardio moderado', 'Yoga', 'HIIT suave si hay alta'], warnings: ['Atención a posible diástasis de recto'] }
    }

    const phase = getPhase(weeks)

    // Notify theme change
    useEffect(() => {
        if (onThemeChange) {
            onThemeChange('postpartum')
        }
    }, [onThemeChange])

    const handleSave = async () => {
        if (!birthDate) return
        setSaving(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: userId,
                    updates: { postpartum_date: birthDate, updated_at: new Date().toISOString() }
                })
            })
            const data = await res.json()
            const error = data.error
            if (error) throw error
            onUpdate?.({ ...profile, postpartum_date: birthDate })
            toast({ title: '✅ Fecha guardada' })
            setShowConfig(false)
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-[#0B0B0B]/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] shadow-2xl">
            <div className="relative p-8">
                {/* Ambient Glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${phase?.color || 'from-violet-500/10 to-pink-500/5'} opacity-40 header-gradient`} />
                
                <div className="relative">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/10">
                                <Heart className="w-7 h-7 text-violet-400 animate-pulse-gentle" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Postparto Elite</span>
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    {weeks !== null ? `Semana ${weeks}` : 'Configuración'}
                                </h3>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowConfig(true)}
                            className="rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 border border-white/5"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>

                    {phase && (
                        <div className="space-y-6">
                            <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
                                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Fase Actual</p>
                                <p className="text-lg font-bold text-white tracking-tight">{phase.label}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-3">Ejercicios Recomendados</p>
                                    <div className="space-y-2">
                                        {phase.exercises.map((ex, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                                                <p className="text-xs text-white/60 font-medium">{ex}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-rose-400/60 uppercase tracking-widest mb-3">Precauciones Hoy</p>
                                    <div className="space-y-2">
                                        {phase.warnings.map((w, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-rose-500/40" />
                                                <p className="text-xs text-white/40 font-medium">{w}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-white/[0.01] rounded-2xl border border-white/5">
                                <AlertCircle className="w-4 h-4 text-white/10 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-white/20 italic leading-relaxed font-medium">
                                    Visita a un especialista en suelo pélvico. Esta información es puramente orientativa.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {weeks === null && (
                <CardContent className="p-4">
                    <Button onClick={() => setShowConfig(true)} className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-2xl">
                        <Heart className="w-4 h-4 mr-2" /> Introducir fecha del parto
                    </Button>
                </CardContent>
            )}

            <Dialog open={showConfig} onOpenChange={() => setShowConfig(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Heart className="w-5 h-5 text-violet-400" /> Fecha del parto
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-gray-300">¿Cuándo nació tu bebé?</Label>
                        <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="mt-2 bg-gray-800 border-gray-700 text-white rounded-xl" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfig(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !birthDate} className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// =============================================================
// LACTATION TRACKER — Registro de tomas de lactancia
// =============================================================
export function LactationTracker({ userId, onThemeChange }) {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const [form, setForm] = useState({
        session_type: 'breastfeed',
        breast_side: 'left',
        start_time: new Date().toISOString().slice(0, 16),
        duration_minutes: '',
        amount_ml: '',
        notes: ''
    })

    const loadSessions = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from('lactation_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('start_time', { ascending: false })
                .limit(20)
            if (data) setSessions(data)
        } catch {
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSessions()
        if (onThemeChange) {
            onThemeChange('lactating')
        }
    }, [userId, onThemeChange])

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from('lactation_sessions').insert([{
                user_id: userId,
                session_type: form.session_type,
                breast_side: form.breast_side || null,
                start_time: new Date(form.start_time).toISOString(),
                duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
                amount_ml: form.amount_ml ? parseInt(form.amount_ml) : null,
                notes: form.notes || null
            }])
            if (error) throw error
            toast({ title: '✅ Toma registrada' })
            setShowAdd(false)
            setForm({ session_type: 'breastfeed', breast_side: 'left', start_time: new Date().toISOString().slice(0, 16), duration_minutes: '', amount_ml: '', notes: '' })
            loadSessions()
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // Calcular estadísticas de hoy
    const today = new Date().toDateString()
    const todaySessions = sessions.filter(s => new Date(s.start_time).toDateString() === today)
    const todayMinutes = todaySessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
    const todayMl = todaySessions.reduce((a, s) => a + (s.amount_ml || 0), 0)

    const SESSION_LABELS = { breastfeed: '🤱 Pecho', pump: '🍼 Extracción', bottle: '🍶 Biberón' }
    const SIDE_LABELS = { left: '← Izquierdo', right: 'Derecho →', both: '↔ Ambos' }

    return (
        <Card className="bg-[#0B0B0B]/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] shadow-2xl">
            <CardHeader className="p-8 pb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50 header-gradient" />
                <div className="relative flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Lactancia Elite</span>
                        </div>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">Registro</CardTitle>
                    </div>
                    <Button
                        onClick={() => setShowAdd(true)}
                        size="icon"
                        className="w-12 h-12 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-2xl border border-blue-500/20 shadow-xl shadow-blue-500/10"
                    >
                        <Plus className="w-6 h-6" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="px-8 pb-8 space-y-6 relative z-10">
                {/* Stats Modernas */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Tomas', value: todaySessions.length, suffix: '', sub: 'Hoy' },
                        { label: 'Tiempo', value: todayMinutes, suffix: 'm', sub: 'Total' },
                        { label: 'Volumen', value: todayMl || '-', suffix: 'ml', sub: 'Extraído' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-center">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-2">{s.label}</p>
                            <p className="text-2xl font-black text-white">{s.value}<span className="text-xs text-white/20 font-bold ml-0.5">{s.suffix}</span></p>
                            <p className="text-[8px] font-bold text-white/10 uppercase mt-1">{s.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Lista de sesiones recientes */}
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-4">Aún no hay registros</p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-widest pl-1">Actividad Reciente</p>
                        {sessions.slice(0, 5).map(s => (
                            <div key={s.id} className="group flex items-center gap-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-3xl p-4 transition-all duration-300">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                                    {s.session_type === 'breastfeed' ? '🤱' : s.session_type === 'pump' ? '🍼' : '🍶'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-white/90">{SESSION_LABELS[s.session_type]}</p>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                                        {new Date(s.start_time).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {s.breast_side && ` · ${SIDE_LABELS[s.breast_side]}`}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {s.duration_minutes && (
                                        <span className="text-[10px] font-black text-white/40 bg-white/5 px-2 py-1 rounded-lg border border-white/5">{s.duration_minutes}m</span>
                                    )}
                                    {s.amount_ml && (
                                        <span className="text-[10px] font-black text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/10">{s.amount_ml}ml</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Modal añadir toma */}
            <Dialog open={showAdd} onOpenChange={() => setShowAdd(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Milk className="w-5 h-5 text-blue-400" /> Nueva toma
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Tipo */}
                        <div>
                            <Label className="text-gray-300 text-xs mb-2 block">Tipo</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'breastfeed', label: '🤱', desc: 'Pecho' },
                                    { value: 'pump', label: '🍼', desc: 'Extracción' },
                                    { value: 'bottle', label: '🍶', desc: 'Biberón' },
                                ].map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setForm(f => ({ ...f, session_type: t.value }))}
                                        className={`p-2 rounded-xl border text-center transition-all ${form.session_type === t.value
                                            ? 'bg-blue-500/20 border-blue-500 text-white'
                                            : 'border-gray-700 text-gray-500'
                                            }`}
                                    >
                                        <div className="text-xl">{t.label}</div>
                                        <div className="text-[10px]">{t.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lado */}
                        {form.session_type !== 'bottle' && (
                            <div>
                                <Label className="text-gray-300 text-xs mb-2 block">Lado</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['left', 'right', 'both'].map(side => (
                                        <button
                                            key={side}
                                            onClick={() => setForm(f => ({ ...f, breast_side: side }))}
                                            className={`py-1.5 rounded-xl border text-xs transition-all ${form.breast_side === side
                                                ? 'bg-blue-500/20 border-blue-500 text-white'
                                                : 'border-gray-700 text-gray-500'
                                                }`}
                                        >
                                            {side === 'left' ? '← Izq' : side === 'right' ? 'Der →' : '↔ Ambos'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hora */}
                        <div>
                            <Label className="text-gray-300 text-xs mb-1 block">Hora</Label>
                            <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                        </div>

                        {/* Duración y cantidad en fila */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-gray-300 text-xs mb-1 block">Duración (min)</Label>
                                <Input type="number" placeholder="15" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                            </div>
                            {form.session_type !== 'breastfeed' && (
                                <div>
                                    <Label className="text-gray-300 text-xs mb-1 block">Cantidad (ml)</Label>
                                    <Input type="number" placeholder="80" value={form.amount_ml} onChange={e => setForm(f => ({ ...f, amount_ml: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
